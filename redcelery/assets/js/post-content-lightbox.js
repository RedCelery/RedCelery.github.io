/**
 * Wrap #content images in LightGallery anchors + a zoom button.
 * Runs before theme.js initLightGallery (via params.page.library.js order).
 * Only on post single (article.page.single), not About / list pages.
 */
(function () {
  if (!document.querySelector('article.page.single')) return;
  var root = document.getElementById('content');
  if (!root) return;

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function imageUrl(img) {
    return (
      img.getAttribute('data-src') ||
      img.getAttribute('data-lazy-src') ||
      img.currentSrc ||
      img.src ||
      ''
    );
  }

  /** LightGallery + lg-thumbnail use exThumbImage: 'data-thumbnail' (see theme.js). */
  function toAbsoluteUrl(u) {
    if (!u) return u;
    try {
      return new URL(u, document.baseURI || window.location.href).href;
    } catch (e) {
      return u;
    }
  }

  root.querySelectorAll('img').forEach(function (img) {
    if (img.closest('a.lightgallery')) return;
    if (img.closest('.post-img-lightbox')) return;
    if (img.closest('.highlight')) return;
    if (img.closest('.katex')) return;

    var raw = imageUrl(img);
    if (!raw || raw.indexOf('data:') === 0) return;
    if (raw.indexOf('loading.svg') !== -1) return;

    var wrap = document.createElement('span');
    wrap.className = 'post-img-lightbox';

    var abs = toAbsoluteUrl(raw);
    var a = document.createElement('a');
    a.className = 'lightgallery';
    a.href = abs;
    a.setAttribute('data-thumbnail', abs);
    if (img.alt) {
      a.setAttribute('data-sub-html', '<p>' + escapeHtml(img.alt) + '</p>');
    }

    var parent = img.parentNode;
    parent.insertBefore(wrap, img);
    wrap.appendChild(a);
    a.appendChild(img);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'post-img-zoom-btn';
    btn.setAttribute('aria-label', '放大图片');
    btn.innerHTML = '<i class="fas fa-search-plus" aria-hidden="true"></i>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      a.click();
    });
    wrap.appendChild(btn);
  });
})();
