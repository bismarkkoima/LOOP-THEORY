/* ============================================================
   Loop Theory — motion.js
   Entrance motion for the storefront and the reading pages.

   Two rules this file will not break:

   1. Nothing is hidden by CSS alone. The hidden state is applied
      by this script, so if it never runs — old browser, blocked
      file, a thrown error above — the page renders in full.
   2. prefers-reduced-motion is honoured by leaving immediately,
      before anything is marked.

   The grid re-renders on every filter and search, so new cards
   are picked up through a MutationObserver rather than a single
   pass at load.
   ============================================================ */

(function () {
  'use strict';

  if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) return;

  const SELECTORS = [
    '.section-head',
    '.value',
    '.prose section',
    '.facts .fact',
    '.page-cta-inner',
    '.foot-grid > *'
  ];

  const seen = new WeakSet();

  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

  function watch(el, index) {
    if (!el || seen.has(el)) return;
    seen.add(el);

    /* Already on screen at load: show it immediately rather than
       animating something the eye has arrived on. */
    const box = el.getBoundingClientRect();
    if (box.top < window.innerHeight * 0.92 && box.bottom > 0) {
      el.classList.add('lt-rise', 'is-in');
      return;
    }

    el.classList.add('lt-rise');
    if (index) el.style.setProperty('--lt-delay', Math.min(index, 7) * 45 + 'ms');
    io.observe(el);
  }

  function scan(root) {
    SELECTORS.forEach(function (sel) {
      Array.prototype.forEach.call((root || document).querySelectorAll(sel), function (el) {
        watch(el, 0);
      });
    });
  }

  /* ---------- the product grid ---------- */

  function sweepGrid(grid) {
    Array.prototype.forEach.call(grid.children, function (card, i) {
      watch(card, i);
    });
  }

  function init() {
    document.body.classList.add('lt-motion');
    scan(document);

    const grid = document.getElementById('grid');
    if (grid) {
      sweepGrid(grid);
      new MutationObserver(function () { sweepGrid(grid); })
        .observe(grid, { childList: true });
    }

    /* The hero is above the fold by definition, so it runs on load
       rather than waiting for a scroll that has not happened. */
    const hero = document.querySelector('.hero-copy, .page-hero-inner');
    if (hero) {
      Array.prototype.forEach.call(hero.children, function (el, i) {
        el.classList.add('lt-lift');
        el.style.setProperty('--lt-delay', (i * 70) + 'ms');
      });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { hero.classList.add('is-in'); });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
