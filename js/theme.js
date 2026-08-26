/* ============================================================
   Loop Theory — theme.js
   Light / dark theming.

     Theme.get()        -> 'dark' | 'light' | 'system'
     Theme.resolved()   -> 'dark' | 'light'   (what is actually painted)
     Theme.set(mode)
     Theme.toggle()
     Theme.mount(el)    -> renders a toggle button into el
     Theme.onChange(fn) -> unsubscribe fn

   The choice is written to <html data-theme> and remembered in
   localStorage. 'system' follows prefers-color-scheme and keeps
   following it as the OS setting changes.

   This file is loaded in <head>, before the stylesheet paints, so
   the correct palette is on the element from the first frame and
   there is no white flash on a dark-theme load.
   ============================================================ */

(function () {

  const KEY = 'lt-theme';
  const MODES = ['dark', 'light', 'system'];
  const listeners = [];
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function stored() {
    try {
      const v = localStorage.getItem(KEY);
      return MODES.indexOf(v) > -1 ? v : null;
    } catch (err) {
      /* Private mode, or site data blocked. Not worth failing over. */
      return null;
    }
  }

  function fallback() {
    const c = window.LT_CONFIG || {};
    return MODES.indexOf(c.defaultTheme) > -1 ? c.defaultTheme : 'dark';
  }

  let mode = stored() || fallback();

  function resolved() {
    if (mode !== 'system') return mode;
    return mq && mq.matches ? 'light' : 'dark';
  }

  function paint() {
    document.documentElement.setAttribute('data-theme', resolved());
    document.documentElement.style.colorScheme = resolved();
  }

  function emit() {
    const r = resolved();
    listeners.slice().forEach(function (fn) {
      try { fn(mode, r); } catch (err) { console.error('[Theme] listener failed', err); }
    });
  }

  const Theme = {

    get: function () { return mode; },
    resolved: resolved,

    set: function (next) {
      if (MODES.indexOf(next) === -1) return;
      mode = next;
      try { localStorage.setItem(KEY, next); } catch (err) { /* non-fatal */ }
      paint();
      emit();
    },

    /* Two-state toggle for the header button: whatever is on
       screen now, show the other one. A visitor on 'system' who
       clicks the button gets an explicit choice, which is what
       clicking a toggle means. */
    toggle: function () {
      this.set(resolved() === 'dark' ? 'light' : 'dark');
    },

    onChange: function (fn) {
      listeners.push(fn);
      return function () {
        const i = listeners.indexOf(fn);
        if (i > -1) listeners.splice(i, 1);
      };
    },

    mount: function (el) {
      if (!el) return;
      const btn = document.createElement('button');
      btn.className = 'theme-toggle';
      btn.type = 'button';

      function sync() {
        const light = resolved() === 'light';
        btn.innerHTML = light ? SUN : MOON;
        btn.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
        btn.setAttribute('title', light ? 'Switch to dark theme' : 'Switch to light theme');
      }

      btn.addEventListener('click', function () { Theme.toggle(); });
      Theme.onChange(sync);
      sync();
      el.appendChild(btn);
      return btn;
    }
  };

  const MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linejoin="round"/></svg>';

  const SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M12 2.6v2.2M12 19.2v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.6 12h2.2M19.2 12h2.2' +
    'M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round"/></svg>';

  if (mq) {
    const onSystem = function () { if (mode === 'system') { paint(); emit(); } };
    if (mq.addEventListener) mq.addEventListener('change', onSystem);
    else if (mq.addListener) mq.addListener(onSystem);
  }

  paint();
  window.Theme = Theme;

  /* Any element with [data-theme-toggle] gets a button, so a page
     can opt in from markup alone with no script of its own. */
  document.addEventListener('DOMContentLoaded', function () {
    const slots = document.querySelectorAll('[data-theme-toggle]');
    Array.prototype.forEach.call(slots, function (el) { Theme.mount(el); });
  });

})();
