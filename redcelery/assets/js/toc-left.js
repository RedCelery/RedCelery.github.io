/**
 * KeepIt theme places #toc-auto to the right (~100ms after DOMContentLoaded) and
 * sets visibility:visible. Move it into the left gutter on desktop; run as soon
 * as the theme touches #toc-auto to avoid a right-side flash.
 */
(function () {
  var GAP = 20;
  var MAX_W = 280;
  var MIN_W = 140;

  function apply() {
    var toc = document.getElementById('toc-auto');
    if (!toc) return;
    if (toc.style.visibility !== 'visible' && getComputedStyle(toc).visibility !== 'visible') return;

    var page = document.querySelector('article.page.single');
    if (!page) return;

    var rect = page.getBoundingClientRect();
    var leftGutter = rect.left - GAP;
    var w = Math.min(MAX_W, Math.max(MIN_W, leftGutter - GAP));
    if (w < 100) {
      toc.classList.add('toc-auto--skip');
      return;
    }

    toc.classList.remove('toc-auto--skip');
    toc.style.left = rect.left - w - GAP + 'px';
    toc.style.maxWidth = w + 'px';
    toc.style.width = w + 'px';
    toc.classList.add('toc-auto--left');
  }

  function observeToc(toc) {
    if (!toc || toc.__tocLeftObserved) return;
    toc.__tocLeftObserved = true;
    var mo = new MutationObserver(function () {
      apply();
    });
    mo.observe(toc, { attributes: true, attributeFilter: ['style'] });
  }

  function boot() {
    var toc = document.getElementById('toc-auto');
    observeToc(toc);
    apply();

    var n = 0;
    function rafChain() {
      apply();
      if (++n < 48) requestAnimationFrame(rafChain);
    }
    requestAnimationFrame(rafChain);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('load', function () {
    apply();
    setTimeout(apply, 50);
    setTimeout(apply, 150);
  });

  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(apply, 120);
  });
})();
