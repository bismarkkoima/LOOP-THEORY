/* ============================================================
   Loop Theory — data.js
   Mock catalog + procedural SVG visualizers.
   Exposes: window.CATEGORIES, window.MARQUEE, window.PRODUCTS
   ============================================================ */

const CATEGORIES = ['All', 'Rings', 'Necklaces', 'Earrings', 'Bracelets'];

const MARQUEE = [
  'Free shipping over $150',
  'Hand-checked finish',
  'Ships in 2–4 weeks',
  '30-day returns',
  'Small-batch pricing',
  'Direct from our maker network'
];

/* ---------- palette ---------- */

const METALS = {
  brass:     { stroke: 'var(--brass)',        accent: 'var(--brass-bright)', label: 'Brushed brass' },
  gold:      { stroke: 'var(--brass-bright)', accent: 'var(--brass)',        label: '14k gold vermeil' },
  verdigris: { stroke: 'var(--verdigris)',    accent: 'var(--brass-bright)', label: 'Patina bronze' },
  steel:     { stroke: 'var(--paper-dim)',    accent: 'var(--verdigris)',    label: 'Polished steel' },
  mixed:     { stroke: 'var(--brass)',        accent: 'var(--verdigris)',    label: 'Two-tone brass & bronze' }
};

/* ---------- SVG visualizers ----------
   Each returns a standalone <svg> on a 120x120 canvas.
   Colours are CSS variables, so the art re-themes with the site.

   The second argument is an explicit variant index, given per product in
   SEED below. It is deliberately not derived from catalog position: art
   picked by position silently re-rolls on every piece whenever a product
   is added or moved. */

function wrap(inner) {
  return '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}

function svgRing(m, variant) {
  const band = `
    <circle cx="60" cy="74" r="32" fill="none" stroke="${m.stroke}" stroke-width="7"/>
    <circle cx="60" cy="74" r="32" fill="none" stroke="${m.accent}" stroke-width="1.4" opacity="0.75"/>
    <circle cx="60" cy="74" r="25" fill="none" stroke="${m.accent}" stroke-width="0.8" opacity="0.35"/>`;

  const heads = [
    /* 0 — round solitaire stone */
    `<circle cx="60" cy="34" r="11" fill="none" stroke="${m.accent}" stroke-width="2.6"/>
     <circle cx="60" cy="34" r="5" fill="${m.accent}" opacity="0.55"/>`,
    /* 1 — flat signet face */
    `<rect x="47" y="24" width="26" height="20" rx="3" fill="none" stroke="${m.accent}" stroke-width="2.6"/>
     <rect x="53" y="30" width="14" height="8" rx="1.5" fill="${m.accent}" opacity="0.5"/>`,
    /* 2 — twin hoops; this head is the whole ring, so it skips the band */
    `<circle cx="52" cy="70" r="26" fill="none" stroke="${m.accent}" stroke-width="2.2" opacity="0.85"/>
     <circle cx="68" cy="70" r="26" fill="none" stroke="${m.stroke}" stroke-width="2.2" opacity="0.85"/>`,
    /* 3 — oval cabochon */
    `<ellipse cx="60" cy="34" rx="15" ry="12" fill="none" stroke="${m.accent}" stroke-width="2.6"/>
     <path d="M55 34h10" stroke="${m.accent}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`,
    /* 4 — marquise stone */
    `<path d="M60 22 L69 34 L60 46 L51 34Z" fill="none" stroke="${m.accent}" stroke-width="2.6"/>
     <path d="M60 29 L64.5 34 L60 39 L55.5 34Z" fill="${m.accent}" opacity="0.45"/>`,
    /* 5 — two stones side by side */
    `<circle cx="52" cy="34" r="7" fill="none" stroke="${m.accent}" stroke-width="2.4"/>
     <circle cx="68" cy="34" r="7" fill="none" stroke="${m.stroke}" stroke-width="2.4"/>
     <circle cx="52" cy="34" r="2.6" fill="${m.accent}" opacity="0.5"/>
     <circle cx="68" cy="34" r="2.6" fill="${m.accent}" opacity="0.5"/>`,
    /* 6 — crossed twist */
    `<path d="M50 42 L70 30 M50 30 L70 42" stroke="${m.accent}" stroke-width="2.6" stroke-linecap="round"/>`,
    /* 7 — flat-topped crescent */
    `<path d="M46 42 A16 16 0 0 1 74 42" fill="none" stroke="${m.accent}" stroke-width="3.2" stroke-linecap="round"/>
     <path d="M46 42 h28" stroke="${m.accent}" stroke-width="2" opacity="0.5" stroke-linecap="round"/>`,
    /* 8 — plain band, no head */
    ''
  ];

  return wrap(variant === 2 ? heads[2] : band + (heads[variant] || ''));
}

function svgNecklace(m, variant) {
  const chain = `
    <path d="M18 26 Q60 96 102 26" fill="none" stroke="${m.stroke}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M18 26 Q60 96 102 26" fill="none" stroke="${m.accent}" stroke-width="1.2"
          stroke-dasharray="1.5 5" stroke-linecap="round" opacity="0.8"/>`;

  const pendants = [
    /* 0 — disc */
    `<circle cx="60" cy="88" r="14" fill="none" stroke="${m.accent}" stroke-width="2.8"/>
     <circle cx="60" cy="88" r="5" fill="${m.accent}" opacity="0.5"/>`,
    /* 1 — teardrop */
    `<path d="M60 74 C70 86 70 96 60 100 C50 96 50 86 60 74Z" fill="none" stroke="${m.accent}" stroke-width="2.6"/>`,
    /* 2 — short bar */
    `<rect x="44" y="82" width="32" height="9" rx="4.5" fill="none" stroke="${m.accent}" stroke-width="2.6"/>`,
    /* 3 — eclipse / open ring */
    `<circle cx="60" cy="88" r="15" fill="none" stroke="${m.accent}" stroke-width="2.8"/>
     <path d="M60 73 A15 15 0 0 1 60 103" fill="none" stroke="${m.stroke}" stroke-width="2.8" opacity="0.9"/>`,
    /* 4 — long vertical bar */
    `<rect x="55.5" y="72" width="9" height="32" rx="4.5" fill="none" stroke="${m.accent}" stroke-width="2.6"/>`,
    /* 5 — struck coin */
    `<circle cx="60" cy="88" r="14" fill="none" stroke="${m.stroke}" stroke-width="3.4"/>
     <circle cx="60" cy="88" r="9.5" fill="none" stroke="${m.accent}" stroke-width="1.6" opacity="0.8"/>
     <path d="M55 88 h10 M60 83 v10" stroke="${m.accent}" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>`,
    /* 6 — chain alone */
    ''
  ];

  return wrap(chain + (pendants[variant] || ''));
}

function svgEarrings(m, variant) {
  const styles = [
    /* 0 — plain hoop */
    (x) => `<circle cx="${x}" cy="70" r="21" fill="none" stroke="${m.stroke}" stroke-width="4"/>
            <circle cx="${x}" cy="70" r="21" fill="none" stroke="${m.accent}" stroke-width="1" opacity="0.7"/>
            <circle cx="${x}" cy="46" r="2.6" fill="${m.accent}"/>`,
    /* 1 — arc drop from a stud */
    (x) => `<circle cx="${x}" cy="34" r="3" fill="${m.accent}"/>
            <path d="M${x} 38 v14" stroke="${m.stroke}" stroke-width="2"/>
            <path d="M${x - 14} 56 A14 16 0 0 0 ${x + 14} 56" fill="none" stroke="${m.accent}" stroke-width="3"/>`,
    /* 2 — cast pebble */
    (x) => `<ellipse cx="${x}" cy="60" rx="15" ry="17" fill="none" stroke="${m.stroke}" stroke-width="3.4"/>
            <ellipse cx="${x - 3}" cy="55" rx="5" ry="6" fill="${m.accent}" opacity="0.45"/>`,
    /* 3 — threader line */
    (x) => `<circle cx="${x}" cy="32" r="3" fill="${m.accent}"/>
            <path d="M${x} 36 v40" stroke="${m.stroke}" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="${x}" cy="82" r="6" fill="none" stroke="${m.accent}" stroke-width="2.4"/>`,
    /* 4 — ear cuff, open at the back */
    (x) => `<path d="M${x - 13} 62 A14 14 0 1 1 ${x + 6} 73" fill="none" stroke="${m.stroke}"
                  stroke-width="4" stroke-linecap="round"/>
            <circle cx="${x + 6}" cy="73" r="2.8" fill="${m.accent}"/>`,
    /* 5 — concentric hoops on one post */
    (x) => `<circle cx="${x}" cy="70" r="22" fill="none" stroke="${m.stroke}" stroke-width="3.4"/>
            <circle cx="${x}" cy="70" r="13" fill="none" stroke="${m.accent}" stroke-width="2.6"/>
            <circle cx="${x}" cy="46" r="2.6" fill="${m.accent}"/>`,
    /* 6 — baguette on the diagonal */
    (x) => `<circle cx="${x}" cy="40" r="2.6" fill="${m.accent}"/>
            <rect x="${x - 5.5}" y="52" width="11" height="19" rx="2" fill="none" stroke="${m.accent}"
                  stroke-width="2.6" transform="rotate(24 ${x} 61)"/>`
  ];

  /* 7 — sold as a deliberate mismatch, so each ear gets a different style */
  if (variant === 7) return wrap(styles[2](40) + styles[1](80));

  const draw = styles[variant] || styles[0];
  return wrap(draw(40) + draw(80));
}

function svgBracelet(m, variant) {
  const arc = 'M14 54 Q60 90 106 54';
  const strand = `
    <path d="${arc}" fill="none" stroke="${m.stroke}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="${arc}" fill="none" stroke="${m.accent}" stroke-width="1.1" stroke-dasharray="1.5 4.5" opacity="0.8"/>`;

  /* points along the hanging curve, for the styles that thread things onto it */
  function along(i, steps) {
    const t = i / steps;
    return { x: 14 + t * 92, y: 54 + Math.sin(Math.PI * t) * 18 };
  }

  const styles = [
    /* 0 — alternating links */
    function () {
      let links = '';
      for (let i = 0; i < 7; i++) {
        const p = along(i, 6);
        const x = p.x.toFixed(1), y = p.y.toFixed(1);
        const tilt = i % 2 ? 28 : -28;
        const col = i % 2 ? m.accent : m.stroke;
        links += `<ellipse cx="${x}" cy="${y}" rx="9" ry="6" fill="none" stroke="${col}"
                    stroke-width="2.6" transform="rotate(${tilt} ${x} ${y})"/>`;
      }
      return links;
    },
    /* 1 — solid bangle */
    function () {
      return `
        <ellipse cx="60" cy="60" rx="40" ry="34" fill="none" stroke="${m.stroke}" stroke-width="6"/>
        <ellipse cx="60" cy="60" rx="40" ry="34" fill="none" stroke="${m.accent}" stroke-width="1.2" opacity="0.7"/>
        <ellipse cx="60" cy="60" rx="30" ry="25" fill="none" stroke="${m.accent}" stroke-width="0.8" opacity="0.3"/>`;
    },
    /* 2 — charms on a strand */
    function () {
      let charms = '';
      [30, 60, 90].forEach(function (x, i) {
        const y = (54 + Math.sin(Math.PI * (x - 14) / 92) * 18 + 12).toFixed(1);
        charms += `<circle cx="${x}" cy="${y}" r="${5 + (i % 2)}" fill="none" stroke="${m.accent}" stroke-width="2.4"/>`;
      });
      return strand + charms;
    },
    /* 3 — open cuff with terminal beads */
    function () {
      const cuff = 'M92 44 A38 32 0 1 0 92 70';
      return `
        <path d="${cuff}" fill="none" stroke="${m.stroke}" stroke-width="6" stroke-linecap="round"/>
        <path d="${cuff}" fill="none" stroke="${m.accent}" stroke-width="1.2" opacity="0.65"/>
        <circle cx="92" cy="44" r="3.2" fill="${m.accent}"/>
        <circle cx="92" cy="70" r="3.2" fill="${m.accent}"/>`;
    },
    /* 4 — flat woven band */
    function () {
      let weave = '';
      for (let i = 0; i <= 8; i++) {
        const p = along(i, 8);
        const x = p.x.toFixed(1), y = p.y.toFixed(1);
        weave += `<path d="M${x - 5} ${(p.y + 4).toFixed(1)} L${x} ${(p.y - 4).toFixed(1)} L${(p.x + 5).toFixed(1)} ${(p.y + 4).toFixed(1)}"
                    fill="none" stroke="${i % 2 ? m.accent : m.stroke}" stroke-width="2.2"
                    stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      return weave;
    },
    /* 5 — several fine strands on one clasp */
    function () {
      return `
        <path d="M14 50 Q60 82 106 50" fill="none" stroke="${m.stroke}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M14 54 Q60 90 106 54" fill="none" stroke="${m.accent}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M14 58 Q60 98 106 58" fill="none" stroke="${m.stroke}" stroke-width="2.4" opacity="0.75" stroke-linecap="round"/>
        <circle cx="14" cy="54" r="3.4" fill="${m.accent}"/>
        <circle cx="106" cy="54" r="3.4" fill="${m.accent}"/>`;
    },
    /* 6 — blank ID bar */
    function () {
      return strand + `
        <rect x="42" y="65" width="36" height="13" rx="6.5" fill="none" stroke="${m.accent}" stroke-width="2.6"/>
        <path d="M50 71.5 h20" stroke="${m.accent}" stroke-width="1.4" opacity="0.4" stroke-linecap="round"/>`;
    },
    /* 7 — strung beads */
    function () {
      let beads = '';
      for (let i = 0; i <= 10; i++) {
        const p = along(i, 10);
        beads += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i % 2 ? 3.6 : 2.8}"
                    fill="none" stroke="${i % 2 ? m.accent : m.stroke}" stroke-width="2"/>`;
      }
      return beads;
    }
  ];

  return wrap((styles[variant] || styles[0])());
}

const RENDERERS = {
  Rings: svgRing,
  Necklaces: svgNecklace,
  Earrings: svgEarrings,
  Bracelets: svgBracelet
};

/* ---------- catalog ----------
   [ name, category, price, was, metal, description, art ]
   `art` is the variant index handed to the category's renderer above.
   Append new pieces at the end: ids are derived from position, and the
   admin dashboard maps uploaded photos onto them. */

const SEED = [
  ['Möbius Band',         'Rings',     168,  210, 'gold',      'A single continuous twist, polished outside and left raw within. Sits flush against a stacked set.', 6],
  ['Solitaire No. 4',     'Rings',     285, null, 'gold',      'One lab-grown white stone on a tapered band. The setting sits low so it clears a glove.', 0],
  ['Signet 01',           'Rings',     142, null, 'brass',     'A soft-oval signet face, unengraved by default. Ships ready for a monogram at any local jeweller.', 1],
  ['Twin Loop Ring',      'Rings',     124,  155, 'verdigris', 'Two offset bands soldered at a single point — the house silhouette, in the smallest piece we make.', 2],
  ['Half-Moon Stacker',   'Rings',      78, null, 'steel',     'A flat-topped crescent designed to nest against a solitaire without knocking the stone.', 7],

  ['Orbit Pendant',       'Necklaces', 196, null, 'gold',      'A floating disc on a fine cable chain, weighted to sit centred without constant adjusting.', 0],
  ['Fine Rope Chain',     'Necklaces', 148,  185, 'gold',      'A 1.2mm rope worn alone or layered under a longer pendant. Lobster clasp, solder-closed links.', 2],
  ['Eclipse Locket',      'Necklaces', 240, null, 'brass',     'A two-tone locket that reads as a plain disc until it catches light. Opens to a single photo well.', 3],
  ['Meridian Chain',      'Necklaces', 132, null, 'steel',     'A flat curb chain with a matte face and a polished edge. The most-worn piece in the studio.', 0],
  ['Droplet Necklace',    'Necklaces', 164,  199, 'verdigris', 'A hollow teardrop, hand-formed so no two hang at quite the same angle.', 1],

  ['Everyday Hoops',      'Earrings',   96, null, 'gold',      'A 22mm hoop at the weight you forget you are wearing. Hinged closure, no back to lose.', 0],
  ['Arc Drops',           'Earrings',  118,  145, 'brass',     'A shallow arc suspended from a small stud. Moves with you without swinging.', 1],
  ['Pebble Studs',        'Earrings',   68, null, 'steel',     'Irregular cast pebbles, each slightly different. Sold as a matched-but-not-identical pair.', 2],
  ['Threader Line',       'Earrings',  104, null, 'verdigris', 'A fine chain that threads through and hangs at whatever length you leave it.', 3],
  ['Double Loop Hoops',   'Earrings',  134, null, 'gold',      'Two concentric hoops on a single post — the brand mark, made wearable.', 5],

  ['Curb Chain Bracelet', 'Bracelets', 178,  220, 'gold',      'A substantial flat curb with a hidden box clasp. Reads dressy but takes daily wear.', 0],
  ['Linked Theory',       'Bracelets', 152, null, 'brass',     'Alternating polished and brushed links, so the bracelet shifts tone as it turns.', 0],
  ['Bangle No. 2',        'Bracelets', 128, null, 'verdigris', 'A solid oval bangle with a slight flat underside so it stops rotating on the wrist.', 1],
  ['Charm Loop',          'Bracelets', 186,  229, 'gold',      'A fine strand with three open jump rings, ready for charms you already own.', 2],
  ['Flat Snake Bracelet', 'Bracelets',  88, null, 'steel',     'A liquid, close-woven band that lies flat against the wrist. Our lightest bracelet.', 4],

  /* ---- second drop ---- */

  ['Torsion Ring',        'Rings',     154,  189, 'brass',     'A band that thickens where it twists, so the weight sits on top of the finger rather than under it.', 6],
  ['Wide Cigar Band',     'Rings',     212, null, 'gold',      'Eight millimetres across and hollowed inside — the presence of a heavy ring at half the weight.', 8],
  ['Open Cuff Ring',      'Rings',      86,  110, 'verdigris', 'Left deliberately unclosed, so it gives half a size either way under thumb pressure.', 8],
  ['Stone Duo',           'Rings',     268, null, 'gold',      'Two lab-grown stones set slightly apart, angled to catch the light at different moments.', 5],
  ['Pinky Signet',        'Rings',      98, null, 'steel',     'A smaller signet face cut for the little finger, where a full-size one tends to overhang.', 1],

  ['Long Bar Pendant',    'Necklaces', 172, null, 'brass',     'A vertical bar weighted at the base, so it hangs straight instead of drifting sideways over knitwear.', 4],
  ['Ball Chain 2mm',      'Necklaces', 118, null, 'steel',     'A polished ball chain on a screw clasp — the one closure that never catches in long hair.', 6],
  ['Keyhole Pendant',     'Necklaces', 208,  249, 'gold',      'An open oval that frames whatever you layer beneath it. Reads as negative space, not a charm.', 3],
  ['Twin Strand',         'Necklaces', 186, null, 'mixed',     'Two chains of different gauge on a single clasp, so a layered look stays put instead of tangling.', 6],
  ['Seal Coin',           'Necklaces', 154, null, 'brass',     'A struck coin with a soft raised rim, hung off-centre so it turns as you move.', 5],

  ['Chunky Hoops',        'Earrings',  128,  159, 'brass',     'A 28mm hoop at 4mm gauge. Substantial to look at, hollow so the lobe forgets it by evening.', 0],
  ['Ear Cuff',            'Earrings',   62, null, 'steel',     'Slips onto the upper ear with no piercing. Sized to grip the cartilage ridge rather than pinch it.', 4],
  ['Mismatch Set',        'Earrings',  116,  145, 'mixed',     'A pebble and a drop, sold together. Wear them as a pair or split them across two piercings.', 7],
  ['Huggie Pair',         'Earrings',   88, null, 'verdigris', 'A close hinge that sits tight to the lobe — the pair you leave in for weeks at a time.', 0],
  ['Baguette Studs',      'Earrings',  142, null, 'gold',      'A single rectangular stone set on the diagonal, so it reads as a line rather than a dot.', 6],

  ['Rolled Cuff',         'Bracelets', 164, null, 'brass',     'A rolled edge means no hard line against the wrist bone. Opens at the back to slip on.', 3],
  ['Fine Chain Stack',    'Bracelets',  96, null, 'gold',      'Three fine strands on one clasp, so a layered look does not mean three separate fastenings.', 5],
  ['ID Bar Bracelet',     'Bracelets', 148,  179, 'steel',     'A flat bar on a curb chain, left blank. The underside takes an engraving cleanly.', 6],
  ['Double Wrap',         'Bracelets', 138, null, 'mixed',     'A long strand that goes twice around, finishing at a toggle you can work one-handed.', 5],
  ['Beaded Line',         'Bracelets',  74, null, 'verdigris', 'Small cast beads strung on steel cable — flexible, and it will not stretch out over a year.', 7]
];

const SIZES = {
  Rings:     ['US 5–9', 'Adjustable', 'US 6–10'],
  Necklaces: ['16" + 2" ext.', '18" chain', '20" chain'],
  Earrings:  ['22mm', '14mm', '38mm drop'],
  Bracelets: ['6.5" + ext.', '7" chain', 'One size']
};

const FINISHES = ['Hand-polished', 'Brushed matte', 'Tumbled finish', 'High shine'];

/* One shape for a product, whether it came from SEED below or from the
   products table in Postgres. Both paths go through here, so the
   storefront cannot tell the two apart — and the artwork stays vector
   either way, redrawn from `metal` and `art` rather than stored. */
function makeProduct(o) {
  const m = METALS[o.metal] || METALS.brass;
  const pos = o.position;
  const category = RENDERERS[o.category] ? o.category : 'Rings';

  return {
    id: o.id || 'lt-' + String(pos).padStart(2, '0'),
    index: String(pos).padStart(2, '0'),
    position: pos,
    name: o.name,
    category: category,
    price: Number(o.price),
    was: o.was == null ? null : Number(o.was),
    desc: o.desc || '',
    metal: o.metal,
    art: o.art,
    material: m.label,
    size: o.size || SIZES[category][(pos - 1) % SIZES[category].length],
    finish: o.finish || FINISHES[(pos - 1) % FINISHES.length],
    /* a real photograph, once one has been uploaded; the SVG is the fallback */
    photo: o.photo || null,
    /* null means nobody is counting — the bundled catalog has no stock
       figures, and a piece with no figure is never treated as sold out */
    stock: o.stock == null ? null : Number(o.stock),
    svg: RENDERERS[category](m, o.art)
  };
}

const PRODUCTS = SEED.map(function (row, i) {
  return makeProduct({
    position: i + 1,
    name: row[0], category: row[1], price: row[2],
    was: row[3], metal: row[4], desc: row[5], art: row[6]
  });
});

window.CATEGORIES = CATEGORIES;
window.MARQUEE = MARQUEE;
window.PRODUCTS = PRODUCTS;
window.LTmakeProduct = makeProduct;
