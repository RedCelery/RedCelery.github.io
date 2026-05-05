/**
 * Local dev only (injected when `hugo.IsServer`).
 * Edits article HTML in-browser; drafts in localStorage (keyed by language + path).
 * Copy back as plain text or Markdown (Turndown, loaded in baseof when IsServer).
 */
(function () {
  var STORAGE_PREFIX = 'redcelery-dev-edit:';

  function pageLang() {
    var a = document.documentElement.getAttribute('data-dev-edit-lang');
    if (a) return a;
    var lang = document.documentElement.lang || '';
    return lang.split('-')[0] || 'en';
  }

  /** Current storage key: prefix + Lang + pathname (中英/多语言互不覆盖). */
  function storageKey() {
    return STORAGE_PREFIX + pageLang() + ':' + location.pathname;
  }

  /** Keys from before lang was included in the key (one-time migrate). */
  function legacyStorageKey() {
    return STORAGE_PREFIX + location.pathname;
  }

  function migrateLegacyDraft() {
    try {
      var k = storageKey();
      var leg = legacyStorageKey();
      if (localStorage.getItem(k)) return;
      var v = localStorage.getItem(leg);
      if (!v) return;
      localStorage.setItem(k, v);
      localStorage.removeItem(leg);
    } catch (e) {}
  }

  function getContentEl() {
    var article = document.querySelector('article.page.single');
    if (!article) return null;
    return article.querySelector('#content.content') || article.querySelector('#content');
  }

  function createTurndown() {
    if (typeof TurndownService === 'undefined') return null;
    return new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
    });
  }

  function htmlToMarkdown(html) {
    var td = createTurndown();
    if (!td) return '';
    try {
      return td.turndown(html || '');
    } catch (e) {
      return '';
    }
  }

  function copyToClipboard(text, btn, okLabel) {
    okLabel = okLabel || '已复制';
    var orig = btn.textContent;
    function done() {
      btn.textContent = okLabel;
      setTimeout(function () {
        btn.textContent = orig;
      }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e2) {}
      document.body.removeChild(ta);
      done();
    }
  }

  function createBar() {
    var bar = document.createElement('div');
    bar.id = 'dev-inline-edit-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Development inline edit');
    var lang = pageLang();
    bar.innerHTML =
      '<div class="dev-inline-edit-bar__inner">' +
      '<span class="dev-inline-edit-bar__badge">dev</span>' +
      '<span class="dev-inline-edit-bar__lang" title="草稿按此语言与路径分键">' +
      lang +
      '</span>' +
      '<button type="button" class="dev-inline-edit-bar__btn" id="dev-edit-toggle">编辑正文</button>' +
      '<button type="button" class="dev-inline-edit-bar__btn" id="dev-copy-plain">复制纯文本</button>' +
      '<button type="button" class="dev-inline-edit-bar__btn" id="dev-copy-md">复制 Markdown</button>' +
      '<button type="button" class="dev-inline-edit-bar__btn dev-inline-edit-bar__btn--ghost" id="dev-clear">清除草稿</button>' +
      '<span class="dev-inline-edit-bar__hint">仅 hugo server，不写入 md；中英草稿分键存储，改完复制回编辑器</span>' +
      '</div>';
    document.body.appendChild(bar);
    return bar;
  }

  function init() {
    migrateLegacyDraft();

    var el = getContentEl();
    if (!el) return;

    var bar = createBar();
    var toggle = document.getElementById('dev-edit-toggle');
    var copyPlain = document.getElementById('dev-copy-plain');
    var copyMd = document.getElementById('dev-copy-md');
    var clearBtn = document.getElementById('dev-clear');
    var editing = false;

    if (typeof TurndownService === 'undefined') {
      copyMd.disabled = true;
      copyMd.title = 'Turndown 脚本未加载（请检查网络后刷新）';
    }

    function setEditing(on) {
      editing = on;
      el.contentEditable = on ? 'true' : 'false';
      document.body.classList.toggle('dev-inline-edit--on', on);
      toggle.textContent = on ? '结束编辑' : '编辑正文';
      if (on) el.focus();
    }

    function save() {
      try {
        localStorage.setItem(storageKey(), el.innerHTML);
      } catch (e) {}
    }

    function loadDraft() {
      var html = localStorage.getItem(storageKey());
      if (html) {
        el.innerHTML = html;
      }
    }

    var t;
    el.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(save, 400);
    });

    toggle.addEventListener('click', function () {
      if (!editing) {
        setEditing(true);
      } else {
        save();
        setEditing(false);
      }
    });

    copyPlain.addEventListener('click', function () {
      copyToClipboard(el.innerText || '', copyPlain, '已复制');
    });

    copyMd.addEventListener('click', function () {
      if (typeof TurndownService === 'undefined') {
        window.alert('Turndown 未加载，无法转 Markdown。请确认能访问 cdn.jsdelivr.net 后刷新。');
        return;
      }
      var md = htmlToMarkdown(el.innerHTML);
      if (!md.trim()) {
        window.alert('转换结果为空，可改用「复制纯文本」或检查正文 HTML。');
        return;
      }
      copyToClipboard(md, copyMd, '已复制 MD');
    });

    clearBtn.addEventListener('click', function () {
      if (!confirm('清除本页（当前语言）的本地编辑草稿？')) return;
      localStorage.removeItem(storageKey());
      try {
        localStorage.removeItem(legacyStorageKey());
      } catch (e) {}
      if (editing) setEditing(false);
      location.reload();
    });

    if (localStorage.getItem(storageKey())) {
      var note = document.createElement('div');
      note.className = 'dev-inline-edit-restore';
      note.innerHTML =
        '<span>检测到本地草稿（' +
        pageLang() +
        '）</span>' +
        '<button type="button" id="dev-restore-yes">恢复</button>' +
        '<button type="button" id="dev-restore-no">忽略</button>';
      bar.querySelector('.dev-inline-edit-bar__inner').insertBefore(note, bar.querySelector('.dev-inline-edit-bar__inner').firstChild);

      document.getElementById('dev-restore-yes').addEventListener('click', function () {
        loadDraft();
        note.remove();
      });
      document.getElementById('dev-restore-no').addEventListener('click', function () {
        note.remove();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
