/* ============================================================
   Loop Theory — login.js
   Drives login.html. Sends the visitor to Google, then back to
   wherever they were headed (?next=), defaulting to the dashboard.
   ============================================================ */

(function () {

  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('googleBtn');
    const label = document.getElementById('googleLabel');
    const sub = document.getElementById('sub');
    const setup = document.getElementById('setup');
    const skip = document.getElementById('skip');

    window.Theme.mount(document.getElementById('themeSlot'));

    /* Only same-page targets are honoured, so a crafted
       ?next=https://elsewhere cannot turn this into an open
       redirect after a successful sign-in. */
    const requested = new URLSearchParams(location.search).get('next') || 'admin.html';
    const next = /^[A-Za-z0-9._-]+\.html(\?[^#]*)?$/.test(requested) ? requested : 'admin.html';

    window.Auth.ready.then(function () {
      if (window.Auth.mode === 'none') {
        label.textContent = 'Google sign-in unavailable';
        sub.textContent = 'The catalog dashboard is not protected yet.';
        setup.hidden = false;
        skip.hidden = false;
        return;
      }

      if (window.Auth.user) {
        location.replace(next);
        return;
      }

      btn.disabled = false;
      btn.addEventListener('click', function () {
        btn.disabled = true;
        label.textContent = 'Redirecting to Google…';
        const dir = location.pathname.replace(/[^/]*$/, '');
        window.Auth.signInWithGoogle(location.origin + dir + next).catch(function (err) {
          btn.disabled = false;
          label.textContent = 'Continue with Google';
          toast(err.message, 'err', 9000);
        });
      });
    });

    /* Signing in elsewhere (another tab finishing the redirect)
       should move this page along too. */
    window.Auth.onChange(function (user) {
      if (user) location.replace(next);
    });
  });

  function toast(text, kind, ms) {
    const wrap = document.getElementById('toasts');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.innerHTML = '<span></span>';
    el.firstChild.textContent = text;
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 4200);
  }

})();
