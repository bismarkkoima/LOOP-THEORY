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
│   ├── data.js           # Product catalog + generated SVG artwork
│   ├── store.js          # Photo storage adapter (Supabase | IndexedDB)
│   ├── auth.js           # Google sign-in, session, admin check
│   ├── admin.js          # Dashboard behaviour
│   ├── login.js          # Login page behaviour
│   ├── account.js        # Account page behaviour
│   └── app.js            # Storefront logic  ⚠️ currently empty
└── README.md
```

> **Note:** `js/app.js` is still empty, so the storefront's product grid, search,
> cart and quick-view modal do not render yet. The header's inline `onclick`
> handlers (`setFilter`, `openCart`) throw `ReferenceError` until it is written.
> The admin dashboard is unaffected — it has its own renderer.

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

## ▲ Deploying to Vercel

The whole project is static, so Vercel serves it as-is — no build command, no
framework preset, output directory `.`. Supabase is reached from the browser, so
there is no server to run.

**PHP is deliberately not used anywhere in this project.** Vercel has no PHP
runtime, so a PHP upload/delete backend would have to be thrown away at deploy
time. Supabase Storage covers the same ground from the client and works
identically on Laragon locally and on Vercel in production.

After deploying, add the production URL to Supabase's **Redirect URLs** and to
the Google OAuth client's authorised origins, or sign-in will fail on the live
site while still working locally.
