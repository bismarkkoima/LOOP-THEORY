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
  updated_at  timestamptz not null default now(),
  -- A shopper is not signed in and cannot read the orders table, so this
  -- unguessable token is the only way they can see their own order again.
  token       uuid not null unique default gen_random_uuid(),
  email       text,
  ship_name   text,
  ship_line1  text,
  ship_line2  text,
  ship_city   text,
  ship_postal text,
  ship_country text,
  note        text,
  subtotal    numeric(10,2) not null check (subtotal >= 0),
  currency    text not null default 'USD',
  status      text not null default 'pending'
              check (status in ('pending', 'paid', 'shipped', 'cancelled'))
);

-- additive, so an existing table from an earlier run catches up
alter table public.orders add column if not exists updated_at   timestamptz not null default now();
alter table public.orders add column if not exists token        uuid not null default gen_random_uuid();
alter table public.orders add column if not exists ship_name    text;
alter table public.orders add column if not exists ship_line1   text;
alter table public.orders add column if not exists ship_line2   text;
alter table public.orders add column if not exists ship_city    text;
alter table public.orders add column if not exists ship_postal  text;
alter table public.orders add column if not exists ship_country text;
alter table public.orders add column if not exists note         text;

create unique index if not exists orders_token_idx on public.orders (token);

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

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

-- The return type changes between versions, which create-or-replace
-- cannot do, so the old signature is dropped first.
drop function if exists public.place_order(text, jsonb);
drop function if exists public.place_order(jsonb, jsonb);

create or replace function public.place_order(p_details jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    uuid := gen_random_uuid();
  v_token    uuid := gen_random_uuid();
  v_email    text := nullif(trim(coalesce(p_details ->> 'email', '')), '');
  v_subtotal numeric(10,2);
  v_lines    integer;
  v_recent   integer;
begin
  -- A cheap brake on scripted junk. Not real rate limiting: without the
  -- caller's IP this can only key on a self-declared address. See README.
  if v_email is not null then
    select count(*) into v_recent
    from public.orders
    where email = v_email and created_at > now() - interval '1 hour';

    if v_recent >= 10 then
      raise exception 'too many orders from this address in the last hour';
    end if;
  end if;

  -- Prices come from the table, never from the request, and unknown or
  -- retired products are ignored rather than trusted.
  select count(*), coalesce(sum(p.price * i.qty), 0)
    into v_lines, v_subtotal
  from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
  join public.products p on p.id = i.product_id and p.active
  where i.qty between 1 and 99;

  if v_lines = 0 then
    raise exception 'order contains no purchasable items';
  end if;

  insert into public.orders (
    id, token, email, subtotal,
    ship_name, ship_line1, ship_line2, ship_city, ship_postal, ship_country, note
  )
  values (
    v_order, v_token, v_email, v_subtotal,
    nullif(trim(coalesce(p_details ->> 'name',    '')), ''),
    nullif(trim(coalesce(p_details ->> 'line1',   '')), ''),
    nullif(trim(coalesce(p_details ->> 'line2',   '')), ''),
    nullif(trim(coalesce(p_details ->> 'city',    '')), ''),
    nullif(trim(coalesce(p_details ->> 'postal',  '')), ''),
    nullif(trim(coalesce(p_details ->> 'country', '')), ''),
    nullif(trim(coalesce(p_details ->> 'note',    '')), '')
  );

  insert into public.order_items (order_id, product_id, name, unit_price, qty)
  select v_order, p.id, p.name, p.price, i.qty
  from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
  join public.products p on p.id = i.product_id and p.active
  where i.qty between 1 and 99;

  -- The token is returned once. It is the shopper's only way back in.
  return jsonb_build_object('id', v_order, 'token', v_token, 'subtotal', v_subtotal);
end $$;

revoke all on function public.place_order(jsonb, jsonb) from public;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;


-- ------------------------------------------------------------
-- Reading one order back
--
-- Orders carry an address, so they are not public. This takes the
-- token issued at checkout and returns exactly one order, which is
-- why the token is a uuid rather than anything guessable.
-- ------------------------------------------------------------

create or replace function public.get_order(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
           'id', o.id,
           'created_at', o.created_at,
           'status', o.status,
           'subtotal', o.subtotal,
           'currency', o.currency,
           'email', o.email,
           'ship_name', o.ship_name,
           'ship_line1', o.ship_line1,
           'ship_line2', o.ship_line2,
           'ship_city', o.ship_city,
           'ship_postal', o.ship_postal,
           'ship_country', o.ship_country,
           'note', o.note,
           'items', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'product_id', i.product_id,
                      'name', i.name,
                      'unit_price', i.unit_price,
                      'qty', i.qty) order by i.id)
             from public.order_items i where i.order_id = o.id), '[]'::jsonb)
         )
    into v
  from public.orders o
  where o.token = p_token;

  if v is null then
    raise exception 'no order with that reference';
  end if;

  return v;
end $$;

revoke all on function public.get_order(uuid) from public;
grant execute on function public.get_order(uuid) to anon, authenticated;


-- ------------------------------------------------------------
-- Moving an order along
--
-- Admins only, and checked inside the function rather than trusted
-- from the client.
-- ------------------------------------------------------------

create or replace function public.set_order_status(p_order uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  if p_status not in ('pending', 'paid', 'shipped', 'cancelled') then
    raise exception 'unknown status %', p_status;
  end if;

  update public.orders set status = p_status where id = p_order;

  if not found then
    raise exception 'no such order';
  end if;
end $$;

revoke all on function public.set_order_status(uuid, text) from public;
grant execute on function public.set_order_status(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- Make yourself an admin — replace the address, then run it.
-- ------------------------------------------------------------
-- insert into public.admins (email) values ('you@example.com')
-- on conflict (email) do nothing;
