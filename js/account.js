/* ============================================================
   Loop Theory — account.js
   Drives account.html: who you are signed in as, what that
   account is allowed to do, theme preference, and sign out.
   ============================================================ */

(function () {

  document.addEventListener('DOMContentLoaded', function () {
    window.Theme.mount(document.getElementById('themeSlot'));
    mountThemeChoice();

    window.Auth.guard().then(function (gate) {
      if (!gate.ok) return;   /* redirected to login */
      if (gate.unsecured) renderUnsecured();
      else renderAccount();
    });

    document.getElementById('signOut').addEventListener('click', function () {
      const btn = this;
      btn.disabled = true;
      window.Auth.signOut().then(function () {
        location.href = 'login.html';
      }).catch(function (err) {
        btn.disabled = false;
        console.error('[account] sign out failed', err);
      });
    });
  });

  function renderAccount() {
    const user = window.Auth.user;
    const admin = window.Auth.isAdmin();
    const allowlist = (window.LT_CONFIG && window.LT_CONFIG.adminEmails) || [];

    document.getElementById('displayName').textContent = user.name;
    document.getElementById('displayEmail').textContent = user.email;

    const slot = document.getElementById('avatarSlot');
    if (user.avatar) {
      const img = document.createElement('img');
      img.className = 'avatar avatar-lg';
      img.src = user.avatar;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      slot.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.className = 'avatar avatar-lg avatar-fallback';
      span.style.fontSize = '30px';
      span.textContent = (user.name || '?').charAt(0).toUpperCase();
      slot.appendChild(span);
    }

    rows([
      ['Signed in with', cap(user.provider)],
      ['Email', user.email],
      ['Role', admin ? 'Administrator' : 'Standard account'],
      ['Admin list', allowlist.length
        ? allowlist.length + ' address' + (allowlist.length > 1 ? 'es' : '') + ' in config.js'
        : 'Empty — every signed-in account is an admin'],
      ['User ID', user.id]
    ]);

    if (!allowlist.length) {
      banner('<strong>Every signed-in Google account is an admin.</strong> ' +
        'The <code>adminEmails</code> list in <code>js/config.js</code> is empty. ' +
        'Add your own address before anyone else can sign in.');
    }
  }

  function renderUnsecured() {
    document.getElementById('displayName').textContent = 'Not signed in';
    document.getElementById('displayEmail').textContent = 'No identity provider configured';

    const span = document.createElement('span');
    span.className = 'avatar avatar-lg avatar-fallback';
    span.style.fontSize = '30px';
    span.textContent = '—';
    document.getElementById('avatarSlot').appendChild(span);

    rows([
      ['Status', 'No account system active'],
      ['Sign-in', 'Unavailable until Supabase is configured'],
      ['Dashboard access', 'Open to anyone who can reach this page']
    ]);

    banner('<strong>There are no accounts yet.</strong> Google sign-in needs a Supabase ' +
      'project — add its URL and anon key to <code>js/config.js</code>. ' +
      'See <code>README.md</code> for the full walkthrough.');

    document.getElementById('signOut').hidden = true;
  }

  function rows(pairs) {
    const wrap = document.getElementById('rows');
    wrap.innerHTML = '';
    pairs.forEach(function (pair) {
      const row = document.createElement('div');
      row.className = 'row';
      const k = document.createElement('span');
      k.className = 'k';
      k.textContent = pair[0];
      const v = document.createElement('span');
      v.className = 'v';
      v.textContent = pair[1];
      row.appendChild(k);
      row.appendChild(v);
      wrap.appendChild(row);
    });
  }

  /* Three-way control, unlike the header's two-way toggle: this is
     where "follow my system setting" can actually be chosen. */
  function mountThemeChoice() {
    const wrap = document.getElementById('themeChoice');
    const modes = [['dark', 'Dark'], ['light', 'Light'], ['system', 'System']];

    modes.forEach(function (m) {
      const b = document.createElement('button');
      b.className = 'filter-btn';
      b.textContent = m[1];
      b.dataset.mode = m[0];
      b.addEventListener('click', function () { window.Theme.set(m[0]); });
      wrap.appendChild(b);
    });

    function sync() {
      const current = window.Theme.get();
      Array.prototype.forEach.call(wrap.children, function (b) {
        b.classList.toggle('active', b.dataset.mode === current);
      });
    }
    window.Theme.onChange(sync);
    sync();
  }

  function banner(html) {
    const div = document.createElement('div');
    div.className = 'banner';
    div.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M12 7.6v5.2M12 16.2v.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>' +
      '</svg><div>' + html + '</div>';
    document.getElementById('banners').appendChild(div);
  }

  function cap(s) {
    s = String(s || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

})();
