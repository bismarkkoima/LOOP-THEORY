/* ============================================================
   Loop Theory — auth.js
   Google sign-in and session handling via Supabase Auth.

     Auth.mode          'supabase' | 'none'
     Auth.ready         Promise — resolves once the session is known
     Auth.user          { id, email, name, avatar, provider } | null
     Auth.unsecured     true when no auth provider is configured
     Auth.signInWithGoogle(redirectTo)
     Auth.signOut()
     Auth.isAdmin()
     Auth.onChange(fn)  -> unsubscribe fn
     Auth.guard(opts)   -> Promise<{ ok, unsecured?, forbidden? }>

   WHEN SUPABASE IS NOT CONFIGURED there is no identity provider to
   talk to, so there is no sign-in at all. Rather than fake a
   session, Auth reports mode 'none' and unsecured true, and pages
   show a banner saying so. Nothing here ever invents a logged-in
   user.

   SECURITY: isAdmin() is a client-side check. It decides what the
   UI offers, not what the server permits — anyone can edit their
   own JavaScript. Real enforcement has to live in Supabase RLS
   policies on the storage bucket. See README.md.
   ============================================================ */

(function () {

  const listeners = [];
  let client = null;

  function profileOf(user) {
    if (!user) return null;
    const meta = user.user_metadata || {};
    const app = user.app_metadata || {};
    return {
      id: user.id,
      email: user.email || '',
      name: meta.full_name || meta.name || (user.email || '').split('@')[0],
      avatar: meta.avatar_url || meta.picture || '',
      provider: app.provider || 'unknown'
    };
  }

  function emit() {
    listeners.slice().forEach(function (fn) {
      try { fn(Auth.user); } catch (err) { console.error('[Auth] listener failed', err); }
    });
  }

  /* Where Google should send the browser back to. Built from the
     current directory so it works at a sub-path as well as at a
     domain root. */
  function defaultRedirect(page) {
    const dir = location.pathname.replace(/[^/]*$/, '');
    return location.origin + dir + (page || 'admin.html');
  }

  const Auth = {
    mode: 'none',
    ready: null,
    user: null,
    unsecured: false,
    degraded: null,

    signInWithGoogle: function (redirectTo) {
      if (!client) {
        return Promise.reject(new Error(
          'Google sign-in needs a Supabase project. Add your project URL and anon key to js/config.js.'
        ));
      }
      return client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo || defaultRedirect('admin.html'),
          queryParams: { prompt: 'select_account' }
        }
      }).then(function (res) {
        if (res.error) throw res.error;
        return res.data;
      });
    },

    signOut: function () {
      if (!client) return Promise.resolve();
      return client.auth.signOut().then(function (res) {
        if (res && res.error) throw res.error;
        Auth.user = null;
        emit();
      });
    },

    /* An empty adminEmails list means "any signed-in user is an
       admin" — fine for a solo shop, wrong the moment you have
       customer accounts. config.js says so too. */
    isAdmin: function () {
      if (!this.user) return false;
      const list = (window.LT_CONFIG && window.LT_CONFIG.adminEmails) || [];
      if (!list.length) return true;
      const email = String(this.user.email || '').toLowerCase();
      return list.some(function (e) { return String(e).toLowerCase() === email; });
    },

    onChange: function (fn) {
      listeners.push(fn);
      return function () {
        const i = listeners.indexOf(fn);
        if (i > -1) listeners.splice(i, 1);
      };
    },

    guard: function (opts) {
      opts = opts || {};
      return Auth.ready.then(function () {
        if (Auth.mode === 'none') return { ok: true, unsecured: true };
        if (!Auth.user) {
          const here = location.pathname.split('/').pop() + location.search;
          location.replace((opts.loginUrl || 'login.html') + '?next=' + encodeURIComponent(here));
          return { ok: false };
        }
        if (opts.admin && !Auth.isAdmin()) return { ok: false, forbidden: true };
        return { ok: true };
      });
    }
  };

  Auth.ready = Promise.resolve().then(function () {
    if (!window.LTSupabase.configured()) {
      Auth.mode = 'none';
      Auth.unsecured = true;
      return;
    }
    return window.LTSupabase.client().then(function (c) {
      client = c;
      Auth.mode = 'supabase';
      return c.auth.getSession().then(function (res) {
        if (res.error) throw res.error;
        Auth.user = profileOf(res.data && res.data.session && res.data.session.user);
        /* Fires on sign-in, sign-out, token refresh, and after the
           OAuth redirect is consumed from the URL fragment. */
        c.auth.onAuthStateChange(function (_event, session) {
          Auth.user = profileOf(session && session.user);
          emit();
        });
        emit();
      });
    }).catch(function (err) {
      console.warn('[Auth] Supabase unreachable — running unsecured.', err);
      Auth.mode = 'none';
      Auth.unsecured = true;
      Auth.degraded = String((err && err.message) || err);
    });
  });

  window.Auth = Auth;

})();
