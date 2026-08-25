/* ============================================================
   Loop Theory — order.js
   One order, looked up by the token issued at checkout.

   The shopper is not signed in and cannot read the orders table.
   get_order() in the database takes the token and returns exactly
   one order, which is why that token is a uuid and why this page
   is the only place it is useful.
   ============================================================ */

(function () {
  'use strict';

  const STAGES = ['pending', 'paid', 'shipped'];

  const STATUS_COPY = {
    pending:   { label: 'Received',  note: 'With our maker network. Pieces ship in 2–4 weeks.' },
    paid:      { label: 'Paid',      note: 'Payment recorded. Your piece is being made.' },
    shipped:   { label: 'Shipped',   note: 'On its way. Tracking follows by email.' },
    cancelled: { label: 'Cancelled', note: 'This order was cancelled. Nothing will be sent.' }
  };

  const title = document.getElementById('pageTitle');
  const lede = document.getElementById('pageLede');
  const main = document.getElementById('main');

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return '$' + Number(n).toLocaleString('en-US');
  }

  function when(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-US',
        { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (err) {
      return String(iso || '').slice(0, 10);
    }
  }

  function fail(heading, body) {
    title.textContent = heading;
    lede.textContent = '';
    main.innerHTML = '<section><p>' + body + '</p>' +
      '<p><a class="btn-primary" href="index.html">Back to the collection</a></p></section>';
  }

  function track(status) {
    if (status === 'cancelled') {
      return '<div class="track cancelled"><span class="track-step done">Cancelled</span></div>';
    }
    const at = STAGES.indexOf(status);
    return '<div class="track">' + STAGES.map(function (s, i) {
      const cls = i < at ? 'done' : (i === at ? 'now' : '');
      return '<span class="track-step ' + cls + '">' + STATUS_COPY[s].label + '</span>';
    }).join('') + '</div>';
  }

  function render(o) {
    const copy = STATUS_COPY[o.status] || STATUS_COPY.pending;

    title.textContent = copy.label;
    lede.textContent = copy.note;

    const items = (o.items || []).map(function (i) {
      return '<tr>' +
        '<td>' + esc(i.name) + '</td>' +
        '<td class="num">' + i.qty + '</td>' +
        '<td class="num">' + money(i.unit_price) + '</td>' +
        '<td class="num">' + money(i.unit_price * i.qty) + '</td>' +
        '</tr>';
    }).join('');

    const ship = [o.ship_name, o.ship_line1, o.ship_line2, o.ship_city, o.ship_postal, o.ship_country]
      .filter(Boolean).map(esc).join('<br>');

    main.innerHTML =
      '<section>' +
        track(o.status) +
        '<dl class="facts" style="margin-top:28px;">' +
          '<div class="fact"><dt>Reference</dt><dd>' + esc(String(o.id).slice(0, 8)) + '</dd></div>' +
          '<div class="fact"><dt>Placed</dt><dd>' + esc(when(o.created_at)) + '</dd></div>' +
          '<div class="fact"><dt>Total</dt><dd>' + money(o.subtotal) + '</dd></div>' +
        '</dl>' +
      '</section>' +

      '<section>' +
        '<h2>What you ordered</h2>' +
        '<div class="table-scroll"><table class="order-table">' +
          '<thead><tr><th>Piece</th><th class="num">Qty</th><th class="num">Each</th><th class="num">Total</th></tr></thead>' +
          '<tbody>' + items + '</tbody>' +
          '<tfoot><tr><td colspan="3">Subtotal</td><td class="num">' + money(o.subtotal) + '</td></tr></tfoot>' +
        '</table></div>' +
      '</section>' +

      '<section>' +
        '<h2>Delivery</h2>' +
        (ship ? '<p class="ship">' + ship + '</p>' : '<p>No address recorded.</p>') +
        (o.email ? '<p>Updates go to <strong>' + esc(o.email) + '</strong>.</p>' : '') +
        (o.note ? '<h3>Your note</h3><p>' + esc(o.note) + '</p>' : '') +
      '</section>' +

      '<section>' +
        '<h2>Something wrong?</h2>' +
        '<p>Returns run 30 days from delivery — the terms are on ' +
          '<a href="shipping.html">Shipping &amp; Returns</a>. Reply to your order email to start one, ' +
          'quoting the reference above.</p>' +
      '</section>';
  }

  const ref = new URLSearchParams(location.search).get('ref');

  if (!ref) {
    fail('No order reference',
      'This page needs the link you were given at checkout — it carries the reference that ' +
      'identifies your order. Orders cannot be looked up by email address, by design.');
    return;
  }

  if (!window.LTSupabase || !window.LTSupabase.configured()) {
    fail('Orders are not connected yet',
      'This site is running on its bundled catalog, with no database behind it, so there are no ' +
      'orders to look up.');
    return;
  }

  window.Catalog.getOrder(ref)
    .then(render)
    .catch(function (err) {
      const m = (err && err.message) || String(err);
      if (/no order with that reference/i.test(m)) {
        fail('We cannot find that order',
          'The reference in this link does not match an order. Check you have the whole link — ' +
          'it is easy to lose the end of it when copying.');
      } else {
        fail('Could not load your order', esc(m));
      }
    });

})();
