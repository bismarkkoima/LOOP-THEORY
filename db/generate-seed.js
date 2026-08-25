const fs = require('fs');
const src = fs.readFileSync('js/data.js', 'utf8');
const window = {};
eval(src);
const P = window.PRODUCTS;

const q = v => v === null || v === undefined ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const n = v => v === null || v === undefined ? 'NULL' : String(v);

const rows = P.map(p => '  (' + [
  q(p.id), n(p.position), q(p.name), q(p.category), n(p.price), n(p.was),
  q(p.desc), q(p.metal), n(p.art), q(p.size), q(p.finish)
].join(', ') + ')').join(',\n');

const out = `-- ============================================================
-- Loop Theory — seed.sql
-- The ${P.length}-piece catalog. Run after db/schema.sql.
--
-- GENERATED FROM js/data.js — do not hand-edit. Regenerate with:
--   node db/generate-seed.js > db/seed.sql
--
-- Re-running is safe: existing rows are updated in place, so the
-- ids the admin dashboard maps photos onto never move, and any
-- photo_url already set is left alone.
-- ============================================================

insert into public.products
  (id, position, name, category, price, was, description, metal, art, size, finish)
values
${rows}
on conflict (id) do update set
  position    = excluded.position,
  name        = excluded.name,
  category    = excluded.category,
  price       = excluded.price,
  was         = excluded.was,
  description = excluded.description,
  metal       = excluded.metal,
  art         = excluded.art,
  size        = excluded.size,
  finish      = excluded.finish;
`;
process.stdout.write(out);
