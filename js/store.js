/* ============================================================
   Loop Theory — store.js
   Product photo storage. One interface, swappable backend.

     PhotoStore.mode           'supabase' | 'local'
     PhotoStore.ready          Promise — resolves once a backend is up
     PhotoStore.list()         -> [record]
     PhotoStore.get(id)        -> record | null
     PhotoStore.put(id, file)  -> Promise<record>
     PhotoStore.remove(id)     -> Promise<void>
     PhotoStore.onChange(fn)   -> unsubscribe fn

     record = { productId, url, name, size, type, updatedAt }

   The backend is chosen once at load. If js/config.js supplies a
   Supabase URL and anon key, photos go to Supabase Storage;
   otherwise they go to IndexedDB in this browser. Callers — the
   admin dashboard, and app.js when it renders the storefront —
   only ever touch PhotoStore and never learn which is in use.

   Adding a third backend (PHP endpoints, S3, anything) means
   writing one object with init/list/put/remove and picking it in
   chooseBackend(). No caller changes.
   ============================================================ */

(function () {

  const MAX_BYTES = 15 * 1024 * 1024;
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

  /* ---------- backend: IndexedDB (local) ---------- */

  const DB_NAME = 'looptheory';
  const DB_VERSION = 1;
  const DB_STORE = 'photos';

  function openDB() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE, { keyPath: 'productId' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function runTx(db, mode, fn) {
    return new Promise(function (resolve, reject) {
      const t = db.transaction(DB_STORE, mode);
      const req = fn(t.objectStore(DB_STORE));
      t.oncomplete = function () { resolve(req ? req.result : undefined); };
      t.onerror = function () { reject(t.error); };
      t.onabort = function () { reject(t.error); };
    });
  }

  const localBackend = {
    name: 'local',
    _db: null,
    _urls: new Map(),

    init: function () {
      const self = this;
      return openDB().then(function (db) { self._db = db; });
    },

    list: function () {
      const self = this;
      return runTx(this._db, 'readonly', function (s) { return s.getAll(); })
        .then(function (rows) {
          return (rows || []).map(function (row) { return self._record(row); });
        });
    },

    put: function (productId, file) {
      const self = this;
      this._revoke(productId);
      const row = {
        productId: productId,
        blob: file,
        name: file.name,
        size: file.size,
        type: file.type,
        updatedAt: Date.now()
      };
      return runTx(this._db, 'readwrite', function (s) { return s.put(row); })
        .then(function () { return self._record(row); });
    },

    remove: function (productId) {
      const self = this;
      return runTx(this._db, 'readwrite', function (s) { return s.delete(productId); })
        .then(function () { self._revoke(productId); });
    },

    /* Blob URLs are minted lazily and cached, so re-rendering the
       grid does not leak a new object URL on every pass. */
    _record: function (row) {
      let url = this._urls.get(row.productId);
      if (!url) {
        url = URL.createObjectURL(row.blob);
        this._urls.set(row.productId, url);
      }
      return {
        productId: row.productId,
        url: url,
        name: row.name,
        size: row.size,
        type: row.type,
        updatedAt: row.updatedAt
      };
    },

    _revoke: function (productId) {
      const url = this._urls.get(productId);
      if (url) {
        URL.revokeObjectURL(url);
        this._urls.delete(productId);
      }
    }
  };

  /* ---------- backend: Supabase Storage ---------- */

  const supabaseBackend = {
    name: 'supabase',
    _client: null,
    _bucket: 'product-photos',

    init: function () {
      const self = this;
      self._bucket = window.LTSupabase.bucket();
      return window.LTSupabase.client().then(function (client) {
        self._client = client;
      });
    },

    list: function () {
      const self = this;
      return this._client.storage.from(this._bucket).list('', { limit: 1000 })
        .then(function (res) {
          if (res.error) throw res.error;
          return (res.data || [])
            .filter(function (o) { return o.name && o.name.indexOf('.') > 0; })
            .map(function (o) { return self._record(o); });
        });
    },

    put: function (productId, file) {
      const self = this;
      const ext = extOf(file.name, file.type);
      const path = productId + ext;
      /* One photo per product. A previous upload with a different
         extension would otherwise survive alongside the new one. */
      return this._purge(productId).then(function () {
        return self._client.storage.from(self._bucket)
          .upload(path, file, { upsert: true, contentType: file.type });
      }).then(function (res) {
        if (res.error) throw res.error;
        return {
          productId: productId,
          url: self._publicUrl(path) + '?v=' + Date.now(),
          name: path,
          size: file.size,
          type: file.type,
          updatedAt: Date.now()
        };
      });
    },

    remove: function (productId) {
      return this._purge(productId);
    },

    _purge: function (productId) {
      const self = this;
      return this.list().then(function (rows) {
        const paths = rows
          .filter(function (r) { return r.productId === productId; })
          .map(function (r) { return r.name; });
        if (!paths.length) return;
        return self._client.storage.from(self._bucket).remove(paths)
          .then(function (res) { if (res.error) throw res.error; });
      });
    },

    _publicUrl: function (path) {
      return this._client.storage.from(this._bucket).getPublicUrl(path).data.publicUrl;
    },

    _record: function (obj) {
      const meta = obj.metadata || {};
      return {
        productId: obj.name.replace(/\.[^.]+$/, ''),
        url: this._publicUrl(obj.name),
        name: obj.name,
        size: meta.size || 0,
        type: meta.mimetype || '',
        updatedAt: obj.updated_at ? Date.parse(obj.updated_at) : Date.now()
      };
    }
  };

  /* ---------- helpers ---------- */

  function extOf(filename, mime) {
    const m = String(filename).match(/\.[A-Za-z0-9]+$/);
    if (m) return m[0].toLowerCase();
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    if (mime === 'image/gif') return '.gif';
    if (mime === 'image/avif') return '.avif';
    return '.jpg';
  }

  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function validate(file) {
    if (!file) return 'No file provided.';
    if (OK_TYPES.indexOf(file.type) === -1) {
      return '"' + file.name + '" is not a supported image (JPEG, PNG, WebP, GIF or AVIF).';
    }
    if (file.size > MAX_BYTES) {
      return '"' + file.name + '" is ' + formatSize(file.size) + ' — the limit is ' + formatSize(MAX_BYTES) + '.';
    }
    return null;
  }

  /* ---------- facade ---------- */

  const cache = new Map();
  const listeners = [];
  let backend = localBackend;

  function emit() {
    const rows = PhotoStore.list();
    listeners.slice().forEach(function (fn) {
      try { fn(rows); } catch (err) { console.error('[PhotoStore] listener failed', err); }
    });
  }

  function refresh() {
    return backend.list().then(function (rows) {
      cache.clear();
      rows.forEach(function (r) { cache.set(r.productId, r); });
      emit();
    });
  }

  const PhotoStore = {
    mode: 'local',
    ready: null,
    formatSize: formatSize,
    maxBytes: MAX_BYTES,

    list: function () {
      return Array.from(cache.values());
    },

    get: function (productId) {
      return cache.get(productId) || null;
    },

    put: function (productId, file) {
      const problem = validate(file);
      if (problem) return Promise.reject(new Error(problem));
      return backend.put(productId, file).then(function (record) {
        cache.set(productId, record);
        emit();
        return record;
      });
    },

    remove: function (productId) {
      return backend.remove(productId).then(function () {
        cache.delete(productId);
        emit();
      });
    },

    onChange: function (fn) {
      listeners.push(fn);
      return function () {
        const i = listeners.indexOf(fn);
        if (i > -1) listeners.splice(i, 1);
      };
    }
  };

  PhotoStore.ready = Promise.resolve().then(function () {
    backend = window.LTSupabase.configured() ? supabaseBackend : localBackend;
    return backend.init().catch(function (err) {
      /* A misconfigured or unreachable Supabase project should not
         leave the dashboard dead — drop to local and say so. */
      if (backend === supabaseBackend) {
        console.warn('[PhotoStore] Supabase unreachable — falling back to local storage.', err);
        PhotoStore.degraded = String(err && err.message || err);
        backend = localBackend;
        return backend.init({});
      }
      throw err;
    });
  }).then(function () {
    PhotoStore.mode = backend.name;
    return refresh();
  }).then(function () {
    return PhotoStore;
  });

  window.PhotoStore = PhotoStore;

})();
