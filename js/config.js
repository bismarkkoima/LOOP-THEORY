/* ============================================================
   Loop Theory — config.js
   Front-end configuration. Loaded before store.js.

   LOCAL MODE (default)
   Leave the two Supabase fields blank and product photos are kept
   in this browser via IndexedDB. Nothing to install, nothing to
   sign up for — but the photos live only in this browser profile.

   SUPABASE MODE
   Fill both fields in and the same dashboard writes to Supabase
   Storage instead. No other file changes.

     1. Create a project at supabase.com
     2. Storage → New bucket → name it `product-photos`
     3. Tick "Public bucket" so the storefront can read the images
     4. Project Settings → API Keys → copy the key into the field
        below. Newer projects show a **Publishable key** starting
        `sb_publishable_`; older ones a legacy **anon** key, which
        is a JWT starting `eyJ`. Either works — take whichever your
        project shows, and never a Secret or service_role key.

   The anon key is designed to be public — it is safe in client
   code. What is NOT safe by default: a public bucket with a
   permissive policy lets anyone upload and delete. Before this
   goes anywhere but your own machine, add Supabase Auth and
   restrict insert/delete to signed-in admins via RLS policies.
   See README.md → "Admin dashboard".
   ============================================================ */

window.LT_CONFIG = {
  supabaseUrl: 'https://uvkobqezzaxvlfzbjcpm.supabase.co',
  supabaseAnonKey: '',   /* <- paste the Publishable key here */
  supabaseBucket: 'product-photos',

  /* Google sign-in: enable the Google provider in Supabase
     (Authentication → Providers → Google) and paste in a Google
     Cloud OAuth client ID/secret. Full walkthrough in README.md.

     adminEmails gates who sees the dashboard. LEAVING THIS EMPTY
     MEANS EVERY SIGNED-IN GOOGLE ACCOUNT IS TREATED AS AN ADMIN,
     which is fine while you are the only user and wrong as soon as
     customers can sign in. Add your own address here:

       adminEmails: ['you@example.com'],

     This is a UI gate only. Enforce it for real with RLS policies
     on the storage bucket — see README.md → "Locking it down". */
  adminEmails: [],

  /* 'dark' | 'light' | 'system' — the starting theme before a
     visitor picks their own. 'system' follows the OS setting. */
  defaultTheme: 'dark'
};
