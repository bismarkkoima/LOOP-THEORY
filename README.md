# Loop Theory — E-Commerce Prototype

A lightweight, responsive, single-page e-commerce application for **Loop Theory**,
built with front-end web technologies only — no build step, no bundler, no framework.
The one optional dependency is the Supabase JS client, loaded from a CDN and only when
you configure a Supabase project.

## 🚀 Features

* **Dynamic Product Grid:** Renders product items dynamically based on category filters and live search input.
* **Quick-View Modal:** Detailed product inspector showcasing specs, descriptions, and dynamic SVG visualizers.
* **Persistent Shopping Cart:** Fully functional cart drawer with subtotal calculations and state persistence using `localStorage`.
* **Responsive Layout:** Tailored layout for mobile, tablet, and desktop viewports using CSS Grid and Flexbox.
* **Photo admin dashboard:** Drag-and-drop product photography with one-click removal and undo.
* **Google sign-in:** Account system via Supabase Auth, gating the dashboard.
* **Light and dark themes:** Remembered per visitor, or following the OS setting.
* **Postgres catalog:** Products and orders in Supabase, with the bundled catalog as a fallback.

## 📁 Project Structure

```text
loop-theory/
├── index.html            # Storefront
├── admin.html            # Photo dashboard (noindex)
├── login.html            # Google sign-in (noindex)
├── account.html          # Account details + appearance (noindex)
├── css/
│   ├── styles.css        # Tokens, both themes, storefront styles
│   └── admin.css         # Dashboard, login and account styles
├── js/
│   ├── config.js         # Supabase keys, admin allowlist, default theme
│   ├── theme.js          # Light/dark engine — loaded in <head>
│   ├── supabase-client.js# Shared, memoised Supabase client
│   ├── data.js           # Bundled catalog + generated SVG artwork
│   ├── catalog.js        # Catalog adapter (Postgres | bundled data.js)
│   ├── store.js          # Photo storage adapter (Supabase | IndexedDB)
│   ├── auth.js           # Google sign-in, session, admin check
│   ├── admin.js          # Dashboard behaviour
│   ├── login.js          # Login page behaviour
│   ├── account.js        # Account page behaviour
│   └── app.js            # Storefront logic
├── db/
│   ├── schema.sql        # Tables, RLS policies, place_order()
│   ├── seed.sql          # The 40-piece catalog (generated)
│   └── generate-seed.js  # Regenerates seed.sql from js/data.js
└── README.md
```

## 🖥️ Running it locally

Any static file server works. From the project root:

```bash
python -m http.server 8000
# then open http://127.0.0.1:8000/
```

Laragon serves it too, since the project lives under `laragon/www`.
Opening the files directly with `file://` will **not** work — IndexedDB and the
Supabase client both need a real origin.

| Page | URL |
| --- | --- |
| Storefront | `/index.html` |
| Photo dashboard | `/admin.html` |
| Sign in | `/login.html` |
| Account | `/account.html` |

## 🌓 Themes

`js/theme.js` writes `data-theme="dark"` or `data-theme="light"` onto `<html>` and
remembers the choice in `localStorage` under `lt-theme`. It is loaded in `<head>`
before the stylesheet so the right palette is painted on the first frame — no flash.

* The circular button in the header toggles between light and dark.
* **Account → Appearance** offers the third option, *System*, which follows
  `prefers-color-scheme` and keeps following it as the OS setting changes.
* Set the pre-choice default with `defaultTheme` in `js/config.js`.

Both palettes are defined as CSS custom properties in `css/styles.css`. The token
names are shared (`--ink` is always the background, `--paper` always the foreground),
so the generated SVG artwork in `data.js` re-themes automatically. Brass and
verdigris are darkened in the light palette — the dark values lose contrast on a
light ground.

Add a toggle to any page with a single attribute:

```html
<span data-theme-toggle></span>
```

## 📸 Admin dashboard

Open `/admin.html`. Every piece falls back to its generated SVG artwork until you
give it a photo.

* **Drop files onto the big zone** — each is matched to a product by filename.
  `lt-01.jpg` matches by id; `Orbit Pendant.png` matches by name (case, spaces,
  punctuation and accents are ignored). Anything that matches nothing is reported
  rather than guessed at.
* **Drop straight onto a piece** — always wins, no naming needed.
* **Click a piece** to browse for a file.
* **Remove** deletes the photo and offers **Undo** for about six seconds.
* Filter by category, search, or tick **Needs a photo** to see only the gaps.

Accepted: JPEG, PNG, WebP, GIF, AVIF, up to 15 MB each. One photo per product —
uploading again replaces the previous one. Files are **not** re-encoded or
downscaled, so what you upload is what gets served.

### Where photos are stored

`js/store.js` is an adapter with one interface and two backends, chosen at load:

| Backend | When | Persistence |
| --- | --- | --- |
| **IndexedDB** | No Supabase config (the default) | This browser profile only. Not shared with other visitors, not committed to git. |
| **Supabase Storage** | `supabaseUrl` + `supabaseAnonKey` set | A real bucket. Shared with everyone, survives browsers and devices. |

The dashboard header shows which is active. Nothing outside `store.js` knows the
difference, so adding a third backend means writing one object with
`init/list/put/remove` — no caller changes.

## 🔐 Connecting Supabase + Google sign-in

Until you do this, there is **no sign-in and no access control** — the dashboard
says so in a banner, and `login.html` explains the setup rather than pretending
to log you in.

**1. Create the project**

Sign up at [supabase.com](https://supabase.com) and create a project.

**2. Create the storage bucket**

Storage → **New bucket** → name it `product-photos` → tick **Public bucket**
(the storefront needs to read the images).

**3. Enable Google as a provider**

In Google Cloud Console: create an **OAuth 2.0 Client ID** of type *Web
application*. In Supabase: Authentication → Providers → **Google** → paste the
client ID and secret. Supabase shows you a callback URL like
`https://<project>.supabase.co/auth/v1/callback` — add that to the Google
client's **Authorised redirect URIs**.

**4. Allow your own site**

Authentication → URL Configuration → add your origins to **Redirect URLs**,
e.g. `http://localhost:8000/**` and your production domain.

**5. Fill in `js/config.js`**

```js
window.LT_CONFIG = {
  supabaseUrl:     'https://<project>.supabase.co',
  supabaseAnonKey: '<anon public key>',
  supabaseBucket:  'product-photos',
  adminEmails:     ['you@example.com'],
  defaultTheme:    'dark'
};
```

Reload. The dashboard now redirects to `login.html`, storage switches to your
bucket, and the header pill reads **Supabase**.

The `anon` key is designed to ship in client code — it is not a secret. The
*service role* key is, and must never appear in this project.

### 🔒 Locking it down

`adminEmails` is a **UI gate only**. It decides what the interface offers, not
what the server permits — anyone can edit their own JavaScript. Leaving it empty
means every signed-in Google account is treated as an admin.

Real enforcement lives in Supabase RLS policies on `storage.objects`. Reads stay
public so the storefront works; writes and deletes are restricted to your
address:

```sql
-- anyone may read product photos
create policy "public read"
on storage.objects for select
using ( bucket_id = 'product-photos' );

-- only named admins may add, replace or delete them
create policy "admin write"
on storage.objects for insert to authenticated
with check ( bucket_id = 'product-photos'
             and auth.jwt() ->> 'email' in ('you@example.com') );

create policy "admin update"
on storage.objects for update to authenticated
using ( bucket_id = 'product-photos'
        and auth.jwt() ->> 'email' in ('you@example.com') );

create policy "admin delete"
on storage.objects for delete to authenticated
using ( bucket_id = 'product-photos'
        and auth.jwt() ->> 'email' in ('you@example.com') );
```

Without these, a public bucket with permissive policies lets anyone upload and
delete. Add them before this is reachable from the internet.

## 🗄️ The database

The catalog and orders live in Supabase Postgres — the same project that
already holds the photo bucket and Google sign-in, so there is no second
service to run and nothing new to deploy. The browser talks to it directly
with the `anon` key, which is why this still works on Vercel with no server,
no API routes and no build step.

**Until you set it up, the shop runs on the bundled catalog in `js/data.js`.**
Nothing is broken; the storefront just reads its forty pieces from the file
instead of the database, and Checkout says so rather than pretending.

### Setting it up

1. **Run the schema.** Supabase dashboard → SQL Editor → New query → paste
   all of `db/schema.sql` → Run. It is idempotent, so re-running is safe.
2. **Load the catalog.** Same again with `db/seed.sql`.
3. **Make yourself an admin.** Last line of `schema.sql`, with your address:
   ```sql
   insert into public.admins (email) values ('you@example.com')
   on conflict (email) do nothing;
   ```
4. **Fill in `js/config.js`** — the same `supabaseUrl` and `supabaseAnonKey`
   the photo dashboard uses. Reload; the catalog now comes from Postgres.

`db/seed.sql` is generated from `js/data.js` — never hand-edit it. After
changing the catalog in `data.js`, regenerate with:

```bash
node db/generate-seed.js > db/seed.sql
```

Re-running the seed updates rows in place, so product ids never move and
any `photo_url` you have set is left alone.

### What is in it

| Table | Holds | Who can read | Who can write |
| --- | --- | --- | --- |
| `products` | The catalog | Anyone (active rows) | Admins |
| `orders` | One row per checkout | Admins | `place_order()` only |
| `order_items` | The lines of an order | Admins | `place_order()` only |
| `admins` | Who counts as an admin | Admins | Nobody, from the browser |

Artwork is **not** stored. Each row keeps a `metal` and an `art` variant, and
the storefront redraws the SVG from those at render time — so the art stays
vector, re-themes with light and dark, and a catalog row stays small. Upload a
photograph through the dashboard and `photo_url` takes over.

### How the fallback works

`js/catalog.js` is an adapter in the same shape as `js/store.js`: one
interface, backend chosen once at load. `app.js` only ever calls `Catalog`
and never learns which is live.

It falls back to the bundled catalog when Supabase is unconfigured, when the
products table is empty (schema ran, seed did not), and when the database is
simply unreachable. That last one matters in production: a database blip
gives visitors a slightly stale shop rather than an empty one.

### Orders, and why checkout is one function

Checkout calls a single Postgres function, `place_order(p_email, p_items)`.

It sends **ids and quantities only**. The function looks every price up in
the `products` table and computes the subtotal itself. The number in the cart
drawer is for the shopper's benefit — anything the browser sends can be
edited by whoever is holding the browser, and a client-supplied subtotal
means a $285 ring can be bought for $1.

It is also one transaction. Two separate inserts from the browser can
half-succeed and leave an order with no lines in it.

Because of that, neither `orders` nor `order_items` grants insert to anyone.
There is no way to write a row except through the function.

### Before you take real orders

This is a working order table, not a checkout. It records what someone asked
for; it does not take payment, reserve stock, or email anybody. Also:

* **`place_order` is open to anonymous callers** — necessarily, since
  shoppers are not signed in. Someone could script it and fill the table with
  junk orders. Put a rate limit or a CAPTCHA in front of it, or require
  sign-in, before the URL is public.
* **Nobody can read an order back, including the person who placed it.**
  Order confirmation pages need a design decision first: either sign shoppers
  in, or issue a token per order.
* **No payment provider is wired in.** `status` starts at `pending` and stays
  there until something moves it.


## ▲ Deploying to Vercel

The whole project is static, so Vercel serves it as-is — no build command, no
framework preset, output directory `.`. Supabase is reached from the browser —
catalog, orders, photos and sign-in all — so there is no server to run, no API
routes, and no connection string or secret in the deployment.

**PHP is deliberately not used anywhere in this project.** Vercel has no PHP
runtime, so a PHP upload/delete backend would have to be thrown away at deploy
time. Supabase Storage covers the same ground from the client and works
identically on Laragon locally and on Vercel in production.

After deploying, add the production URL to Supabase's **Redirect URLs** and to
the Google OAuth client's authorised origins, or sign-in will fail on the live
site while still working locally.
