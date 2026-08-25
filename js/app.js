/* ============================================================
   Loop Theory — app.js
   Storefront behaviour: marquee, filters, search, product grid,
   quick-view modal and the persistent cart drawer.
   Depends on window.CATEGORIES / MARQUEE / PRODUCTS from data.js.
   ============================================================ */

(function () {
  'use strict';

  const CART_KEY = 'lt-cart';

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
    cart: []          /* [{ id, qty }] — ordered by when each piece was first added */
  };

  /* ---------- helpers ---------- */

  function money(n) {
    return '$' + n.toLocaleString('en-US');
  }

  function product(id) {
    return PRODUCTS.filter(function (p) { return p.id === id; })[0];
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
      return '<button class="filter-btn' + on + '" data-filter="' + cat + '">' + cat + '</button>';
    }).join('');
  }

  /* The header nav is authored in index.html with inline onclick handlers,
     so its active state is synced from the filter each button declares. */
  function syncNav() {
    const buttons = el.mainnav.querySelectorAll('button');
    Array.prototype.forEach.call(buttons, function (btn) {
      const match = /setFilter\('([^']+)'\)/.exec(btn.getAttribute('onclick') || '');
      btn.classList.toggle('active', !!match && match[1] === state.category);
    });
  }

  /* ---------- grid ---------- */

  function visible() {
    const q = state.query.trim().toLowerCase();

    return PRODUCTS.filter(function (p) {
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
          p.svg +
          '<button class="card-quick" data-open="' + p.id + '">Quick view</button>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="card-cat">' + p.category + '</div>' +
          '<h3 class="card-name">' + p.name + '</h3>' +
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
          '<button class="remove-btn" data-reset style="margin-left:0;">see everything</button>.' +
        '</div>';
    }

    if (el.heading) {
      el.heading.textContent = items.length + (items.length === 1 ? ' piece' : ' pieces') + ', live now';
    }
  }

  /* ---------- filter + search entry points ---------- */

  function setFilter(cat) {
    state.category = CATEGORIES.indexOf(cat) > -1 ? cat : 'All';
    renderFilters();
    syncNav();
    renderGrid();
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
      '<div class="modal-media">' + p.svg + '</div>' +
      '<div class="modal-body">' +
        '<span class="eyebrow">' + p.category + '</span>' +
        '<h2>' + p.name + '</h2>' +
        '<div class="modal-price">' + money(p.price) + '</div>' +
        /* Rendered even with no sale price, so the gap under the price
           is identical on every piece. */
        '<div class="modal-was">' + (p.was ? money(p.was) : '') + '</div>' +
        '<p class="modal-desc">' + p.desc + '</p>' +
        '<div class="modal-meta">' +
          '<span class="meta-pill">' + p.material + '</span>' +
          '<span class="meta-pill">' + p.size + '</span>' +
          '<span class="meta-pill">' + p.finish + '</span>' +
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

    const rows = state.cart.map(function (l) {
      const p = product(l.id);
      count += l.qty;
      total += p.price * l.qty;

      return '' +
        '<div class="drawer-item">' +
          '<div class="thumb">' + p.svg + '</div>' +
          '<div class="drawer-item-info">' +
            '<div class="nm">' + p.name + '</div>' +
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
    el.filters.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-filter]');
      if (btn) setFilter(btn.getAttribute('data-filter'));
    });

    el.grid.addEventListener('click', function (e) {
      const opener = e.target.closest('[data-open]');
      if (opener) return openModal(opener.getAttribute('data-open'));

      if (e.target.closest('[data-reset]')) {
        el.search.value = '';
        handleSearch('');
        setFilter('All');
      }
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
    if (typeof PRODUCTS === 'undefined') {
      console.error('[Loop Theory] data.js did not load — no catalog to render.');
      return;
    }

    loadCart();
    renderMarquee();
    renderFilters();
    syncNav();
    renderGrid();
    renderCart();
    bind();
  }

  /* index.html calls these from inline handlers in the header and footer. */
  window.setFilter = setFilter;
  window.handleSearch = handleSearch;
  window.openCart = openCart;
  window.closeCart = closeCart;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.addToCart = addToCart;

  document.addEventListener('DOMContentLoaded', init);
})();
