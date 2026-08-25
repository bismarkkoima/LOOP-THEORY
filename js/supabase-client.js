/* ============================================================
   Loop Theory — supabase-client.js
   One lazily-created, memoised Supabase client, shared by
   store.js (photo storage) and auth.js (Google sign-in).

     LTSupabase.configured()  -> boolean
     LTSupabase.client()      -> Promise<client>   (rejects if unconfigured)
     LTSupabase.bucket()      -> string

   Two clients would mean two independent auth sessions, so the
   dashboard would think you were signed out while storage still
   held a token. Everything goes through this.
   ============================================================ */

(function () {

  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  let pending = null;

  function cfg() {
    return window.LT_CONFIG || {};
  }

  const LTSupabase = {

    configured: function () {
      const c = cfg();
      return !!(c.supabaseUrl && c.supabaseAnonKey && c.supabaseUrl.indexOf('YOUR_') === -1);
    },

    bucket: function () {
      return cfg().supabaseBucket || 'product-photos';
    },

    client: function () {
      if (!this.configured()) {
        return Promise.reject(new Error('Supabase is not configured — fill in js/config.js.'));
      }
      if (!pending) {
        const c = cfg();
        pending = import(CDN).then(function (mod) {
          return mod.createClient(c.supabaseUrl, c.supabaseAnonKey, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              /* The OAuth redirect comes back with tokens in the URL
                 fragment; let the client consume them on load. */
              detectSessionInUrl: true
            }
          });
        }).catch(function (err) {
          pending = null;
          throw err;
        });
      }
      return pending;
    }
  };

  window.LTSupabase = LTSupabase;

})();
