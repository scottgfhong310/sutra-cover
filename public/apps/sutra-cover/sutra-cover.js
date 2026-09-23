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
 *   - 封面清單（右側 sidenav，形制照 markdown-reader）：**一個編號一份**；儲存先試「新建」，
 *     409 才問要不要覆寫——「先查清單再決定」是 TOCTOU（§3.3），撞號交給後端判。
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
  var covers = [];           // 伺服器上的封面（已依編號排序）
  var currentCode = null;    // 目前表單載入自（或剛存成）哪一份
  var skipped = [];          // 伺服器讀不進來的檔名

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
      code: el.code.value,
      title: el.title.value,
      author: el.author.value,
      size: el.size.value,
      ls: el.ls.value
    });
  }

  function writeInputs(p) {
    setValue(el.code, p.code);
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

  // ── 封面清單 ──────────────────────────────────────────────────────────

  function renderList() {
    if (!covers.length) {
      el.sideNav.innerHTML = '<li class="is-empty"><a>' + esc(t('side.empty')) + '</a></li>';
      renderSkipped();
      return;
    }
    el.sideNav.innerHTML = covers.map(function (c) {
      var code = esc(c.code);
      return '<li class="cover-item' + (c.code === currentCode ? ' active' : '') + '" data-code="' + code + '">' +
        '<a href="#!" class="cover-open" data-code="' + code + '">' +
        '<span class="cv-code">' + code + '</span>' +
        '<span class="cv-name">' + esc(c.title || '—') + '</span></a>' +
        '<button type="button" class="cover-del" data-code="' + code + '" title="' + esc(t('tool.delete')) + '"' +
        ' aria-label="' + esc(t('tool.delete')) + '"><i class="material-icons">delete_outline</i></button></li>';
    }).join('');
    applyNavFilter();
    renderSkipped();
  }

  /** 篩選：只切顯示、不重建 DOM（保留 active）；清除鈕由共用 filter-clear 派發 input 事件驅動 */
  function applyNavFilter() {
    var q = el.navFilter.value;
    el.sideNav.querySelectorAll('li[data-code]').forEach(function (li) {
      var c = covers.filter(function (x) { return x.code === li.dataset.code; })[0];
      li.style.display = (!c || Lib.matchCover(c, q)) ? '' : 'none';
    });
  }

  function refreshList() {
    return Lib.listCovers().then(function (r) {
      covers = r.covers;
      skipped = r.skipped;
      renderList();
    }).catch(function (e) {
      toast(t('toast.listFail', { m: esc(e.message) }), 'red');
    });
  }

  /** 讀不進來的檔（壞 JSON／檔名不合規）要在清單上講出來，而不是安靜地少幾筆 */
  function renderSkipped() {
    el.sideNote.textContent = skipped.length
      ? t('side.skipped', { n: skipped.length, list: skipped.join(', ') }) : '';
  }

  function setCurrent(code) {
    currentCode = code;
    el.sideNav.querySelectorAll('li[data-code]').forEach(function (li) {
      li.classList.toggle('active', li.dataset.code === code);
    });
  }

  function openCover(code) {
    return Lib.getCover(code).then(function (c) {
      writeInputs(Lib.normalize(c));
      render();
      setCurrent(c.code);
      var inst = M.Sidenav.getInstance(el.sidenav);
      if (inst && inst.isOpen) inst.close();
    }).catch(function (e) {
      toast(t('toast.loadFail', { n: esc(code), m: esc(e.message) }), 'red');
    });
  }

  function saveCurrent() {
    var p = readInputs();
    if (!Lib.isValidCode(p.code)) {
      toast(t('toast.codeInvalid'), 'red');
      el.code.focus();
      return Promise.resolve(false);
    }
    writeInputs(p);                                    // 把轉成大寫的編號寫回欄位
    function done(j) {
      setCurrent(j.cover.code);
      toast(t('toast.saved', { c: esc(j.cover.code) }), 'green');
      setIconDone('setting-save');
      return refreshList().then(function () { return true; });
    }
    return Lib.saveCover(p, false).then(done).catch(function (e) {
      if (e.code !== 'exists') throw e;
      // 已存在：問過再覆寫（覆寫前伺服器會先 .bak）
      if (!window.confirm(t('confirm.overwrite', { c: p.code }))) return false;
      return Lib.saveCover(p, true).then(done);
    }).catch(function (e) {
      toast(t('toast.saveFail', { m: esc(e.message) }), 'red');
      return false;
    });
  }

  function deleteCover(code) {
    var c = covers.filter(function (x) { return x.code === code; })[0];
    if (!window.confirm(t('confirm.delete', { c: code, t: (c && c.title) || '' }))) return;
    Lib.deleteCover(code).then(function () {
      if (currentCode === code) currentCode = null;
      toast(t('toast.deleted', { n: esc(code) }), 'teal');
      return refreshList();
    }).catch(function (e) {
      toast(t('toast.deleteFail', { m: esc(e.message) }), 'red');
    });
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
    ['code', 'title', 'author', 'size', 'ls'].forEach(function (k) { el[k] = $(k); });
    el.sidenav = $('slide-out');
    el.sideNav = $('side-nav');
    el.sideNote = $('side-note');
    el.navFilter = $('nav-filter');
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
    [el.code, el.title, el.author].forEach(function (input) {
      input.addEventListener('input', function () { if (!writing) scheduleRender(); });
    });
    // 編號離開欄位時正規化（去空白、轉大寫）——打字中不動它，免得游標亂跳
    el.code.addEventListener('change', function () {
      setValue(el.code, Lib.cleanCode(el.code.value));
      if (window.M && M.updateTextFields) M.updateTextFields();
      scheduleRender();
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
    $('setting-menu').addEventListener('click', function () {
      var inst = M.Sidenav.getInstance(el.sidenav);
      if (!inst) return;
      if (inst.isOpen) { inst.close(); return; }
      refreshList();
      inst.open();
    });
    $('setting-save').addEventListener('click', saveCurrent);

    // Ctrl／⌘-S ＝儲存（不讓瀏覽器跳出「另存網頁」）
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveCurrent();
      }
    });

    el.sideNav.addEventListener('click', function (e) {
      var del = e.target.closest('.cover-del');
      if (del) { e.preventDefault(); deleteCover(del.dataset.code); return; }
      var open = e.target.closest('.cover-open');
      if (open) { e.preventDefault(); openCover(open.dataset.code); }
    });
    el.navFilter.addEventListener('input', applyNavFilter);

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
    var fromUrl = Lib.parseQuery(location.search);
    writeInputs(Lib.normalize(fromUrl));

    // 右側清單（§5.5：側欄開啟時工具列淡出）。
    // ⚠️ 移除 class 綁 onCloseStart 不綁 onCloseEnd——背景分頁的動畫不跑完，onCloseEnd 永遠等不到
    M.Sidenav.init(el.sidenav, {
      edge: 'right',
      onOpenStart: function () { document.body.classList.add('sidenav-open'); },
      onCloseStart: function () { document.body.classList.remove('sidenav-open'); }
    });

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
      renderList();
    });

    fontState = detectFont();
    render();
    refreshList().then(function () {
      // 只帶編號的連結（?c=T2428）＝開啟那一份已存的封面
      var code = fromUrl.code !== undefined ? Lib.cleanCode(fromUrl.code) : '';
      var onlyCode = code && fromUrl.title === undefined && fromUrl.author === undefined;
      if (onlyCode) return openCover(code);
      if (code && covers.some(function (c) { return c.code === code; })) setCurrent(code);
    });
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
