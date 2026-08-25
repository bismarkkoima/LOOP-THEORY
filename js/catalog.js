/* ============================================================
   Loop Theory — catalog.js
   The product catalog. One interface, swappable backend.

     Catalog.mode                    'supabase' | 'local'
     Catalog.ready                   Promise<[product]>
     Catalog.list()                  -> [product]
     Catalog.get(id)                 -> product | null
     Catalog.createOrder(o)          -> Promise<{ id, stored }>

   Same arrangement as store.js: the backend is chosen once at
   load. With a Supabase URL and anon key in js/config.js the
   catalog is read from Postgres; without them it falls back to
   the bundled catalog in data.js. app.js only ever touches
   Catalog and never learns which is in use.

   The fallback is not just for first-run convenience — if the
   database is unreachable mid-deploy, the storefront still
   renders rather than showing an empty shop.
   ============================================================ */

(function () {

  const TABLE = 'products';

  let mode = 'local';
  let items = [];

  /* ---------- row -> product ----------
     Handed to the same builder data.js uses for its own catalog,
     so a product from Postgres is indistinguishable from a
     bundled one — including artwork, which is redrawn from
     `metal` and `art` rather than stored. */

  function fromRow(row, i) {
    return window.LTmakeProduct({
      id: row.id,
      position: row.position != null ? row.position : i + 1,
      name: row.name,
      category: row.category,
      price: row.price,
      was: row.was,
      desc: row.description,
      metal: row.metal,
      art: row.art,
      size: row.size,
      finish: row.finish,
      photo: row.photo_url
    });
  }

  function loadLocal(why) {
    mode = 'local';
    items = (window.PRODUCTS || []).slice();
    if (why) console.warn('[Loop Theory] catalog: using the bundled catalog —', why);
    return items;
  }

  function loadSupabase() {
    return window.LTSupabase.client()
      .then(function (client) {
        return client.from(TABLE)
          .select('id, position, name, category, price, was, description, metal, art, size, finish, photo_url')
          .eq('active', true)
          .order('position', { ascending: true });
      })
      .then(function (res) {
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) {
          /* Reachable but empty means schema.sql ran and seed.sql did not.
             An empty shop is worse than the bundled one. */
          return loadLocal('the products table is empty — run db/seed.sql');
        }
        mode = 'supabase';
        items = res.data.map(fromRow);
        return items;
      })
      .catch(function (err) {
        return loadLocal((err && err.message) || err);
      });
  }

  const ready = (function () {
    if (!window.LTmakeProduct) {
      return Promise.resolve(loadLocal('data.js did not load'));
    }
    if (window.LTSupabase && window.LTSupabase.configured()) {
      return loadSupabase();
    }
    return Promise.resolve(loadLocal(null));
  })();

  const Catalog = {

    ready: ready,

    get mode() { return mode; },

    list: function () {
      return items;
    },

    get: function (id) {
      return items.filter(function (p) { return p.id === id; })[0] || null;
    },

    /* Points a product row at an uploaded photograph, or clears it with
       null. store.js puts the file in the bucket and deliberately knows
       nothing about the catalog, so the dashboard links the two here.

       Silently does nothing without a database — in local mode the
       photo lives in IndexedDB and there is no row to point anywhere. */
    setPhoto: function (productId, url) {
      if (mode !== 'supabase') return Promise.resolve({ stored: false });

      return window.LTSupabase.client()
        .then(function (client) {
          return client.from(TABLE)
            .update({ photo_url: url || null })
            .eq('id', productId);
        })
        .then(function (res) {
          if (res.error) throw res.error;
          const p = Catalog.get(productId);
          if (p) p.photo = url || null;   /* so a re-render picks it up without a reload */
          return { stored: true };
        });
    },

    /* Sends ids and quantities only. The subtotal shown in the drawer is
       for the shopper's benefit; place_order() recomputes it from the
       products table, because anything sent from here can be edited. */
    createOrder: function (order) {
      const lines = (order && order.items || [])
        .map(function (l) { return { product_id: l.id, qty: l.qty }; })
        .filter(function (l) { return Catalog.get(l.product_id); });

      if (!lines.length) {
        return Promise.reject(new Error('There is nothing in your bag.'));
      }

      if (mode !== 'supabase') {
        /* Nowhere to write yet. Report that honestly rather than
           showing a confirmation for an order nobody received. */
        return Promise.resolve({ id: null, stored: false });
      }

      return window.LTSupabase.client()
        .then(function (client) {
          return client.rpc('place_order', {
            p_email: (order && order.email) || '',
            p_items: lines
          });
        })
        .then(function (res) {
          if (res.error) throw res.error;
          return { id: res.data, stored: true };
        });
    }
  };

  window.Catalog = Catalog;

})();
