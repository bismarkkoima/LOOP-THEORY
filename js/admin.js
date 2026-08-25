/* ============================================================
   Loop Theory — admin.js
   Photo dashboard: one photo per product, uploaded by drop or
   picker, removed with an undo window.

   Talks to PhotoStore (storage), Auth (identity) and Theme
   (palette) and knows nothing about Supabase, IndexedDB or OAuth.
   ============================================================ */

(function () {

  const state = {
    category: 'All',
    query: '',
    onlyMissing: false,
    busy: new Set()
  };

  const els = {};
  let pickerTarget = null;   /* product id, or null for a bulk pick */

  function $(id) { return document.getElementById(id); }

  /* ---------- boot ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    ['themeSlot', 'identity', 'banners', 'dropzone', 'filePicker', 'adminFilters',
     'adminSearch', 'onlyMissing', 'stats', 'adminGrid', 'toasts', 'modePill']
      .forEach(function (id) { els[id] = $(id); });

    window.Theme.mount(els.themeSlot);

    window.Auth.guard({ admin: true }).then(function (gate) {
      if (!gate.ok) {
        if (gate.forbidden) renderForbidden();
        return;   /* guard() has already redirected to login */
      }
      renderIdentity();
      if (gate.unsecured) bannerUnsecured();
      return window.PhotoStore.ready.then(function () {
        if (window.PhotoStore.degraded) bannerDegraded();
        renderModePill();
        bindDropzone();
        bindToolbar();
        window.PhotoStore.onChange(render);
        render();
      });
    }).catch(function (err) {
      console.error('[admin] boot failed', err);
      toast('Could not start the dashboard: ' + err.message, 'err');
    });
  });

  /* ---------- identity + banners ---------- */

  function renderIdentity() {
    const user = window.Auth.user;
    if (!user) {
      els.identity.innerHTML = '<span class="tag">Not signed in</span>';
      return;
    }
    const img = user.avatar
      ? '<img class="avatar" src="' + esc(user.avatar) + '" alt="" referrerpolicy="no-referrer">'
      : '<span class="avatar avatar-fallback">' + esc((user.name || '?').charAt(0).toUpperCase()) + '</span>';
    els.identity.innerHTML =
      '<a class="linkish" href="account.html">' + esc(user.name) + '</a>' + img;
  }

  function renderModePill() {
    const supa = window.PhotoStore.mode === 'supabase';
    els.modePill.className = supa ? 'tag tag-verdigris' : 'tag';
    els.modePill.textContent = supa ? 'Supabase' : 'This browser only';
    els.modePill.title = supa
      ? 'Photos are stored in your Supabase bucket.'
      : 'Photos are stored in this browser via IndexedDB. Add Supabase credentials to js/config.js to share them.';
  }

  function banner(html) {
    const div = document.createElement('div');
    div.className = 'banner';
    div.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M12 7.6v5.2M12 16.2v.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>' +
      '</svg><div>' + html + '</div>';
    els.banners.appendChild(div);
  }

  function bannerUnsecured() {
    banner(
      '<strong>This dashboard is not protected.</strong> No Supabase project is configured, ' +
      'so there is no Google sign-in and no account check — anyone who opens this page can ' +
      'change photos. Photos are also kept in this browser only. Add your project URL and ' +
      'anon key to <code>js/config.js</code> to turn on sign-in and shared storage.'
    );
  }

  function bannerDegraded() {
    banner(
      '<strong>Supabase did not respond.</strong> Falling back to browser storage for now — ' +
      'uploads made here will not reach your bucket. (' + esc(window.PhotoStore.degraded) + ')'
    );
  }

  function renderForbidden() {
    const user = window.Auth.user || {};
    document.querySelector('main').innerHTML =
      '<div class="empty-state">' +
      '<h2 style="font-family:var(--display);font-weight:450;font-size:26px;margin:0 0 12px;">' +
      'Not an admin account</h2>' +
      '<p style="max-width:440px;margin:0 auto 22px;">You are signed in as <b>' +
      esc(user.email || 'unknown') + '</b>, which is not on the admin list in ' +
      '<code>js/config.js</code>.</p>' +
      '<button class="btn-ghost" id="foSignOut">Sign out</button></div>';
    $('foSignOut').addEventListener('click', function () {
      window.Auth.signOut().then(function () { location.href = 'login.html'; });
    });
  }

  /* ---------- toolbar ---------- */

  function bindToolbar() {
    window.CATEGORIES.forEach(function (cat) {
      const b = document.createElement('button');
      b.className = 'filter-btn' + (cat === state.category ? ' active' : '');
      b.textContent = cat;
      b.addEventListener('click', function () {
        state.category = cat;
        Array.prototype.forEach.call(els.adminFilters.children, function (el) {
          el.classList.toggle('active', el === b);
        });
        render();
      });
      els.adminFilters.appendChild(b);
    });

    els.adminSearch.addEventListener('input', function () {
      state.query = this.value.trim().toLowerCase();
      render();
    });

    els.onlyMissing.addEventListener('change', function () {
      state.onlyMissing = this.checked;
      render();
    });
  }

  /* ---------- upload plumbing ---------- */

  function bindDropzone() {
    els.dropzone.addEventListener('click', function () {
      pickerTarget = null;
      els.filePicker.multiple = true;
      els.filePicker.click();
    });

    els.filePicker.addEventListener('change', function () {
      const files = Array.prototype.slice.call(this.files || []);
      this.value = '';
      if (!files.length) return;
      if (pickerTarget) uploadTo(pickerTarget, files[0]);
      else distribute(files);
    });

    dropTarget(els.dropzone, function (files) { distribute(files); });
  }

  /* Wires dragover/dragleave/drop onto an element and calls back
     with the dropped files. Returns nothing; safe to call per card. */
  function dropTarget(el, onFiles) {
    ['dragenter', 'dragover'].forEach(function (evt) {
      el.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('drag');
      });
    });
    ['dragleave', 'dragend'].forEach(function (evt) {
      el.addEventListener(evt, function (e) {
        e.stopPropagation();
        el.classList.remove('drag');
      });
    });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drag');
      const files = Array.prototype.slice.call(e.dataTransfer && e.dataTransfer.files || []);
      if (files.length) onFiles(files);
    });
  }

  function norm(s) {
    return String(s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/g, '');
  }

  /* A bulk drop is matched by filename: "lt-03.jpg" or
     "Orbit Pendant.png" both find their product. Anything that
     matches nothing is reported rather than guessed at — silently
     attaching a photo to the wrong ring is worse than a warning. */
  function distribute(files) {
    const unmatched = [];
    let matched = 0;

    files.forEach(function (file) {
      const key = norm(file.name);
      const hit = window.PRODUCTS.filter(function (p) {
        return norm(p.id) === key || norm(p.name) === key;
      })[0];
      if (hit) { matched++; uploadTo(hit.id, file); }
      else unmatched.push(file.name);
    });

    if (unmatched.length) {
      toast(
        unmatched.length + ' file' + (unmatched.length > 1 ? 's' : '') +
        ' did not match a product by name (' + esc(unmatched.slice(0, 3).join(', ')) +
        (unmatched.length > 3 ? ', …' : '') + '). Drop onto a specific piece instead, ' +
        'or rename to its id — lt-01 … lt-20.', 'err', 9000
      );
    }
    if (!matched && !unmatched.length) toast('Nothing to upload.', 'err');
  }

  /* Catalog is only present once a database is configured; without one
     the photo lives in this browser and there is no row to update. A
     failure here must not lose the upload, so it is reported and swallowed. */
  function linkPhoto(productId, url) {
    if (!window.Catalog || !window.Catalog.setPhoto) return Promise.resolve();
    return window.Catalog.setPhoto(productId, url).catch(function (err) {
      toast('Photo saved, but the catalog row was not updated: ' + esc(err.message), 'err', 9000);
    });
  }

  function uploadTo(productId, file) {
    state.busy.add(productId);
    render();
    window.PhotoStore.put(productId, file).then(function (record) {
      /* The bucket now holds the file; point the catalog row at it, or
         the storefront will never know the photograph exists. */
      return linkPhoto(productId, record && record.url).then(function () {
        state.busy.delete(productId);
        render();
        const p = productById(productId);
        toast('Photo set for ' + esc(p ? p.name : productId) + '.', 'ok');
      });
    }).catch(function (err) {
      state.busy.delete(productId);
      render();
      toast(esc(err.message), 'err', 8000);
    });
  }

  /* The blob is pulled back out before the delete so Undo has
     something to restore — once removed, the object URL is
     revoked and the bytes are gone. */
  function removeFrom(productId) {
    const record = window.PhotoStore.get(productId);
    const product = productById(productId);
    if (!record) return;

    state.busy.add(productId);
    render();

    fetch(record.url).then(function (r) { return r.blob(); }).catch(function () { return null; })
      .then(function (blob) {
        return window.PhotoStore.remove(productId).then(function () {
          return linkPhoto(productId, null);
        }).then(function () {
          state.busy.delete(productId);
          render();
          const label = product ? product.name : productId;
          if (!blob) { toast('Photo removed from ' + esc(label) + '.', 'ok'); return; }
          toast('Photo removed from ' + esc(label) + '.', 'ok', 6500, {
            label: 'Undo',
            run: function () {
              const restored = new File([blob], record.name || 'restored.jpg',
                { type: blob.type || record.type || 'image/jpeg' });
              uploadTo(productId, restored);
            }
          });
        });
      }).catch(function (err) {
        state.busy.delete(productId);
        render();
        toast(esc(err.message), 'err', 8000);
      });
  }

  function productById(id) {
    return window.PRODUCTS.filter(function (p) { return p.id === id; })[0] || null;
  }

  /* ---------- render ---------- */

  function visible() {
    return window.PRODUCTS.filter(function (p) {
      if (state.category !== 'All' && p.category !== state.category) return false;
      if (state.onlyMissing && window.PhotoStore.get(p.id)) return false;
      if (!state.query) return true;
      return (p.name + ' ' + p.category + ' ' + p.id + ' ' + p.material)
        .toLowerCase().indexOf(state.query) > -1;
    });
  }

  function render() {
    const rows = visible();
    const total = window.PRODUCTS.length;
    const withPhoto = window.PRODUCTS.filter(function (p) {
      return !!window.PhotoStore.get(p.id);
    }).length;

    els.stats.innerHTML =
      '<b>' + withPhoto + '</b> of ' + total + ' pieces have a photo' +
      (rows.length !== total ? ' &nbsp;·&nbsp; showing ' + rows.length : '');

    els.adminGrid.innerHTML = '';

    if (!rows.length) {
      els.adminGrid.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1;">No pieces match that filter.</div>';
      return;
    }

    rows.forEach(function (p) { els.adminGrid.appendChild(card(p)); });
  }

  function card(p) {
    const photo = window.PhotoStore.get(p.id);
    const busy = state.busy.has(p.id);

    const el = document.createElement('article');
    el.className = 'p-card' + (busy ? ' busy' : '');

    el.innerHTML =
      '<div class="p-thumb">' +
        '<span class="p-index">' + esc(p.index) + '</span>' +
        '<span class="p-flag' + (photo ? ' has' : '') + '">' +
          (photo ? 'Photo' : 'Artwork') + '</span>' +
        (photo
          ? '<img src="' + esc(photo.url) + '" alt="' + esc(p.name) + '" loading="lazy">'
          : p.svg) +
        '<div class="p-overlay">' +
          '<button class="p-btn" data-act="pick">' + (photo ? 'Replace' : 'Upload') + '</button>' +
          (photo ? '<button class="p-btn danger" data-act="del">Remove</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="p-body">' +
        '<div class="p-cat">' + esc(p.category) + '</div>' +
        '<h3 class="p-name">' + esc(p.name) + '</h3>' +
        '<div class="p-sub">$' + p.price + ' · ' +
          (photo ? esc(window.PhotoStore.formatSize(photo.size)) : esc(p.material)) +
        '</div>' +
      '</div>';

    el.querySelector('[data-act="pick"]').addEventListener('click', function (e) {
      e.stopPropagation();
      pickerTarget = p.id;
      els.filePicker.multiple = false;
      els.filePicker.click();
    });

    const del = el.querySelector('[data-act="del"]');
    if (del) {
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        removeFrom(p.id);
      });
    }

    dropTarget(el, function (files) { uploadTo(p.id, files[0]); });
    return el;
  }

  /* ---------- toasts ---------- */

  function toast(html, kind, ms, action) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.innerHTML = '<span>' + html + '</span>';

    if (action) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = action.label;
      btn.addEventListener('click', function () {
        clearTimeout(timer);
        el.remove();
        action.run();
      });
      el.appendChild(btn);
    }

    els.toasts.appendChild(el);
    const timer = setTimeout(function () { el.remove(); }, ms || 4200);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

})();
