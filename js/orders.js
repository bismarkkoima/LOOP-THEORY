/* ============================================================
   Loop Theory — orders.js
   The admin order list.

   Reading orders is permitted by the "admins read orders" policy
   and moving one along goes through set_order_status(), which
   checks is_admin() itself. The gate below decides what this page
   offers; it is not what protects the data.
   ============================================================ */

(function () {
  'use strict';

  const STATUSES = ['all', 'pending', 'paid', 'shipped', 'cancelled'];

  /* The same rules set_order_status() enforces. Kept here so the dashboard
     offers only the moves that will be accepted — the database is still
     what decides, and a stale page is refused rather than obeyed. */
  const MOVES = {
    pending:   ['paid', 'cancelled'],
    paid:      ['shipped', 'cancelled'],
    shipped:   [],
    cancelled: []
  };

  const TERMINAL = {
    shipped:   'Shipped orders are finished — there is nothing further to move.',
    cancelled: 'Cancelled orders are finished. The pieces went back into stock, ' +
               'and may since have sold, so this one cannot be reopened.'
  };

  const els = {
    filter: document.getElementById('statusFilter'),
    count: document.getElementById('count'),
    list: document.getElementById('list'),
    banners: document.getElementById('banners'),
    themeSlot: document.getElementById('themeSlot'),
    toasts: document.getElementById('toasts')
  };

  const state = { status: 'all', orders: [], open: null, busy: null };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) { return 'KSh ' + Number(n).toLocaleString('en-KE'); }

  /* Orders from before delivery was priced separately have no total. */
  function total(o) { return o.total == null ? Number(o.subtotal) : Number(o.total); }

  function when(iso) {
    try {
      return new Date(iso).toLocaleString('en-US',
        { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (err) { return String(iso || '').slice(0, 16); }
  }

  function toast(msg, kind, ms) {
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    els.toasts.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 4500);
  }

  function banner(html, kind) {
    const b = document.createElement('div');
    b.className = 'banner' + (kind ? ' ' + kind : '');
    b.innerHTML = html;
    els.banners.appendChild(b);
  }

  /* ---------- rendering ---------- */

  function renderFilter() {
    els.filter.innerHTML = STATUSES.map(function (s) {
      const on = s === state.status ? ' active' : '';
      return '<button class="filter-btn' + on + '" data-status="' + s + '">' +
        (s === 'all' ? 'All' : s) + '</button>';
    }).join('');
  }

  function renderList() {
    if (!state.orders.length) {
      els.list.innerHTML = '<div class="empty-cart">No orders' +
        (state.status === 'all' ? ' yet.' : ' with that status.') + '</div>';
      els.count.textContent = '0 orders';
      return;
    }

    els.count.textContent = state.orders.length +
      (state.orders.length === 1 ? ' order' : ' orders');

    els.list.innerHTML = state.orders.map(function (o) {
      const open = state.open === o.id;
      const who = o.ship_name || o.email || 'No name given';
      const where = [o.ship_city, o.ship_country].filter(Boolean).join(', ');

      return '<div class="order-card">' +
        '<button class="order-row" data-open="' + esc(o.id) + '" aria-expanded="' + open + '">' +
          '<span class="order-ref">' + esc(String(o.id).slice(0, 8)) + '</span>' +
          '<span class="order-who">' +
            '<span class="nm">' + esc(who) + '</span><br>' +
            '<span class="sub">' + esc(when(o.created_at)) + (where ? ' · ' + esc(where) : '') + '</span>' +
          '</span>' +
          '<span class="order-total">' + money(total(o)) + '</span>' +
          '<span class="pill ' + esc(o.status) + '">' + esc(o.status) + '</span>' +
        '</button>' +
        (open ? '<div class="order-detail" id="detail-' + esc(o.id) + '">Loading…</div>' : '') +
      '</div>';
    }).join('');
  }

  function renderDetail(o, items) {
    const box = document.getElementById('detail-' + o.id);
    if (!box) return;

    const rows = items.map(function (i) {
      return '<tr><td>' + esc(i.name) + '</td>' +
        '<td class="num">' + i.qty + '</td>' +
        '<td class="num">' + money(i.unit_price) + '</td>' +
        '<td class="num">' + money(i.unit_price * i.qty) + '</td></tr>';
    }).join('');

    const ship = [o.ship_name, o.ship_city, o.ship_country].filter(Boolean).map(esc).join(', ');

    box.innerHTML =
      '<h4>Lines</h4>' +
      '<div class="table-scroll"><table class="order-table">' +
        '<thead><tr><th>Piece</th><th class="num">Qty</th><th class="num">Each</th><th class="num">Total</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '<tfoot>' +
          '<tr><td colspan="3">Subtotal</td><td class="num">' + money(o.subtotal) + '</td></tr>' +
          '<tr><td colspan="3">Delivery</td><td class="num">' +
            (Number(o.shipping) ? money(o.shipping) : 'Free') + '</td></tr>' +
          '<tr class="foot-total"><td colspan="3">Total</td><td class="num">' +
            money(total(o)) + '</td></tr>' +
        '</tfoot>' +
      '</table></div>' +

      '<h4>Customer</h4>' +
      '<p style="margin:0;font-size:13.5px;color:var(--paper-dim);line-height:1.7;">' +
        (o.email ? esc(o.email) + '<br>' : '') + (ship || 'No address recorded') +
      '</p>' +

      '<h4>Move it along</h4>' +
      moveActions(o) +

      '<h4>History</h4>' +
      '<div class="order-history" id="history-' + esc(o.id) + '">Loading…</div>' +

      '<h4>Customer link</h4>' +
      '<p style="margin:0;font-size:12.5px;color:var(--paper-dim);word-break:break-all;">' +
        'order.html?ref=' + esc(o.token) +
      '</p>';
  }

  /* Only the moves the database will accept, and a plain sentence where
     there are none, rather than a row of buttons that all refuse. */
  function moveActions(o) {
    const next = MOVES[o.status] || [];

    if (!next.length) {
      return '<p class="terminal-note">' +
        esc(TERMINAL[o.status] || 'There is nothing further to move.') + '</p>';
    }

    return '<div class="status-actions">' +
      next.map(function (s) {
        return '<button data-set="' + esc(o.id) + '" data-status="' + s + '">' + s + '</button>';
      }).join('') +
      '</div>';
  }

  function renderHistory(orderId, events) {
    const box = document.getElementById('history-' + orderId);
    if (!box) return;

    if (!events.length) {
      box.innerHTML = '<p class="terminal-note">Nothing recorded. ' +
        'This order predates the history table.</p>';
      return;
    }

    box.innerHTML = '<ol class="history">' + events.map(function (e) {
      const move = e.from_status
        ? esc(e.from_status) + ' → ' + esc(e.to_status)
        : esc(e.to_status);

      return '<li>' +
        '<span class="h-move">' + move + '</span>' +
        '<span class="h-who">' + esc(e.actor || 'the shopper') + '</span>' +
        '<span class="h-when">' + esc(when(e.created_at)) + '</span>' +
        (e.note ? '<span class="h-note">' + esc(e.note) + '</span>' : '') +
      '</li>';
    }).join('') + '</ol>';
  }

  /* ---------- data ---------- */

  function load() {
    els.count.textContent = 'Loading…';
    return window.Catalog.listOrders({ status: state.status })
      .then(function (rows) {
        state.orders = rows;
        renderList();
      })
      .catch(function (err) {
        els.count.textContent = '';
        const m = (err && err.message) || String(err);
        els.list.innerHTML = '<div class="empty-cart">Could not load orders.<br>' + esc(m) + '</div>';
      });
  }

  function openOrder(id) {
    state.open = state.open === id ? null : id;
    renderList();
    if (!state.open) return;

    const o = state.orders.filter(function (x) { return x.id === id; })[0];
    window.Catalog.orderItems(id)
      .then(function (items) {
        renderDetail(o, items);
        return loadHistory(id);
      })
      .catch(function (err) {
        const box = document.getElementById('detail-' + id);
        if (box) box.textContent = 'Could not load lines: ' + ((err && err.message) || err);
      });
  }

  function loadHistory(id) {
    return window.Catalog.orderEvents(id)
      .then(function (events) { renderHistory(id, events); })
      .catch(function (err) {
        const box = document.getElementById('history-' + id);
        if (box) box.textContent = 'Could not load history: ' + ((err && err.message) || err);
      });
  }

  function move(id, status) {
    if (state.busy) return;
    state.busy = id;

    window.Catalog.setOrderStatus(id, status)
      .then(function () {
        const o = state.orders.filter(function (x) { return x.id === id; })[0];
        if (o) o.status = status;
        toast('Order ' + String(id).slice(0, 8) + ' is now ' + status + '.', 'ok');
        state.busy = null;
        /* A status filter is showing a set this order may have just left. */
        if (state.status !== 'all') {
          state.open = null;
          return load();
        }
        renderList();
        if (state.open === id) {
          window.Catalog.orderItems(id).then(function (items) {
            renderDetail(o, items);
            return loadHistory(id);
          });
        }
      })
      .catch(function (err) {
        state.busy = null;
        toast('Could not update: ' + ((err && err.message) || err), 'err', 8000);
      });
  }

  /* ---------- events ---------- */

  document.addEventListener('click', function (e) {
    const f = e.target.closest('[data-status]:not([data-set])');
    if (f && f.parentElement === els.filter) {
      state.status = f.getAttribute('data-status');
      state.open = null;
      renderFilter();
      return load();
    }

    const setter = e.target.closest('[data-set]');
    if (setter) return move(setter.getAttribute('data-set'), setter.getAttribute('data-status'));

    const row = e.target.closest('[data-open]');
    if (row) return openOrder(row.getAttribute('data-open'));
  });

  /* ---------- boot ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    window.Theme.mount(els.themeSlot);
    renderFilter();

    if (!window.LTSupabase.configured()) {
      els.count.textContent = '';
      banner('Orders live in the database, and no database is configured yet. ' +
             'Fill in <code>js/config.js</code> and run <code>db/schema.sql</code> — ' +
             '<a href="db-check.html">the connection check</a> shows what is missing.', 'warn');
      els.list.innerHTML = '<div class="empty-cart">Nothing to show without a database.</div>';
      return;
    }

    window.Auth.guard({ admin: true }).then(function (gate) {
      if (!gate.ok) {
        /* Signed in, but not on the allowlist. guard() has already sent
           anyone who is not signed in at all to the login page. */
        if (gate.forbidden) {
          els.count.textContent = '';
          banner('That account is not an admin, so orders are not shown.', 'warn');
          els.list.innerHTML = '<div class="empty-cart">Nothing to show.</div>';
        }
        return;
      }
      if (gate.unsecured) {
        banner('No admin allowlist is set, so every signed-in account can see orders. ' +
               'Add addresses to <code>adminEmails</code>, and to the <code>admins</code> table.', 'warn');
      }
      return load();
    }).catch(function (err) {
      console.error('[orders] boot failed', err);
      toast('Could not start: ' + err.message, 'err', 9000);
    });
  });

})();
