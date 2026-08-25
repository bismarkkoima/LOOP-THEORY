-- ============================================================
-- Loop Theory — schema.sql
--
-- Run this once, whole, in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
-- Then run db/seed.sql to load the catalog.
--
-- Safe to re-run: every statement is idempotent.
--
-- Everything here is reached from the browser with the `anon`
-- key, so row level security is the only thing standing between
-- your data and the open internet. It is enabled on every table
-- below. Do not turn it off.
-- ============================================================


-- ------------------------------------------------------------
-- Who counts as an admin
--
-- A table rather than a list of addresses baked into each policy:
-- adding a colleague is then an insert, not a policy rewrite.
-- ------------------------------------------------------------

create table if not exists public.admins (
  email      text primary key,
  added_at   timestamptz not null default now()
);

alter table public.admins enable row level security;

-- security definer so the function can read `admins` while the
-- caller cannot; stable so Postgres may cache it per statement.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

do $$ begin
  if not exists (select 1 from pg_policies
                 where tablename = 'admins' and policyname = 'admins readable by admins') then
    create policy "admins readable by admins"
      on public.admins for select
      to authenticated
      using (public.is_admin());
  end if;
end $$;


-- ------------------------------------------------------------
-- Products — the catalog
--
-- `metal` and `art` are not decoration: the storefront redraws
-- each piece's SVG from them at render time, so artwork stays
-- vector and re-themes with light/dark. `photo_url` overrides
-- that once a real photograph is uploaded.
-- ------------------------------------------------------------

create table if not exists public.products (
  id           text primary key,
  position     integer not null,
  name         text    not null,
  category     text    not null check (category in ('Rings', 'Necklaces', 'Earrings', 'Bracelets')),
  price        numeric(10,2) not null check (price >= 0),
  was          numeric(10,2) check (was is null or was > price),
  description  text    not null default '',
  metal        text    not null default 'brass'
                       check (metal in ('brass', 'gold', 'verdigris', 'steel', 'mixed')),
  art          smallint not null default 0 check (art >= 0),
  size         text,
  finish       text,
  photo_url    text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists products_position_idx on public.products (position);
create index if not exists products_category_idx on public.products (category) where active;

-- keep updated_at honest without the client having to remember
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

alter table public.products enable row level security;

do $$ begin
  -- The storefront is public, so anyone may read a live product.
  -- Inactive rows stay hidden without needing a separate table.
  if not exists (select 1 from pg_policies
                 where tablename = 'products' and policyname = 'live products are public') then
    create policy "live products are public"
      on public.products for select
      to anon, authenticated
      using (active);
  end if;

  if not exists (select 1 from pg_policies
                 where tablename = 'products' and policyname = 'admins manage products') then
    create policy "admins manage products"
      on public.products for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;


-- ------------------------------------------------------------
-- Orders
--
-- Name and unit price are copied onto each line at checkout
-- rather than joined at read time. A past order must keep saying
-- what was actually charged after the catalog price moves on.
-- ------------------------------------------------------------

create table if not exists public.orders (
  id          uuid primary key,
  created_at  timestamptz not null default now(),
  email       text,
  subtotal    numeric(10,2) not null check (subtotal >= 0),
  currency    text not null default 'USD',
  status      text not null default 'pending'
              check (status in ('pending', 'paid', 'shipped', 'cancelled'))
);

create table if not exists public.order_items (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  product_id  text not null references public.products (id),
  name        text not null,
  unit_price  numeric(10,2) not null check (unit_price >= 0),
  qty         integer not null check (qty > 0 and qty <= 99)
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists orders_created_idx on public.orders (created_at desc);

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- No insert policy for anon on either table, deliberately: orders are
-- placed only through place_order() below. Shoppers therefore cannot
-- write arbitrary rows, and cannot read any order back.

do $$ begin
  if not exists (select 1 from pg_policies
                 where tablename = 'orders' and policyname = 'admins read orders') then
    create policy "admins read orders"
      on public.orders for select
      to authenticated
      using (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies
                 where tablename = 'order_items' and policyname = 'admins read order lines') then
    create policy "admins read order lines"
      on public.order_items for select
      to authenticated
      using (public.is_admin());
  end if;
end $$;


-- ------------------------------------------------------------
-- Placing an order
--
-- The whole checkout is this one function, for two reasons.
--
-- It is one transaction: an order and its lines are written
-- together or not at all. Two separate inserts from the browser
-- can half-succeed and leave an order with nothing in it.
--
-- And every price is read from the products table here, never
-- taken from the request. Anything the browser sends can be
-- edited by whoever is holding the browser — a client-supplied
-- subtotal means a $285 ring can be bought for $1.
-- ------------------------------------------------------------

create or replace function public.place_order(p_email text, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    uuid := gen_random_uuid();
  v_subtotal numeric(10,2);
  v_lines    integer;
begin
  -- ignores unknown or inactive ids rather than trusting the cart
  select count(*), coalesce(sum(p.price * i.qty), 0)
    into v_lines, v_subtotal
  from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
  join public.products p on p.id = i.product_id and p.active
  where i.qty between 1 and 99;

  if v_lines = 0 then
    raise exception 'order contains no purchasable items';
  end if;

  insert into public.orders (id, email, subtotal)
  values (v_order, nullif(trim(p_email), ''), v_subtotal);

  insert into public.order_items (order_id, product_id, name, unit_price, qty)
  select v_order, p.id, p.name, p.price, i.qty
  from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
  join public.products p on p.id = i.product_id and p.active
  where i.qty between 1 and 99;

  return v_order;
end $$;

-- security definer runs as the owner, so hand it out deliberately
revoke all on function public.place_order(text, jsonb) from public;
grant execute on function public.place_order(text, jsonb) to anon, authenticated;


-- ------------------------------------------------------------
-- Make yourself an admin — replace the address, then run it.
-- ------------------------------------------------------------
-- insert into public.admins (email) values ('you@example.com')
-- on conflict (email) do nothing;
