/**
 * sutra-cover.js — 頁面控制器／膠水
 *
 * 只做 DOM 的事：讀寫欄位、綁事件、把參數套到預覽那張紙、量版面、i18n 重繪、toast。
 * 參數的正規化、網址格式、版面估算都在 sutra-cover-lib.js（純邏輯）。
 *
 * 核心約定：
 *   - **預覽就是列印內容**——列印不另外組一份 DOM，只由 @media print 藏掉其他東西。
 *   - 「佔可用高度」是**量出來的**（offsetHeight，不受縮放 transform 影響），不是算出來的；
 *     lib 的 maxChars() 只是「約可容納幾字」的估計，畫面上標「約」。
 *   - 字型有沒有真的用上魏碑，**量像素判斷**（CJK 載體字元寬度恆為 1em，量寬度必然回報「沒裝」），
 *     並分三態：用上／沒用上／量不出來——量不出來不可以落進任何一個結論。
 */
(function () {
  'use strict';

  var Lib = window.SutraCoverLib;
  var setIconDone = window.SideTool.setIconDone;

  var THEME_KEY = 'sutra-cover-theme';

  var el = {};
  var writing = false;       // 程式寫欄位時抑制自己的 input handler
  var fontState = null;      // 'yes' | 'no' | 'unknown'
  var lastFit = null;
  var savedTitle = null;     // 列印時暫換 document.title（存 PDF 的預設檔名）

  // ── 小工具 ────────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }
  function t(key, params) { return window.I18n ? window.I18n.t(key, params) : key; }
  function esc(s) { return window._ ? _.escape(s) : String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); }

  function toast(html, cls) {
    if (window.M && M.toast) M.toast({ html: html, classes: cls || '', displayLength: 2200 });
  }

  function setValue(input, value) {
    writing = true;
    input.value = value;
    writing = false;
  }

  /** 複製到剪貼簿：clipboard API → execCommand 退路 → 紅色 toast */
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    function done(ok) { toast(t(ok ? 'toast.copied' : 'toast.copyFail'), ok ? 'teal' : 'red'); return ok; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return done(true); },
        function () { return done(fallback()); });
    }
    return Promise.resolve(done(fallback()));
  }

  // ── 參數 ⇄ 欄位 ───────────────────────────────────────────────────────

  function readInputs() {
    return Lib.normalize({
      title: el.title.value,
      author: el.author.value,
      size: el.size.value,
      ls: el.ls.value
    });
  }

  function writeInputs(p) {
    setValue(el.title, p.title);
    setValue(el.author, p.author);
    setValue(el.size, p.size);
    setValue(el.sizeRange, p.size);
    setValue(el.ls, p.ls);
    setValue(el.lsRange, p.ls);
    if (window.M && M.updateTextFields) M.updateTextFields();
  }

  function initRanges() {
    [['size', el.size, el.sizeRange], ['ls', el.ls, el.lsRange]].forEach(function (x) {
      var lim = Lib.LIMITS[x[0]];
      [x[1], x[2]].forEach(function (input) {
        input.min = lim.min;
        input.max = lim.max;
        input.step = lim.step;
      });
    });
  }

  // ── 預覽 ──────────────────────────────────────────────────────────────

  function applyToSheet(p) {
    el.cvTitle.textContent = p.title;
    el.cvAuthor.textContent = p.author;
    el.sheet.style.setProperty('--title-size', p.size + 'pt');
    el.sheet.style.setProperty('--title-ls', p.ls + 'em');
    el.sheet.style.setProperty('--title-comp', Lib.trailingCompensation(p.ls) + 'em');
  }

  /** 把真實尺寸的紙縮到欄寬；frame 高度要自己補（transform 不影響版面盒） */
  function fitSheetToFrame() {
    var w = el.sheet.offsetWidth;
    var h = el.sheet.offsetHeight;
    var avail = el.frame.clientWidth;
    if (!w || !avail) return;
    var scale = Math.min(1, avail / w);
    el.sheet.style.setProperty('--sheet-scale', String(scale));
    el.frame.style.height = Math.ceil(h * scale) + 'px';
  }

  /** 量：題名欄（含末字抵銷後）實際佔多高，與紙內可用高度比 */
  function measureFit() {
    var cs = getComputedStyle(el.sheet);
    var padTop = parseFloat(cs.paddingTop) || 0;
    var padBottom = parseFloat(cs.paddingBottom) || 0;
    var usable = el.sheet.clientHeight - padTop - padBottom - Lib.TOP_PX;
    var used = el.cover.offsetHeight - Lib.TOP_PX;
    return { usedPx: used, usablePx: usable, ratio: usable > 0 ? used / usable : NaN };
  }

  function render() {
    var p = readInputs();
    applyToSheet(p);

    var q = Lib.buildQuery(p, location.search);
    if (location.search !== q) history.replaceState(null, '', location.pathname + q);

    var fit = measureFit();
    lastFit = fit;
    var state = Lib.fitState(fit.ratio);
    el.sheet.classList.toggle('is-over', state === 'over');

    var n = Lib.countChars(p.title);
    el.m.chars.textContent = String(n);
    el.m.ratio.textContent = p.title ? Lib.formatNumber(fit.ratio * 100, 1) : '—';
    el.m.span.textContent = p.title
      ? t('status.span', {
        used: Lib.formatNumber(Lib.ptToMm(Lib.pxToPt(fit.usedPx)), 1),
        avail: Lib.formatNumber(Lib.ptToMm(Lib.pxToPt(fit.usablePx)), 1)
      })
      : '';
    el.m.max.textContent = t('status.about', { n: Lib.maxChars(p.size, p.ls) });

    var msg = '';
    if (!p.title) msg = '<span class="is-warn">' + esc(t('fit.empty')) + '</span>';
    else if (state === 'over') msg = '<span class="is-danger">' + esc(t('fit.over')) + '</span>';
    else if (state === 'tight') msg = '<span class="is-warn">' + esc(t('fit.tight')) + '</span>';
    el.fitMessage.innerHTML = msg;
    renderFontMessage();
  }

  var renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 60);
  }

  // ── 字型偵測（量像素，三態）────────────────────────────────────────────

  function drawSignature(ctx, font, text) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = font;
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'top';
    ctx.fillText(text, 4, 4);
    var d = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
    var sig = 0;
    for (var i = 3; i < d.length; i += 4) sig = (sig * 31 + d[i] * (i % 997 + 1)) % 2147483647;
    return sig;
  }

  function detectFont() {
    try {
      var c = document.createElement('canvas');
      c.width = 320; c.height = 64;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return 'unknown';
      var sample = '即身成佛義經';
      var serif = drawSignature(ctx, 'bold 48px serif', sample);
      var sans = drawSignature(ctx, 'bold 48px sans-serif', sample);
      // 對照組：serif 與 sans-serif 畫出來要不一樣，否則這台的 canvas 量不出字型差（或被隱私保護遮掉）
      if (serif === sans) return 'unknown';
      var target = drawSignature(ctx, "bold 48px '" + Lib.FONT_FAMILY + "', serif", sample);
      return target === serif ? 'no' : 'yes';
    } catch (e) {
      return 'unknown';
    }
  }

  function renderFontMessage() {
    if (!fontState) { el.fontMessage.textContent = ''; return; }
    var cls = fontState === 'yes' ? 'is-ok' : (fontState === 'no' ? 'is-warn' : '');
    el.fontMessage.innerHTML = '<span class="' + cls + '">' +
      esc(t('font.' + fontState, { f: Lib.FONT_FAMILY })) + '</span>';
  }

  // ── 列印 ──────────────────────────────────────────────────────────────

  function doPrint() {
    render();
    if (lastFit && Lib.fitState(lastFit.ratio) === 'over') toast(t('toast.printOver'), 'orange');
    window.print();
  }

  // ── 主題 ──────────────────────────────────────────────────────────────

  function applyTheme(theme) {
    var r = document.documentElement;
    r.setAttribute('data-theme', theme);
    r.classList.toggle('dark-mode', theme === 'dark');
    r.classList.toggle('light-mode', theme === 'light');
    el.modeIcon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { }
  }

  // ── 初始化 ────────────────────────────────────────────────────────────

  function cacheEls() {
    ['title', 'author', 'size', 'ls'].forEach(function (k) { el[k] = $(k); });
    el.sizeRange = $('size-range');
    el.lsRange = $('ls-range');
    el.frame = $('sheet-frame');
    el.sheet = $('sheet');
    el.cover = $('cover');
    el.cvTitle = $('cv-title');
    el.cvAuthor = $('cv-author');
    el.fitMessage = $('fit-message');
    el.fontMessage = $('font-message');
    el.modeIcon = document.querySelector('#setting-mode i');
    el.m = { chars: $('m-chars'), ratio: $('m-ratio'), span: $('m-span'), max: $('m-max') };
  }

  function bindInputs() {
    [el.title, el.author].forEach(function (input) {
      input.addEventListener('input', function () { if (!writing) scheduleRender(); });
    });
    // 滑桿 ⇄ 數字框：拖拉即時、打字延後；數字框離開時寫回夾過的值
    [[el.size, el.sizeRange], [el.ls, el.lsRange]].forEach(function (pair) {
      var num = pair[0], range = pair[1];
      range.addEventListener('input', function () {
        if (writing) return;
        setValue(num, range.value);
        render();
      });
      num.addEventListener('input', function () {
        if (writing) return;
        if (num.value !== '' && isFinite(parseFloat(num.value))) setValue(range, num.value);
        scheduleRender();
      });
      num.addEventListener('change', function () {
        writeInputs(readInputs());
        render();
      });
    });
  }

  function bindTools() {
    $('btn-print').addEventListener('click', function (e) { e.preventDefault(); doPrint(); });
    $('setting-print').addEventListener('click', doPrint);

    $('btn-reset').addEventListener('click', function (e) {
      e.preventDefault();
      var p = readInputs();
      p.size = Lib.DEFAULTS.size;
      p.ls = Lib.DEFAULTS.ls;
      writeInputs(p);
      render();
    });

    $('setting-link').addEventListener('click', function () {
      copyText(location.origin + location.pathname + Lib.buildQuery(readInputs()));
      setIconDone('setting-link');
    });

    $('setting-mode').addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });

    $('setting-lang').addEventListener('click', function () {
      var next = window.I18n.cycle();
      toast(t('toast.lang', { name: window.I18n.name(next) }), 'teal');
      setIconDone('setting-lang');
    });

    // 存成 PDF 時的預設檔名取 document.title：列印期間換成「封面：題名」（同原型），印完換回
    window.addEventListener('beforeprint', function () {
      var p = readInputs();
      savedTitle = document.title;
      if (p.title) document.title = t('print.docTitle', { t: p.title });
    });
    window.addEventListener('afterprint', function () {
      if (savedTitle != null) document.title = savedTitle;
      savedTitle = null;
    });
  }

  function init() {
    cacheEls();
    initRanges();

    // 初始值：預設 ← 深連結覆蓋
    writeInputs(Lib.normalize(Lib.parseQuery(location.search)));

    bindInputs();
    bindTools();

    window.I18n.apply();
    var theme = 'dark';
    try { theme = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { }
    applyTheme(theme);

    if (window.ResizeObserver) new ResizeObserver(fitSheetToFrame).observe(el.frame);
    else window.addEventListener('resize', fitSheetToFrame);
    fitSheetToFrame();

    document.addEventListener('i18n:changed', function () {
      window.I18n.apply();
      render();
    });

    fontState = detectFont();
    render();
    // 系統字型可能晚一拍才可用：字型集就緒後再量一次（版面與字型兩者都是）
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { fontState = detectFont(); render(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
