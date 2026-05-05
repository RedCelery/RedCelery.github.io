/**
 * KeepIt theme places #toc-auto to the right of the article; move it into the
 * left gutter (desktop only — below 960px the theme hides #toc-auto anyway).
 */
(function () {
  var GAP = 20;
  var MAX_W = 280;
  var MIN_W = 140;

  function apply() {
    var toc = document.getElementById('toc-auto');
    if (!toc || toc.style.visibility !== 'visible') return;
    var page = document.querySelector('article.page.single');
    if (!page) return;
    var rect = page.getBoundingClientRect();
    var leftGutter = rect.left - GAP;
    var w = Math.min(MAX_W, Math.max(MIN_W, leftGutter - GAP));
    if (w < 100) return;
    toc.style.left = rect.left - w - GAP + 'px';
    toc.style.maxWidth = w + 'px';
    toc.style.width = w + 'px';
    toc.classList.add('toc-auto--left');
  }

  function schedule() {
    apply();
    setTimeout(apply, 200);
    setTimeout(apply, 500);
  }

  if (document.readyState === 'complete') {
    schedule();
  } else {
    window.addEventListener('load', schedule);
  }
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(apply, 250);
  });

  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(apply, 120);
  });
})();
