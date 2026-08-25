-- ============================================================
-- Loop Theory — seed.sql
-- The 40-piece catalog. Run after db/schema.sql.
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
  ('lt-01', 1, 'Möbius Band', 'Rings', 168, 210, 'A single continuous twist, polished outside and left raw within. Sits flush against a stacked set.', 'gold', 6, 'US 5–9', 'Hand-polished'),
  ('lt-02', 2, 'Solitaire No. 4', 'Rings', 285, NULL, 'One lab-grown white stone on a tapered band. The setting sits low so it clears a glove.', 'gold', 0, 'Adjustable', 'Brushed matte'),
  ('lt-03', 3, 'Signet 01', 'Rings', 142, NULL, 'A soft-oval signet face, unengraved by default. Ships ready for a monogram at any local jeweller.', 'brass', 1, 'US 6–10', 'Tumbled finish'),
  ('lt-04', 4, 'Twin Loop Ring', 'Rings', 124, 155, 'Two offset bands soldered at a single point — the house silhouette, in the smallest piece we make.', 'verdigris', 2, 'US 5–9', 'High shine'),
  ('lt-05', 5, 'Half-Moon Stacker', 'Rings', 78, NULL, 'A flat-topped crescent designed to nest against a solitaire without knocking the stone.', 'steel', 7, 'Adjustable', 'Hand-polished'),
  ('lt-06', 6, 'Orbit Pendant', 'Necklaces', 196, NULL, 'A floating disc on a fine cable chain, weighted to sit centred without constant adjusting.', 'gold', 0, '20" chain', 'Brushed matte'),
  ('lt-07', 7, 'Fine Rope Chain', 'Necklaces', 148, 185, 'A 1.2mm rope worn alone or layered under a longer pendant. Lobster clasp, solder-closed links.', 'gold', 2, '16" + 2" ext.', 'Tumbled finish'),
  ('lt-08', 8, 'Eclipse Locket', 'Necklaces', 240, NULL, 'A two-tone locket that reads as a plain disc until it catches light. Opens to a single photo well.', 'brass', 3, '18" chain', 'High shine'),
  ('lt-09', 9, 'Meridian Chain', 'Necklaces', 132, NULL, 'A flat curb chain with a matte face and a polished edge. The most-worn piece in the studio.', 'steel', 0, '20" chain', 'Hand-polished'),
  ('lt-10', 10, 'Droplet Necklace', 'Necklaces', 164, 199, 'A hollow teardrop, hand-formed so no two hang at quite the same angle.', 'verdigris', 1, '16" + 2" ext.', 'Brushed matte'),
  ('lt-11', 11, 'Everyday Hoops', 'Earrings', 96, NULL, 'A 22mm hoop at the weight you forget you are wearing. Hinged closure, no back to lose.', 'gold', 0, '14mm', 'Tumbled finish'),
  ('lt-12', 12, 'Arc Drops', 'Earrings', 118, 145, 'A shallow arc suspended from a small stud. Moves with you without swinging.', 'brass', 1, '38mm drop', 'High shine'),
  ('lt-13', 13, 'Pebble Studs', 'Earrings', 68, NULL, 'Irregular cast pebbles, each slightly different. Sold as a matched-but-not-identical pair.', 'steel', 2, '22mm', 'Hand-polished'),
  ('lt-14', 14, 'Threader Line', 'Earrings', 104, NULL, 'A fine chain that threads through and hangs at whatever length you leave it.', 'verdigris', 3, '14mm', 'Brushed matte'),
  ('lt-15', 15, 'Double Loop Hoops', 'Earrings', 134, NULL, 'Two concentric hoops on a single post — the brand mark, made wearable.', 'gold', 5, '38mm drop', 'Tumbled finish'),
  ('lt-16', 16, 'Curb Chain Bracelet', 'Bracelets', 178, 220, 'A substantial flat curb with a hidden box clasp. Reads dressy but takes daily wear.', 'gold', 0, '6.5" + ext.', 'High shine'),
  ('lt-17', 17, 'Linked Theory', 'Bracelets', 152, NULL, 'Alternating polished and brushed links, so the bracelet shifts tone as it turns.', 'brass', 0, '7" chain', 'Hand-polished'),
  ('lt-18', 18, 'Bangle No. 2', 'Bracelets', 128, NULL, 'A solid oval bangle with a slight flat underside so it stops rotating on the wrist.', 'verdigris', 1, 'One size', 'Brushed matte'),
  ('lt-19', 19, 'Charm Loop', 'Bracelets', 186, 229, 'A fine strand with three open jump rings, ready for charms you already own.', 'gold', 2, '6.5" + ext.', 'Tumbled finish'),
  ('lt-20', 20, 'Flat Snake Bracelet', 'Bracelets', 88, NULL, 'A liquid, close-woven band that lies flat against the wrist. Our lightest bracelet.', 'steel', 4, '7" chain', 'High shine'),
  ('lt-21', 21, 'Torsion Ring', 'Rings', 154, 189, 'A band that thickens where it twists, so the weight sits on top of the finger rather than under it.', 'brass', 6, 'US 6–10', 'Hand-polished'),
  ('lt-22', 22, 'Wide Cigar Band', 'Rings', 212, NULL, 'Eight millimetres across and hollowed inside — the presence of a heavy ring at half the weight.', 'gold', 8, 'US 5–9', 'Brushed matte'),
  ('lt-23', 23, 'Open Cuff Ring', 'Rings', 86, 110, 'Left deliberately unclosed, so it gives half a size either way under thumb pressure.', 'verdigris', 8, 'Adjustable', 'Tumbled finish'),
  ('lt-24', 24, 'Stone Duo', 'Rings', 268, NULL, 'Two lab-grown stones set slightly apart, angled to catch the light at different moments.', 'gold', 5, 'US 6–10', 'High shine'),
  ('lt-25', 25, 'Pinky Signet', 'Rings', 98, NULL, 'A smaller signet face cut for the little finger, where a full-size one tends to overhang.', 'steel', 1, 'US 5–9', 'Hand-polished'),
  ('lt-26', 26, 'Long Bar Pendant', 'Necklaces', 172, NULL, 'A vertical bar weighted at the base, so it hangs straight instead of drifting sideways over knitwear.', 'brass', 4, '18" chain', 'Brushed matte'),
  ('lt-27', 27, 'Ball Chain 2mm', 'Necklaces', 118, NULL, 'A polished ball chain on a screw clasp — the one closure that never catches in long hair.', 'steel', 6, '20" chain', 'Tumbled finish'),
  ('lt-28', 28, 'Keyhole Pendant', 'Necklaces', 208, 249, 'An open oval that frames whatever you layer beneath it. Reads as negative space, not a charm.', 'gold', 3, '16" + 2" ext.', 'High shine'),
  ('lt-29', 29, 'Twin Strand', 'Necklaces', 186, NULL, 'Two chains of different gauge on a single clasp, so a layered look stays put instead of tangling.', 'mixed', 6, '18" chain', 'Hand-polished'),
  ('lt-30', 30, 'Seal Coin', 'Necklaces', 154, NULL, 'A struck coin with a soft raised rim, hung off-centre so it turns as you move.', 'brass', 5, '20" chain', 'Brushed matte'),
  ('lt-31', 31, 'Chunky Hoops', 'Earrings', 128, 159, 'A 28mm hoop at 4mm gauge. Substantial to look at, hollow so the lobe forgets it by evening.', 'brass', 0, '22mm', 'Tumbled finish'),
  ('lt-32', 32, 'Ear Cuff', 'Earrings', 62, NULL, 'Slips onto the upper ear with no piercing. Sized to grip the cartilage ridge rather than pinch it.', 'steel', 4, '14mm', 'High shine'),
  ('lt-33', 33, 'Mismatch Set', 'Earrings', 116, 145, 'A pebble and a drop, sold together. Wear them as a pair or split them across two piercings.', 'mixed', 7, '38mm drop', 'Hand-polished'),
  ('lt-34', 34, 'Huggie Pair', 'Earrings', 88, NULL, 'A close hinge that sits tight to the lobe — the pair you leave in for weeks at a time.', 'verdigris', 0, '22mm', 'Brushed matte'),
  ('lt-35', 35, 'Baguette Studs', 'Earrings', 142, NULL, 'A single rectangular stone set on the diagonal, so it reads as a line rather than a dot.', 'gold', 6, '14mm', 'Tumbled finish'),
  ('lt-36', 36, 'Rolled Cuff', 'Bracelets', 164, NULL, 'A rolled edge means no hard line against the wrist bone. Opens at the back to slip on.', 'brass', 3, 'One size', 'High shine'),
  ('lt-37', 37, 'Fine Chain Stack', 'Bracelets', 96, NULL, 'Three fine strands on one clasp, so a layered look does not mean three separate fastenings.', 'gold', 5, '6.5" + ext.', 'Hand-polished'),
  ('lt-38', 38, 'ID Bar Bracelet', 'Bracelets', 148, 179, 'A flat bar on a curb chain, left blank. The underside takes an engraving cleanly.', 'steel', 6, '7" chain', 'Brushed matte'),
  ('lt-39', 39, 'Double Wrap', 'Bracelets', 138, NULL, 'A long strand that goes twice around, finishing at a toggle you can work one-handed.', 'mixed', 5, 'One size', 'Tumbled finish'),
  ('lt-40', 40, 'Beaded Line', 'Bracelets', 74, NULL, 'Small cast beads strung on steel cable — flexible, and it will not stretch out over a year.', 'verdigris', 7, '6.5" + ext.', 'High shine')
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
