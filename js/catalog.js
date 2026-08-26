/* ============================================================
   Loop Theory — catalog.js
   The product catalog. One interface, swappable backend.

     Catalog.mode                    'supabase' | 'local'
     Catalog.ready                   Promise<[product]>
     Catalog.list()                  -> [product]
     Catalog.get(id)                 -> product | null
     Catalog.createOrder(o)          -> Promise<{ id, stored }>
     Catalog.settings()              -> { freeShippingOver, flatShipping, ... }
     Catalog.shippingOn(subtotal)    -> number

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

  /* What the storefront quotes for delivery before checkout. These are
     only a quote: place_order() charges from the same row in the
     database, so a tampered copy here changes the label and nothing
     else. The fallback matches the schema defaults, so the drawer still
     adds up when there is no database at all. */
  let settings = {
    freeShippingOver: 150,
    flatShipping:     8,
    lowStockAt:       3
  };

  function loadSettings() {
    return window.LTSupabase.client()
      .then(function (client) {
        return client.from('shop_settings')
          .select('free_shipping_threshold, flat_shipping, low_stock_at')
          .limit(1)
          .maybeSingle();
      })
      .then(function (res) {
        if (res.error || !res.data) return settings;
        settings = {
          freeShippingOver: Number(res.data.free_shipping_threshold),
          flatShipping:     Number(res.data.flat_shipping),
          lowStockAt:       Number(res.data.low_stock_at)
        };
        return settings;
      })
      .catch(function () { return settings; });   /* the quote is not worth failing the shop over */
  }

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
      photo: row.photo_url,
      stock: row.stock
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
          .select('id, position, name, category, price, was, description, metal, art, size, finish, photo_url, stock')
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
        return loadSettings().then(function () { return items; });
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

    settings: function () {
      return settings;
    },

    /* The same rule place_order() applies, so the drawer and the receipt
       agree. Kept in one place because three callers need it. */
    shippingOn: function (subtotal) {
      return Number(subtotal) >= settings.freeShippingOver ? 0 : settings.flatShipping;
    },

    /* null stock is "nobody is counting" — the bundled catalog carries no
       figures, and those pieces stay buyable. */
    soldOut: function (p) {
      return !!p && p.stock != null && p.stock <= 0;
    },

    /* How many more of this piece the shopper may add, given what is
       already in the bag. Infinity where nothing is being counted. */
    canTake: function (p, inBag) {
      if (!p || p.stock == null) return Infinity;
      return Math.max(0, p.stock - (inBag || 0));
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

    /* Sends ids, quantities and delivery details only. The subtotal shown
       in the drawer is for the shopper's benefit; place_order() recomputes
       it from the products table, because anything sent from here can be
       edited by whoever is holding the browser. */
    createOrder: function (order) {
      order = order || {};
      const lines = (order.items || [])
        .map(function (l) { return { product_id: l.id, qty: l.qty }; })
        .filter(function (l) { return Catalog.get(l.product_id); });

      if (!lines.length) {
        return Promise.reject(new Error('There is nothing in your bag.'));
      }

      if (mode !== 'supabase') {
        /* Nowhere to write yet. Report that honestly rather than
           showing a confirmation for an order nobody received. */
        return Promise.resolve({ id: null, token: null, stored: false });
      }

      return window.LTSupabase.client()
        .then(function (client) {
          return client.rpc('place_order', {
            p_details: order.details || {},
            p_items: lines
          });
        })
        .then(function (res) {
          if (res.error) throw res.error;
          const d = res.data || {};
          return { id: d.id, token: d.token, subtotal: d.subtotal,
                   shipping: d.shipping, total: d.total, stored: true };
        });
    },

    /* One order, by the token issued at checkout. The shopper cannot read
       the orders table, so this is their only way back to it. */
    getOrder: function (token) {
      if (mode !== 'supabase') {
        return Promise.reject(new Error('No database is configured, so there are no orders to look up.'));
      }
      return window.LTSupabase.client()
        .then(function (client) { return client.rpc('get_order', { p_token: token }); })
        .then(function (res) {
          if (res.error) throw res.error;
          return res.data;
        });
    },

    /* Admin only — the RLS policy on orders decides, not this call. */
    listOrders: function (opts) {
      opts = opts || {};
      if (mode !== 'supabase') {
        return Promise.reject(new Error('No database is configured.'));
      }
      return window.LTSupabase.client()
        .then(function (client) {
          let q = client.from('orders')
            .select('id, created_at, status, subtotal, shipping, total, currency, email, ship_name, ship_city, ship_country, token')
            .order('created_at', { ascending: false })
            .limit(opts.limit || 100);
          if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status);
          return q;
        })
        .then(function (res) {
          if (res.error) throw res.error;
          return res.data || [];
        });
    },

    orderItems: function (orderId) {
      return window.LTSupabase.client()
        .then(function (client) {
          return client.from('order_items')
            .select('product_id, name, unit_price, qty')
            .eq('order_id', orderId)
            .order('id', { ascending: true });
        })
        .then(function (res) {
          if (res.error) throw res.error;
          return res.data || [];
        });
    },

    setOrderStatus: function (orderId, status, note) {
      return window.LTSupabase.client()
        .then(function (client) {
          return client.rpc('set_order_status', {
            p_order: orderId, p_status: status, p_note: note || null
          });
        })
        .then(function (res) {
          if (res.error) throw res.error;
          return res.data || true;
        });
    },

    /* The audit trail for one order. Readable by admins only — the policy
       on order_events decides, not this call. */
    orderEvents: function (orderId) {
      return window.LTSupabase.client()
        .then(function (client) {
          return client.from('order_events')
            .select('from_status, to_status, actor, note, created_at')
            .eq('order_id', orderId)
            .order('created_at', { ascending: true });
        })
        .then(function (res) {
          if (res.error) throw res.error;
          return res.data || [];
        });
    },

    /* The figures across the top of the dashboard, counted in Postgres
       rather than by dragging every order into the browser. */
    overview: function () {
      if (mode !== 'supabase') {
        return Promise.reject(new Error('No database is configured.'));
      }
      return window.LTSupabase.client()
        .then(function (client) { return client.rpc('admin_overview'); })
        .then(function (res) {
          if (res.error) throw res.error;
          return res.data || {};
        });
    },

    /* Admin product writes. The "admins manage products" policy is what
       actually permits these; an ordinary visitor's call is refused. */
    saveProduct: function (row) {
      return window.LTSupabase.client()
        .then(function (client) { return client.from(TABLE).upsert(row).select().single(); })
        .then(function (res) {
          if (res.error) throw res.error;
          return res.data;
        });
    },

    setActive: function (productId, active) {
      return window.LTSupabase.client()
        .then(function (client) {
          return client.from(TABLE).update({ active: !!active }).eq('id', productId);
        })
        .then(function (res) {
          if (res.error) throw res.error;
          return true;
        });
    },

    /* Setting stock is an ordinary update: the "admins manage products"
       policy permits it, and an ordinary visitor's call is refused. The
       decrements at checkout are a different matter and happen inside
       place_order(), where they can be locked. */
    setStock: function (productId, qty) {
      const n = Math.max(0, Math.floor(Number(qty) || 0));
      if (mode !== 'supabase') return Promise.resolve({ stored: false, stock: n });

      return window.LTSupabase.client()
        .then(function (client) {
          return client.from(TABLE).update({ stock: n }).eq('id', productId);
        })
        .then(function (res) {
          if (res.error) throw res.error;
          const p = Catalog.get(productId);
          if (p) p.stock = n;             /* so a re-render picks it up without a reload */
          return { stored: true, stock: n };
        });
    },

    saveSettings: function (next) {
      next = next || {};
      return window.LTSupabase.client()
        .then(function (client) {
          return client.from('shop_settings').update({
            free_shipping_threshold: Number(next.freeShippingOver),
            flat_shipping:           Number(next.flatShipping),
            low_stock_at:            Math.max(0, Math.floor(Number(next.lowStockAt) || 0))
          }).eq('id', true);
        })
        .then(function (res) {
          if (res.error) throw res.error;
          settings = {
            freeShippingOver: Number(next.freeShippingOver),
            flatShipping:     Number(next.flatShipping),
            lowStockAt:       Math.max(0, Math.floor(Number(next.lowStockAt) || 0))
          };
          return settings;
        });
    }
  };

  window.Catalog = Catalog;

})();
