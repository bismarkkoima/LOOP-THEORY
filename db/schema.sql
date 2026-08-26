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

-- How many are left. Added additively so a table from an earlier run
-- catches up; the default of 10 is what an existing catalog inherits,
-- since 0 would quietly close the whole shop on the next deploy.
alter table public.products add column if not exists stock integer not null default 10;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_stock_nonneg') then
    alter table public.products add constraint products_stock_nonneg check (stock >= 0);
  end if;
end $$;

create unique index if not exists products_position_idx on public.products (position);
create index if not exists products_stock_idx on public.products (stock) where active;
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
-- Shop settings
--
-- One row, enforced by a primary key that can only ever be true.
-- The shipping figures live here rather than in js/config.js
-- because place_order() has to charge the same numbers the
-- storefront quoted, and only the database is beyond the reach
-- of whoever is holding the browser.
-- ------------------------------------------------------------

create table if not exists public.shop_settings (
  id                      boolean primary key default true check (id),
  free_shipping_threshold numeric(10,2) not null default 150 check (free_shipping_threshold >= 0),
  flat_shipping           numeric(10,2) not null default 8   check (flat_shipping >= 0),
  low_stock_at            integer not null default 3 check (low_stock_at >= 0),
  updated_at              timestamptz not null default now()
);

insert into public.shop_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists shop_settings_touch_updated_at on public.shop_settings;
create trigger shop_settings_touch_updated_at
  before update on public.shop_settings
  for each row execute function public.touch_updated_at();

alter table public.shop_settings enable row level security;

do $$ begin
  -- The storefront quotes shipping before checkout, so the numbers
  -- have to be readable without a session.
  if not exists (select 1 from pg_policies
                 where tablename = 'shop_settings' and policyname = 'settings are public') then
    create policy "settings are public"
      on public.shop_settings for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies
                 where tablename = 'shop_settings' and policyname = 'admins change settings') then
    create policy "admins change settings"
      on public.shop_settings for update
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
  currency    text not null default 'KES',
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

-- What the delivery cost, and what was actually charged. Both are
-- computed in place_order() from shop_settings, never from the request.
alter table public.orders add column if not exists shipping numeric(10,2) not null default 0
                                                            check (shipping >= 0);
alter table public.orders add column if not exists total    numeric(10,2);

-- Orders written before this column existed were subtotal-only.
update public.orders set total = subtotal + shipping where total is null;
alter table public.orders alter column total set not null;

-- the default only binds new rows; an existing table needs it reset too
alter table public.orders alter column currency set default 'KES';

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

-- ------------------------------------------------------------
-- Order history
--
-- set_order_status() used to overwrite a field and leave nothing
-- behind. A dispute about when something shipped, or who cancelled
-- it, needs a record that an update cannot erase — so every move is
-- appended here instead, with the address of whoever made it.
-- ------------------------------------------------------------

create table if not exists public.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status   text not null,
  actor       text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists order_events_order_idx
  on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;

-- No insert policy at all: rows arrive only from the security-definer
-- functions below, so the trail cannot be written by hand or forged.
do $$ begin
  if not exists (select 1 from pg_policies
                 where tablename = 'order_events' and policyname = 'admins read order history') then
    create policy "admins read order history"
      on public.order_events for select
      to authenticated
      using (public.is_admin());
  end if;
end $$;

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
  v_subtotal numeric(10,2) := 0;
  v_shipping numeric(10,2) := 0;
  v_lines    integer := 0;
  v_recent   integer;
  v_set      public.shop_settings%rowtype;
  v_item     record;
  v_prod     public.products%rowtype;
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

  select * into v_set from public.shop_settings where id;
  if not found then
    -- No settings row is not a reason to refuse an order; it is a reason
    -- not to charge for delivery.
    v_set.free_shipping_threshold := 0;
    v_set.flat_shipping           := 0;
  end if;

  -- The order goes in first so the lines have something to hang off. The
  -- money is nought until the lines have been priced, a few statements
  -- down, and the whole function is one transaction either way.
  insert into public.orders (
    id, token, email, subtotal, shipping, total,
    ship_name, ship_line1, ship_line2, ship_city, ship_postal, ship_country, note
  )
  values (
    v_order, v_token, v_email, 0, 0, 0,
    nullif(trim(coalesce(p_details ->> 'name',    '')), ''),
    nullif(trim(coalesce(p_details ->> 'line1',   '')), ''),
    nullif(trim(coalesce(p_details ->> 'line2',   '')), ''),
    nullif(trim(coalesce(p_details ->> 'city',    '')), ''),
    nullif(trim(coalesce(p_details ->> 'postal',  '')), ''),
    nullif(trim(coalesce(p_details ->> 'country', '')), ''),
    nullif(trim(coalesce(p_details ->> 'note',    '')), '')
  );

  -- Quantities are summed per product, so a cart that lists the same
  -- piece twice is checked against stock once, as one demand for three
  -- rather than three separate demands for one.
  --
  -- Ordered by id so two shoppers reaching for the same two pieces take
  -- the locks in the same sequence and queue instead of deadlocking.
  for v_item in
    select i.product_id as product_id, sum(i.qty)::integer as qty
    from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
    where i.qty between 1 and 99
    group by i.product_id
    order by i.product_id
  loop
    -- for update is what actually prevents overselling: the next order
    -- to want this piece waits here until this one has committed, and
    -- then reads the decremented figure rather than the stale one.
    select * into v_prod
    from public.products
    where id = v_item.product_id and active
    for update;

    -- Unknown or retired products are ignored rather than trusted,
    -- exactly as before.
    if not found then
      continue;
    end if;

    if v_prod.stock < v_item.qty then
      raise exception '% — only % left', v_prod.name, v_prod.stock
        using errcode = 'check_violation';
    end if;

    -- Prices come from the table, never from the request.
    insert into public.order_items (order_id, product_id, name, unit_price, qty)
    values (v_order, v_prod.id, v_prod.name, v_prod.price, v_item.qty);

    update public.products
       set stock = stock - v_item.qty
     where id = v_prod.id;

    v_subtotal := v_subtotal + v_prod.price * v_item.qty;
    v_lines    := v_lines + 1;
  end loop;

  if v_lines = 0 then
    raise exception 'order contains no purchasable items';
  end if;

  -- Delivery is priced here for the same reason the pieces are: the
  -- figure the drawer quoted came from the browser and cannot be trusted.
  if v_subtotal < v_set.free_shipping_threshold then
    v_shipping := v_set.flat_shipping;
  end if;

  update public.orders
     set subtotal = v_subtotal,
         shipping = v_shipping,
         total    = v_subtotal + v_shipping
   where id = v_order;

  insert into public.order_events (order_id, from_status, to_status, actor, note)
  values (v_order, null, 'pending', v_email, 'order placed');

  -- The token is returned once. It is the shopper's only way back in.
  return jsonb_build_object('id', v_order, 'token', v_token,
                            'subtotal', v_subtotal,
                            'shipping', v_shipping,
                            'total', v_subtotal + v_shipping);
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
           'shipping', o.shipping,
           'total', o.total,
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

-- The signature gains a note, so the old one goes first rather than
-- being left behind as a second overload.
drop function if exists public.set_order_status(uuid, text);

create or replace function public.set_order_status(p_order uuid,
                                                   p_status text,
                                                   p_note   text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from  text;
  v_actor text := auth.jwt() ->> 'email';
  v_item  record;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  if p_status not in ('pending', 'paid', 'shipped', 'cancelled') then
    raise exception 'unknown status %', p_status;
  end if;

  -- Locked for the same reason products are: two dashboards open on the
  -- same order must not both read 'pending' and both act on it.
  select status into v_from
  from public.orders
  where id = p_order
  for update;

  if not found then
    raise exception 'no such order';
  end if;

  if v_from = p_status then
    raise exception 'this order is already %', p_status;
  end if;

  -- Money and parcels only move forwards. An order that has shipped or
  -- been cancelled is finished, and a cancelled one cannot be revived —
  -- its stock has already gone back on the shelf and may since have sold.
  if not (
       (v_from = 'pending' and p_status in ('paid', 'cancelled'))
    or (v_from = 'paid'    and p_status in ('shipped', 'cancelled'))
  ) then
    raise exception '% cannot become %', v_from, p_status;
  end if;

  -- Cancelling puts the pieces back. Without this the stock taken at
  -- checkout would stay spent on an order nobody is going to receive.
  if p_status = 'cancelled' then
    for v_item in
      select product_id, sum(qty)::integer as qty
      from public.order_items
      where order_id = p_order
      group by product_id
      order by product_id
    loop
      update public.products
         set stock = stock + v_item.qty
       where id = v_item.product_id;
    end loop;
  end if;

  update public.orders set status = p_status where id = p_order;

  insert into public.order_events (order_id, from_status, to_status, actor, note)
  values (p_order, v_from, p_status, v_actor,
          nullif(trim(coalesce(p_note, '')), ''));

  return jsonb_build_object('id', p_order, 'from', v_from, 'to', p_status);
end $$;

revoke all on function public.set_order_status(uuid, text, text) from public;
grant execute on function public.set_order_status(uuid, text, text) to authenticated;




-- ------------------------------------------------------------
-- The dashboard's summary
--
-- One round trip for the figures across the top of the dashboard.
-- Doing it here rather than by pulling every order into the browser
-- keeps the counts right on a shop with more orders than a page.
--
-- Cancelled orders are excluded from takings: the money was never
-- collected, and counting it flatters the total.
-- ------------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_set public.shop_settings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  select * into v_set from public.shop_settings where id;

  return jsonb_build_object(
    'orders', (select count(*) from public.orders),
    'by_status', coalesce((
      select jsonb_object_agg(status, n)
      from (select status, count(*) as n from public.orders group by status) t
    ), '{}'::jsonb),
    'takings', coalesce((
      select sum(total) from public.orders where status <> 'cancelled'
    ), 0),
    'takings_7d', coalesce((
      select sum(total) from public.orders
      where status <> 'cancelled' and created_at > now() - interval '7 days'
    ), 0),
    'awaiting', (select count(*) from public.orders where status in ('pending', 'paid')),
    'products', (select count(*) from public.products where active),
    'out_of_stock', (select count(*) from public.products where active and stock = 0),
    'low_stock', (select count(*) from public.products
                  where active and stock > 0 and stock <= coalesce(v_set.low_stock_at, 3)),
    'stock_units', coalesce((select sum(stock) from public.products where active), 0)
  );
end $$;

revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;


-- ------------------------------------------------------------
-- Make yourself an admin — replace the address, then run it.
-- ------------------------------------------------------------
-- insert into public.admins (email) values ('you@example.com')
-- on conflict (email) do nothing;
