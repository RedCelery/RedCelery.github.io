/**
 * Home matrix: random gray fills; jittered wave; random flip axis (scaleX vs scaleY keyframes).
 */
(function () {
  var COL_STEP_S = 0.032;
  var JITTER_S = 0.45;
  var DUR_MIN = 1.85;
  var DUR_SPREAD = 1;

  function isDarkTheme() {
    return document.body.getAttribute("theme") === "dark";
  }

  /** 白→浅灰（亮色） / 中灰（暗色背景） */
  function randomGrayChannel(dark) {
    if (dark) {
      return 62 + Math.floor(Math.random() * 78);
    }
    return 198 + Math.floor(Math.random() * 52);
  }

  function applyDotColors() {
    var dots = document.querySelectorAll(".home-matrix-hero__dot");
    if (!dots.length) return;
    var dark = isDarkTheme();
    for (var i = 0; i < dots.length; i++) {
      var g = randomGrayChannel(dark);
      dots[i].style.backgroundColor = "rgb(" + g + "," + g + "," + g + ")";
    }
  }

  function applyWaveTiming() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var dots = document.querySelectorAll(".home-matrix-hero__dot");
    if (!dots.length) return;

    for (var i = 0; i < dots.length; i++) {
      var el = dots[i];
      var col = parseFloat(window.getComputedStyle(el).getPropertyValue("--col"));
      if (isNaN(col)) col = 0;
      var base = col * COL_STEP_S;
      var jitter = (Math.random() - 0.5) * JITTER_S;
      el.style.animationDelay = Math.max(0, base + jitter) + "s";
      el.style.animationDuration = DUR_MIN + Math.random() * DUR_SPREAD + "s";
      /* 竖条 / 横条翻转随机 */
      el.style.animationName =
        Math.random() < 0.5 ? "home-matrix-hero-flip-y" : "home-matrix-hero-flip-x";
    }
  }

  function run() {
    applyDotColors();
    applyWaveTiming();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
