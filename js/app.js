/* ============================================================
   Loop Theory — app.js
   Storefront behaviour: marquee, filters, search, product grid,
   quick-view modal and the persistent cart drawer.
   Reads the catalog through Catalog (catalog.js), which serves it
   from Postgres or from the bundled data.js — this file cannot tell
   which, and does not need to.
   ============================================================ */

(function () {
  'use strict';

  const CART_KEY = 'lt-cart';

  /* Each category is its own page, so a category is a destination rather
     than a piece of in-page state. Filtering that never changes the URL
     cannot be linked to, bookmarked, or reached with the back button. */
  const CATEGORY_PAGES = {
    'All':       'index.html',
    'Rings':     'rings.html',
    'Necklaces': 'necklaces.html',
    'Earrings':  'earrings.html',
    'Bracelets': 'bracelets.html'
  };

  const el = {
    marquee:     document.getElementById('marquee'),
    filters:     document.getElementById('filters'),
    grid:        document.getElementById('grid'),
    heading:     document.querySelector('.section-head h2'),
    mainnav:     document.getElementById('mainnav'),
    search:      document.getElementById('searchInput'),
    overlay:     document.getElementById('overlay'),
    modal:       document.getElementById('modalContent'),
    cartOverlay: document.getElementById('cartOverlay'),
    drawer:      document.getElementById('drawer'),
    drawerItems: document.getElementById('drawerItems'),
    subtotal:    document.getElementById('subtotal'),
    cartCount:   document.getElementById('cartCount')
  };

  const state = {
    category: 'All',
    query: '',
    view: 'bag',      /* 'bag' | 'checkout' | 'done' */
    placed: null,
    cart: []          /* [{ id, qty }] — ordered by when each piece was first added */
  };

  /* ---------- helpers ---------- */

  function money(n) {
    return '$' + n.toLocaleString('en-US');
  }

  /* Product text now arrives from a database rather than a literal in
     the source, so it is escaped on the way into markup. */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* a photograph once the dashboard has one; the generated SVG until then */
  function media(p) {
    return p.photo
      ? '<img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" loading="lazy">'
      : p.svg;
  }

  function product(id) {
    return Catalog.get(id);
  }

  function line(id) {
    return state.cart.filter(function (l) { return l.id === id; })[0];
  }

  /* ---------- persistence ----------
     Rehydrated against the catalog, so a stale id left in localStorage
     by an older build is dropped instead of breaking the drawer. */

  function loadCart() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch (err) {
      saved = [];
    }
    if (!Array.isArray(saved)) saved = [];

    state.cart = saved.reduce(function (out, l) {
      if (l && product(l.id)) {
        out.push({ id: l.id, qty: Math.max(1, Math.min(99, parseInt(l.qty, 10) || 1)) });
      }
      return out;
    }, []);
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    } catch (err) {
      /* private mode, or a full quota — the cart still works for this visit */
    }
  }

  /* ---------- marquee ---------- */

  function renderMarquee() {
    const mark = '<svg width="5" height="5" viewBox="0 0 5 5" aria-hidden="true">' +
                 '<circle cx="2.5" cy="2.5" r="2.5" fill="var(--brass)"/></svg>';

    const run = MARQUEE.map(function (text) {
      return '<span>' + text + mark + '</span>';
    }).join('');

    /* Doubled: the scroll keyframe travels -50%, so the second copy
       is already in place when the first scrolls out. */
    el.marquee.innerHTML = run + run;
  }

  /* ---------- filters ---------- */

  function renderFilters() {
    el.filters.innerHTML = CATEGORIES.map(function (cat) {
      const on = cat === state.category ? ' active' : '';
      const here = cat === state.category ? ' aria-current="page"' : '';
      return '<a class="filter-btn' + on + '" href="' + CATEGORY_PAGES[cat] + '"' + here + '>' + cat + '</a>';
    }).join('');
  }

  /* The header nav is authored as links in each page. Marked active by
     destination, so it cannot drift out of step with the page you are on. */
  function syncNav() {
    if (!el.mainnav) return;
    const here = CATEGORY_PAGES[state.category];
    Array.prototype.forEach.call(el.mainnav.querySelectorAll('a'), function (a) {
      const on = a.getAttribute('href') === here;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /* ---------- grid ---------- */

  function visible() {
    const q = state.query.trim().toLowerCase();

    return Catalog.list().filter(function (p) {
      if (state.category !== 'All' && p.category !== state.category) return false;
      if (!q) return true;
      return (p.name + ' ' + p.category + ' ' + p.material + ' ' + p.finish + ' ' + p.desc)
        .toLowerCase().indexOf(q) > -1;
    });
  }

  function card(p) {
    return '' +
      '<article class="card">' +
        '<div class="card-media" data-open="' + p.id + '">' +
          '<span class="card-index">' + p.index + '</span>' +
          media(p) +
          '<button class="card-quick" data-open="' + p.id + '">Quick view</button>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="card-cat">' + esc(p.category) + '</div>' +
          '<h3 class="card-name">' + esc(p.name) + '</h3>' +
          '<div class="card-price">' +
            '<span class="now">' + money(p.price) + '</span>' +
            (p.was ? '<span class="was">' + money(p.was) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderGrid() {
    const items = visible();

    if (items.length) {
      el.grid.innerHTML = items.map(card).join('');
    } else {
      el.grid.innerHTML =
        '<div class="empty-cart" style="grid-column:1/-1;">' +
          'Nothing matches that search. Try another word, or ' +
          '<a class="remove-btn" href="index.html" style="margin-left:0;">see the whole collection</a>.' +
        '</div>';
    }

    if (el.heading) {
      el.heading.textContent = items.length + (items.length === 1 ? ' piece' : ' pieces') + ', live now';
    }
  }

  /* ---------- filter + search entry points ---------- */

  /* Kept as a global because older markup calls it inline. It navigates
     now rather than filtering in place. */
  function setFilter(cat) {
    const target = CATEGORY_PAGES[cat] || CATEGORY_PAGES.All;
    if (state.category !== cat) location.href = target;
  }

  function handleSearch(value) {
    state.query = value || '';
    renderGrid();
  }

  /* ---------- quick-view modal ---------- */

  function openModal(id) {
    const p = product(id);
    if (!p) return;

    el.modal.innerHTML = '' +
      '<button class="modal-close" data-close-modal aria-label="Close quick view">&#10005;</button>' +
      '<div class="modal-media">' + media(p) + '</div>' +
      '<div class="modal-body">' +
        '<span class="eyebrow">' + esc(p.category) + '</span>' +
        '<h2>' + esc(p.name) + '</h2>' +
        '<div class="modal-price">' + money(p.price) + '</div>' +
        /* Rendered even with no sale price, so the gap under the price
           is identical on every piece. */
        '<div class="modal-was">' + (p.was ? money(p.was) : '') + '</div>' +
        '<p class="modal-desc">' + esc(p.desc) + '</p>' +
        '<div class="modal-meta">' +
          '<span class="meta-pill">' + esc(p.material) + '</span>' +
          '<span class="meta-pill">' + esc(p.size) + '</span>' +
          '<span class="meta-pill">' + esc(p.finish) + '</span>' +
        '</div>' +
        '<button class="btn-primary modal-add" data-add="' + p.id + '">Add to bag</button>' +
      '</div>';

    el.overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    el.overlay.classList.remove('open');
    el.modal.innerHTML = '';
    if (!el.drawer.classList.contains('open')) document.body.style.overflow = '';
  }

  /* ---------- cart ---------- */

  function addToCart(id) {
    if (!product(id)) return;

    const existing = line(id);
    if (existing) existing.qty = Math.min(99, existing.qty + 1);
    else state.cart.push({ id: id, qty: 1 });

    saveCart();
    renderCart();
  }

  function changeQty(id, delta) {
    const existing = line(id);
    if (!existing) return;

    if (existing.qty + delta < 1) return removeFromCart(id);
    existing.qty = Math.min(99, existing.qty + delta);

    saveCart();
    renderCart();
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter(function (l) { return l.id !== id; });
    saveCart();
    renderCart();
  }

  function renderCart() {
    let count = 0, total = 0;

    if (state.view !== 'bag') {
      state.cart.forEach(function (l) {
        const p = product(l.id);
        if (!p) return;
        count += l.qty;
        total += p.price * l.qty;
      });
      if (state.view === 'checkout') renderCheckoutForm(); else renderPlaced();
      el.subtotal.textContent = money(total);
      el.cartCount.textContent = count;
      updateFoot();
      return;
    }

    const rows = state.cart.map(function (l) {
      const p = product(l.id);
      count += l.qty;
      total += p.price * l.qty;

      return '' +
        '<div class="drawer-item">' +
          '<div class="thumb">' + media(p) + '</div>' +
          '<div class="drawer-item-info">' +
            '<div class="nm">' + esc(p.name) + '</div>' +
            '<div class="px">' + money(p.price * l.qty) + '</div>' +
            '<div class="qty-row">' +
              '<button class="qty-btn" data-qty="-1" data-id="' + l.id + '" aria-label="One fewer">&minus;</button>' +
              '<span>' + l.qty + '</span>' +
              '<button class="qty-btn" data-qty="1" data-id="' + l.id + '" aria-label="One more">+</button>' +
              '<button class="remove-btn" data-remove="' + l.id + '">Remove</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    el.drawerItems.innerHTML = rows ||
      '<div class="empty-cart">Your bag is empty.<br>Pieces you add keep until you come back.</div>';

    el.subtotal.textContent = money(total);
    el.cartCount.textContent = count;
    updateFoot();
  }

  /* ---------- checkout ---------- */

  const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Ireland', 'Australia',
                     'New Zealand', 'Germany', 'France', 'Netherlands', 'Kenya', 'Other'];

  /* Delivery details are remembered per browser so a second order is not a
     second round of typing. They stay on this device except as part of an
     order the shopper actually places. */
  const DETAILS_KEY = 'lt-details';

  function readDetails() {
    try { return JSON.parse(localStorage.getItem(DETAILS_KEY) || '{}') || {}; }
    catch (err) { return {}; }
  }

  function readDetail(name) {
    const d = readDetails();
    return d[name] == null ? '' : d[name];
  }

  function saveDetails(d) {
    try { localStorage.setItem(DETAILS_KEY, JSON.stringify(d)); } catch (err) {}
  }

  function footButton() {
    return el.drawer.querySelector('.drawer-foot .btn-primary');
  }

  function updateFoot() {
    const btn = footButton();
    const subtotalRow = el.drawer.querySelector('.subtotal-row');
    if (!btn) return;

    btn.disabled = false;
    if (state.view === 'bag') {
      subtotalRow.style.display = '';
      btn.textContent = 'Checkout';
      btn.onclick = goToCheckout;
    } else if (state.view === 'checkout') {
      subtotalRow.style.display = '';
      btn.textContent = 'Place order';
      btn.onclick = submitOrder;
    } else {
      subtotalRow.style.display = 'none';
      btn.textContent = 'Continue shopping';
      btn.onclick = function () { state.view = 'bag'; renderCart(); closeCart(); };
    }
  }

  function goToCheckout() {
    if (!state.cart.length) return note('Your bag is empty.', 'warn');
    state.view = 'checkout';
    note('');
    renderCart();
    const first = el.drawerItems.querySelector('input');
    if (first) first.focus();
  }

  function field(name, label, opts) {
    opts = opts || {};
    const saved = esc(readDetail(name));
    const cls = 'co-field' + (opts.half ? ' half' : '');

    if (opts.options) {
      return '<label class="' + cls + '"><span>' + esc(label) + '</span>' +
        '<select name="' + name + '">' +
          opts.options.map(function (o) {
            return '<option value="' + esc(o) + '"' + (o === saved ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('') +
        '</select></label>';
    }

    return '<label class="' + cls + '"><span>' + esc(label) +
      (opts.optional ? ' <em>optional</em>' : '') + '</span>' +
      '<input name="' + name + '" type="' + (opts.type || 'text') + '" value="' + saved + '"' +
      (opts.type === 'email' ? ' autocomplete="email"' : '') + '></label>';
  }

  function renderCheckoutForm() {
    const units = state.cart.reduce(function (n, l) { return n + l.qty; }, 0);
    el.drawerItems.innerHTML =
      '<form class="co-form" id="checkoutForm" novalidate>' +
        '<button type="button" class="co-back" data-back>\u2190 Back to bag</button>' +
        '<p class="co-intro">' + units + (units === 1 ? ' piece' : ' pieces') +
          ', made to order and shipping in 2\u20134 weeks.</p>' +
        field('name', 'Full name') +
        field('email', 'Email', { type: 'email' }) +
        field('line1', 'Address') +
        field('line2', 'Apartment, suite', { optional: true }) +
        '<div class="co-row">' +
          field('city', 'City', { half: true }) +
          field('postal', 'Postcode', { half: true }) +
        '</div>' +
        field('country', 'Country', { options: COUNTRIES }) +
        field('note', 'Anything we should know', { optional: true }) +
      '</form>';
  }

  function renderPlaced() {
    const p = state.placed || {};
    const link = p.token ? 'order.html?ref=' + encodeURIComponent(p.token) : null;
    el.drawerItems.innerHTML =
      '<div class="co-done">' +
        '<div class="co-tick" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5l5.5 5.5L20 7" stroke="currentColor" ' +
          'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>' +
        '<h3>Order placed</h3>' +
        '<p>Your reference is <strong>' + esc(String(p.id || '').slice(0, 8)) + '</strong>. ' +
          'Nothing has been emailed and nothing has been charged \u2014 this records the order.</p>' +
        (link
          ? '<p><a class="co-link" href="' + link + '">View your order</a></p>' +
            '<p class="co-hint">Keep that link. It is the only way back to this order.</p>'
          : '') +
      '</div>';
  }

  function submitOrder() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    const details = {};
    Array.prototype.forEach.call(form.querySelectorAll('input, select, textarea'), function (f) {
      details[f.name] = f.value.trim();
    });

    const LABELS = { name: 'full name', email: 'email', line1: 'address', city: 'city' };
    const missing = Object.keys(LABELS).filter(function (k) { return !details[k]; });
    if (missing.length) {
      note('Still needed: ' + missing.map(function (k) { return LABELS[k]; }).join(', ') + '.', 'warn');
      const f = form.querySelector('[name="' + missing[0] + '"]');
      if (f) f.focus();
      return;
    }
    if (details.email.indexOf('@') < 1) {
      note('That email address does not look right.', 'warn');
      form.querySelector('[name="email"]').focus();
      return;
    }

    saveDetails(details);

    const btn = footButton();
    btn.disabled = true;
    btn.textContent = 'Placing order\u2026';
    note('');

    Catalog.createOrder({ items: state.cart, details: details })
      .then(function (res) {
        if (!res.stored) {
          note('Checkout is not connected yet \u2014 the database has not been set up (see db/schema.sql).', 'warn');
          btn.disabled = false;
          btn.textContent = 'Place order';
          return;
        }
        state.placed = res;
        state.cart = [];
        saveCart();
        state.view = 'done';
        renderCart();
      })
      .catch(function (err) {
        note('Could not place the order: ' + ((err && err.message) || err), 'warn');
        btn.disabled = false;
        btn.textContent = 'Place order';
      });
  }

  function note(text, kind) {
    let n = document.getElementById('drawerNote');
    if (!n) {
      n = document.createElement('p');
      n.id = 'drawerNote';
      el.subtotal.closest('.drawer-foot').insertBefore(n, el.subtotal.closest('.subtotal-row').nextSibling);
    }
    n.className = 'drawer-note' + (kind ? ' ' + kind : '');
    n.textContent = text;
  }

  function openCart() {
    el.drawer.classList.add('open');
    el.cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    el.drawer.classList.remove('open');
    el.cartOverlay.classList.remove('open');
    if (!el.overlay.classList.contains('open')) document.body.style.overflow = '';
  }

  /* ---------- events ----------
     Generated markup is handled by delegation, so a re-render never
     leaves a stale listener behind. */

  function bind() {
    el.grid.addEventListener('click', function (e) {
      const opener = e.target.closest('[data-open]');
      if (opener) openModal(opener.getAttribute('data-open'));
    });

    el.overlay.addEventListener('click', function (e) {
      if (e.target === el.overlay || e.target.closest('[data-close-modal]')) return closeModal();

      const add = e.target.closest('[data-add]');
      if (add) {
        addToCart(add.getAttribute('data-add'));
        closeModal();
        openCart();
      }
    });

    el.drawerItems.addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) {
        state.view = 'bag';
        note('');
        return renderCart();
      }

      const qty = e.target.closest('[data-qty]');
      if (qty) return changeQty(qty.getAttribute('data-id'), parseInt(qty.getAttribute('data-qty'), 10));

      const remove = e.target.closest('[data-remove]');
      if (remove) removeFromCart(remove.getAttribute('data-remove'));
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (el.overlay.classList.contains('open')) closeModal();
      else if (el.drawer.classList.contains('open')) closeCart();
    });
  }

  /* ---------- boot ---------- */

  function init() {
    if (typeof Catalog === 'undefined') {
      console.error('[Loop Theory] catalog.js did not load — no catalog to render.');
      return;
    }

    /* rings.html says data-category="Rings"; index.html says nothing and
       shows everything. */
    const declared = document.body.getAttribute('data-category');
    if (declared && CATEGORIES.indexOf(declared) > -1) state.category = declared;

    /* Everything that does not depend on the catalog paints immediately,
       so a slow database costs the shopper a grid and not a blank page. */
    renderMarquee();
    renderFilters();
    syncNav();
    bind();

    Catalog.ready.then(function () {
      loadCart();      /* prices and stale-id pruning both need the catalog */
      renderGrid();
      renderCart();
    });
  }

  /* index.html calls these from inline handlers in the header and footer. */
  window.setFilter = setFilter;
  window.handleSearch = handleSearch;
  window.openCart = openCart;
  window.closeCart = closeCart;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.addToCart = addToCart;
  window.checkout = goToCheckout;

  document.addEventListener('DOMContentLoaded', init);
})();
