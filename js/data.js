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
  steel:     { stroke: 'var(--paper-dim)',    accent: 'var(--verdigris)',    label: 'Polished steel' }
};

/* ---------- SVG visualizers ----------
   Each returns a standalone <svg> on a 120x120 canvas.
   Colours are CSS variables, so the art re-themes with the site. */

function wrap(inner) {
  return '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}

function svgRing(m, variant) {
  const band = `
    <circle cx="60" cy="74" r="32" fill="none" stroke="${m.stroke}" stroke-width="7"/>
    <circle cx="60" cy="74" r="32" fill="none" stroke="${m.accent}" stroke-width="1.4" opacity="0.75"/>
    <circle cx="60" cy="74" r="25" fill="none" stroke="${m.accent}" stroke-width="0.8" opacity="0.35"/>`;

  const heads = [
    `<circle cx="60" cy="34" r="11" fill="none" stroke="${m.accent}" stroke-width="2.6"/>
     <circle cx="60" cy="34" r="5" fill="${m.accent}" opacity="0.55"/>`,
    `<rect x="47" y="24" width="26" height="20" rx="3" fill="none" stroke="${m.accent}" stroke-width="2.6"/>
     <rect x="53" y="30" width="14" height="8" rx="1.5" fill="${m.accent}" opacity="0.5"/>`,
    `<circle cx="52" cy="70" r="26" fill="none" stroke="${m.accent}" stroke-width="2.2" opacity="0.85"/>
     <circle cx="68" cy="70" r="26" fill="none" stroke="${m.stroke}" stroke-width="2.2" opacity="0.85"/>`,
    `<ellipse cx="60" cy="34" rx="15" ry="12" fill="none" stroke="${m.accent}" stroke-width="2.6"/>
     <path d="M55 34h10" stroke="${m.accent}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`
  ];

  return wrap(variant % 4 === 2 ? heads[2] : band + heads[variant % heads.length]);
}

function svgNecklace(m, variant) {
  const chain = `
    <path d="M18 26 Q60 96 102 26" fill="none" stroke="${m.stroke}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M18 26 Q60 96 102 26" fill="none" stroke="${m.accent}" stroke-width="1.2"
          stroke-dasharray="1.5 5" stroke-linecap="round" opacity="0.8"/>`;

  const pendants = [
    `<circle cx="60" cy="88" r="14" fill="none" stroke="${m.accent}" stroke-width="2.8"/>
     <circle cx="60" cy="88" r="5" fill="${m.accent}" opacity="0.5"/>`,
    `<path d="M60 74 C70 86 70 96 60 100 C50 96 50 86 60 74Z" fill="none" stroke="${m.accent}" stroke-width="2.6"/>`,
    `<rect x="44" y="82" width="32" height="9" rx="4.5" fill="none" stroke="${m.accent}" stroke-width="2.6"/>`,
    `<circle cx="60" cy="88" r="15" fill="none" stroke="${m.accent}" stroke-width="2.8"/>
     <path d="M60 73 A15 15 0 0 1 60 103" fill="none" stroke="${m.stroke}" stroke-width="2.8" opacity="0.9"/>`
  ];

  return wrap(chain + pendants[variant % pendants.length]);
}

function svgEarrings(m, variant) {
  const styles = [
    (x) => `<circle cx="${x}" cy="70" r="21" fill="none" stroke="${m.stroke}" stroke-width="4"/>
            <circle cx="${x}" cy="70" r="21" fill="none" stroke="${m.accent}" stroke-width="1" opacity="0.7"/>
            <circle cx="${x}" cy="46" r="2.6" fill="${m.accent}"/>`,
    (x) => `<circle cx="${x}" cy="34" r="3" fill="${m.accent}"/>
            <path d="M${x} 38 v14" stroke="${m.stroke}" stroke-width="2"/>
            <path d="M${x - 14} 56 A14 16 0 0 0 ${x + 14} 56" fill="none" stroke="${m.accent}" stroke-width="3"/>`,
    (x) => `<ellipse cx="${x}" cy="60" rx="15" ry="17" fill="none" stroke="${m.stroke}" stroke-width="3.4"/>
            <ellipse cx="${x - 3}" cy="55" rx="5" ry="6" fill="${m.accent}" opacity="0.45"/>`,
    (x) => `<circle cx="${x}" cy="32" r="3" fill="${m.accent}"/>
            <path d="M${x} 36 v40" stroke="${m.stroke}" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="${x}" cy="82" r="6" fill="none" stroke="${m.accent}" stroke-width="2.4"/>`
  ];
  const draw = styles[variant % styles.length];
  return wrap(draw(40) + draw(80));
}

function svgBracelet(m, variant) {
  const arc = 'M14 54 Q60 90 106 54';

  if (variant % 3 === 0) {
    let links = '';
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = (14 + t * 92).toFixed(1);
      const y = (54 + Math.sin(Math.PI * t) * 18).toFixed(1);
      const tilt = i % 2 ? 28 : -28;
      const col = i % 2 ? m.accent : m.stroke;
      links += `<ellipse cx="${x}" cy="${y}" rx="9" ry="6" fill="none" stroke="${col}"
                  stroke-width="2.6" transform="rotate(${tilt} ${x} ${y})"/>`;
    }
    return wrap(links);
  }

  if (variant % 3 === 1) {
    return wrap(`
      <ellipse cx="60" cy="60" rx="40" ry="34" fill="none" stroke="${m.stroke}" stroke-width="6"/>
      <ellipse cx="60" cy="60" rx="40" ry="34" fill="none" stroke="${m.accent}" stroke-width="1.2" opacity="0.7"/>
      <ellipse cx="60" cy="60" rx="30" ry="25" fill="none" stroke="${m.accent}" stroke-width="0.8" opacity="0.3"/>`);
  }

  let charms = '';
  [30, 60, 90].forEach((x, i) => {
    const y = (54 + Math.sin(Math.PI * (x - 14) / 92) * 18 + 12).toFixed(1);
    charms += `<circle cx="${x}" cy="${y}" r="${5 + (i % 2)}" fill="none" stroke="${m.accent}" stroke-width="2.4"/>`;
  });
  return wrap(`
    <path d="${arc}" fill="none" stroke="${m.stroke}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="${arc}" fill="none" stroke="${m.accent}" stroke-width="1.1" stroke-dasharray="1.5 4.5" opacity="0.8"/>
    ${charms}`);
}

const RENDERERS = {
  Rings: svgRing,
  Necklaces: svgNecklace,
  Earrings: svgEarrings,
  Bracelets: svgBracelet
};

/* ---------- catalog ---------- */

const SEED = [
  ['Möbius Band',         'Rings',     168,  210, 'gold',      'A single continuous twist, polished outside and left raw within. Sits flush against a stacked set.'],
  ['Solitaire No. 4',     'Rings',     285, null, 'gold',      'One lab-grown white stone on a tapered band. The setting sits low so it clears a glove.'],
  ['Signet 01',           'Rings',     142, null, 'brass',     'A soft-oval signet face, unengraved by default. Ships ready for a monogram at any local jeweller.'],
  ['Twin Loop Ring',      'Rings',     124,  155, 'verdigris', 'Two offset bands soldered at a single point — the house silhouette, in the smallest piece we make.'],
  ['Half-Moon Stacker',   'Rings',      78, null, 'steel',     'A flat-topped crescent designed to nest against a solitaire without knocking the stone.'],

  ['Orbit Pendant',       'Necklaces', 196, null, 'gold',      'A floating disc on a fine cable chain, weighted to sit centred without constant adjusting.'],
  ['Fine Rope Chain',     'Necklaces', 148,  185, 'gold',      'A 1.2mm rope worn alone or layered under a longer pendant. Lobster clasp, solder-closed links.'],
  ['Eclipse Locket',      'Necklaces', 240, null, 'brass',     'A two-tone locket that reads as a plain disc until it catches light. Opens to a single photo well.'],
  ['Meridian Chain',      'Necklaces', 132, null, 'steel',     'A flat curb chain with a matte face and a polished edge. The most-worn piece in the studio.'],
  ['Droplet Necklace',    'Necklaces', 164,  199, 'verdigris', 'A hollow teardrop, hand-formed so no two hang at quite the same angle.'],

  ['Everyday Hoops',      'Earrings',   96, null, 'gold',      'A 22mm hoop at the weight you forget you are wearing. Hinged closure, no back to lose.'],
  ['Arc Drops',           'Earrings',  118,  145, 'brass',     'A shallow arc suspended from a small stud. Moves with you without swinging.'],
  ['Pebble Studs',        'Earrings',   68, null, 'steel',     'Irregular cast pebbles, each slightly different. Sold as a matched-but-not-identical pair.'],
  ['Threader Line',       'Earrings',  104, null, 'verdigris', 'A fine chain that threads through and hangs at whatever length you leave it.'],
  ['Double Loop Hoops',   'Earrings',  134, null, 'gold',      'Two concentric hoops on a single post — the brand mark, made wearable.'],

  ['Curb Chain Bracelet', 'Bracelets', 178,  220, 'gold',      'A substantial flat curb with a hidden box clasp. Reads dressy but takes daily wear.'],
  ['Linked Theory',       'Bracelets', 152, null, 'brass',     'Alternating polished and brushed links, so the bracelet shifts tone as it turns.'],
  ['Bangle No. 2',        'Bracelets', 128, null, 'verdigris', 'A solid oval bangle with a slight flat underside so it stops rotating on the wrist.'],
  ['Charm Loop',          'Bracelets', 186,  229, 'gold',      'A fine strand with three open jump rings, ready for charms you already own.'],
  ['Flat Snake Bracelet', 'Bracelets',  88, null, 'steel',     'A liquid, close-woven band that lies flat against the wrist. Our lightest bracelet.']
];

const SIZES = {
  Rings:     ['US 5–9', 'Adjustable', 'US 6–10'],
  Necklaces: ['16" + 2" ext.', '18" chain', '20" chain'],
  Earrings:  ['22mm', '14mm', '38mm drop'],
  Bracelets: ['6.5" + ext.', '7" chain', 'One size']
};

const FINISHES = ['Hand-polished', 'Brushed matte', 'Tumbled finish', 'High shine'];

const PRODUCTS = SEED.map(function (row, i) {
  const name = row[0], category = row[1], price = row[2],
        was = row[3], metal = row[4], desc = row[5];
  const m = METALS[metal];
  return {
    id: 'lt-' + String(i + 1).padStart(2, '0'),
    index: String(i + 1).padStart(2, '0'),
    name: name,
    category: category,
    price: price,
    was: was,
    desc: desc,
    material: m.label,
    size: SIZES[category][i % SIZES[category].length],
    finish: FINISHES[i % FINISHES.length],
    svg: RENDERERS[category](m, i)
  };
});

window.CATEGORIES = CATEGORIES;
window.MARQUEE = MARQUEE;
window.PRODUCTS = PRODUCTS;
