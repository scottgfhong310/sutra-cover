/**
 * sutra-cover-lib.js — 典籍封面編排的核心 library（純邏輯、不碰 DOM）
 *
 * 版式來源：InProgress/public/lib/cover.html（owner 的原型）。
 *   - 直排（vertical-rl、upright），題名在右、譯者／作者在左，兩欄**底部對齊**、水平置中。
 *   - 題名：字級 36pt、字距 1.25em，並以 margin-inline-end = −字距 抵銷末字後多出的字距
 *     ——**那個抵銷與字距是同一個數字**，本 lib 以 trailingCompensation() 一處給出。
 *   - 譯者／作者：16pt、字距 0.2em、底部內縮 0.3em；兩欄間距 0.8em（以 12pt 計，不隨題名縮放）。
 *   - 上方留白 125px（原型用 body padding-top 取代空白列）。
 * 可調的只有**題名的字級與字距**（owner 2026-09-23 拍板）；其餘照原型固定。
 *
 * 紙張固定 A4 直式（owner 拍板）。原型沒有 @page，於是邊界由印表機決定、畫面預覽不可能精確；
 * 本 app 改成 @page margin 0 ＋ 紙內留邊 PAGE.margin，**畫面上那張紙就是印出來的那張紙**。
 *
 * 資料：題名與作者是**資料**，不翻譯；全形空格（U+3000）原樣保留——
 * 刻意不用 String.prototype.trim()，它會把 U+3000 一起剝掉。
 *
 * 後端 API：無（零後端，見 app.js）。輸入存在網址列（?t=&a=&s=&ls=），複製連結＝存檔。
 *
 * Public API（window.SutraCoverLib）：
 *   DEFAULTS, LIMITS, AUTHOR, PAGE, TOP_PX, FONT_FAMILY
 *   normalize(input)               → { title, author, size, ls }（夾值、NaN 退回預設）
 *   cleanText(s)                   → 去掉換行與控制字元、截長；保留全形空格
 *   parseQuery(search)             → 網址帶了的那幾個欄位（部分物件）
 *   buildQuery(params, baseSearch) → '?…&t=…&a=…&s=…&ls=…'（保留 baseSearch 裡其他參數）
 *   trailingCompensation(ls)       → 題名末字字距抵銷（em，負值）
 *   countChars(s)                  → 字數（以碼位計，擴充區漢字算一個）
 *   availableHeightPt()            → A4 扣掉留邊與上方留白後，題名可用的高度（pt）
 *   titleSpanPt(n, size, ls)       → n 個字的題名實際佔高（pt，已扣末字字距）
 *   maxChars(size, ls)             → 這組字級／字距下最多放得下幾個字
 *   fitState(ratio)                → 'ok' | 'tight' | 'over'
 *   ptToMm(pt), pxToPt(px), formatNumber(x, digits)
 */
(function (window) {
  'use strict';

  var DEFAULTS = {
    title: '即身成佛義',
    author: '遍照金剛\u3000撰',      // 中間為全形空格（U+3000），同原型
    size: 36,                        // pt
    ls: 1.25                         // em
  };

  var LIMITS = {
    size: { min: 8, max: 96, step: 0.5 },
    ls: { min: 0, max: 3, step: 0.05 },
    text: 200                        // 題名／作者的長度上限（碼位）
  };

  /** 譯者／作者欄：照原型固定、不開放調整 */
  var AUTHOR = { size: 16, ls: 0.2, padBottom: 0.3 };

  /** 兩欄間距 0.8em——原型寫在 .cover 上，而 .cover 的字級是瀏覽器預設的 16px（＝12pt），
      **不是題名字級**，所以間距固定 12.8px、不隨題名縮放。⚠️ Materialize 會把 html 字級改成
      14–15px，故 CSS 那邊把 .cover 明寫成 COVER_PT，否則間距會安靜地變小。 */
  var GAP_EM = 0.8;
  var COVER_PT = 12;

  /** 上方留白（px）：原型的 body padding-top */
  var TOP_PX = 125;

  /** 紙張：A4 直式；margin 是紙內留邊（mm），@page 本身 margin 0 */
  var PAGE = { width: 210, height: 297, margin: 10 };

  /** 字型族名（CSS 那邊寫同一個名字；scripts/verify.js 盯著兩處一致） */
  var FONT_FAMILY = 'Weibei TC';

  var PT_PER_MM = 72 / 25.4;
  var PT_PER_PX = 0.75;

  // ── 小工具 ────────────────────────────────────────────────────────────

  function ptToMm(pt) { return pt / PT_PER_MM; }
  function pxToPt(px) { return px * PT_PER_PX; }

  function formatNumber(x, digits) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    var d = digits == null ? 2 : digits;
    return String(Number(x.toFixed(d)));
  }

  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  /** 對齊到 step 的整數倍（避免 0.1 + 0.2 那種尾數跑進網址） */
  function snap(x, step) {
    var decimals = (String(step).split('.')[1] || '').length;
    return Number((Math.round(x / step) * step).toFixed(decimals));
  }

  function toNumber(v, fallback, lim) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(n)) return fallback;
    return snap(clamp(n, lim.min, lim.max), lim.step);
  }

  /**
   * 文字欄清理：換行／tab／控制字元一律拿掉（封面是單行直排，換行在直排裡會變成「換欄」），
   * 截到 LIMITS.text 個碼位。**不 trim**——U+3000 是版式的一部分。
   */
  function cleanText(s) {
    if (s == null) return '';
    var out = String(s).replace(/[\u0000-\u001f\u007f]/g, '');
    var chars = Array.from(out);
    if (chars.length > LIMITS.text) out = chars.slice(0, LIMITS.text).join('');
    return out;
  }

  function countChars(s) { return Array.from(String(s || '')).length; }

  // ── 參數 ──────────────────────────────────────────────────────────────

  /**
   * 正規化：任何來源（表單、網址、程式）都經過這裡。
   * 文字欄：undefined → 預設；其餘（含 ''）照使用者給的——**清空是一個合法的意圖**，
   * 不可以被讀成「沒給」而補回範例文字。
   */
  function normalize(input) {
    var i = input || {};
    return {
      title: i.title === undefined ? DEFAULTS.title : cleanText(i.title),
      author: i.author === undefined ? DEFAULTS.author : cleanText(i.author),
      size: toNumber(i.size, DEFAULTS.size, LIMITS.size),
      ls: toNumber(i.ls, DEFAULTS.ls, LIMITS.ls)
    };
  }

  var QUERY_KEYS = { t: 'title', a: 'author', s: 'size', ls: 'ls' };

  function parseQuery(search) {
    var out = {};
    var q = new URLSearchParams(search || '');
    Object.keys(QUERY_KEYS).forEach(function (k) {
      if (q.has(k)) out[QUERY_KEYS[k]] = q.get(k);
    });
    return out;
  }

  /**
   * baseSearch（可省）：保留其中**不歸本 app 管**的參數（例如 i18n 的 ?lang=）。
   * 控制器每次重繪都 replaceState；不保留的話，帶 ?lang=ja 開進來的頁面第一次重繪就把它丟了。
   */
  function buildQuery(params, baseSearch) {
    var p = normalize(params);
    var q = new URLSearchParams(baseSearch || '');
    Object.keys(QUERY_KEYS).forEach(function (k) { q.delete(k); });
    q.set('t', p.title);
    q.set('a', p.author);
    q.set('s', String(p.size));
    q.set('ls', String(p.ls));
    return '?' + q.toString();
  }

  // ── 版面 ──────────────────────────────────────────────────────────────

  function trailingCompensation(ls) { return -ls; }

  /** 題名可用高度（pt）：紙高 − 上下留邊 − 上方留白 */
  function availableHeightPt() {
    return (PAGE.height - 2 * PAGE.margin) * PT_PER_MM - pxToPt(TOP_PX);
  }

  /**
   * n 個字的題名佔高（pt）。直排 upright 下 CJK 每字前進 1em，字距加在每一字之後，
   * 末字那一份被 trailingCompensation 抵掉：n·size·(1+ls) − size·ls。
   * ⚠️ 這是**估計**（假設每字 1em）；畫面上的「佔頁高」是控制器量 DOM 量出來的實際值。
   */
  function titleSpanPt(n, size, ls) {
    if (!(n > 0)) return 0;
    return n * size * (1 + ls) - size * ls;
  }

  function maxChars(size, ls) {
    var avail = availableHeightPt();
    // n·size·(1+ls) − size·ls ≤ avail  ⇒  n ≤ (avail + size·ls) / (size·(1+ls))
    return Math.max(0, Math.floor((avail + size * ls) / (size * (1 + ls)) + 1e-9));
  }

  /** ratio＝實際佔高 ÷ 可用高度。> 1 是會被裁掉；> 0.95 是貼底（底部對齊時作者欄也貼底） */
  function fitState(ratio) {
    if (!(ratio >= 0)) return 'ok';
    if (ratio > 1 + 1e-6) return 'over';
    if (ratio > 0.95) return 'tight';
    return 'ok';
  }

  window.SutraCoverLib = {
    DEFAULTS: DEFAULTS,
    LIMITS: LIMITS,
    AUTHOR: AUTHOR,
    GAP_EM: GAP_EM,
    COVER_PT: COVER_PT,
    TOP_PX: TOP_PX,
    PAGE: PAGE,
    FONT_FAMILY: FONT_FAMILY,
    normalize: normalize,
    cleanText: cleanText,
    parseQuery: parseQuery,
    buildQuery: buildQuery,
    trailingCompensation: trailingCompensation,
    countChars: countChars,
    availableHeightPt: availableHeightPt,
    titleSpanPt: titleSpanPt,
    maxChars: maxChars,
    fitState: fitState,
    ptToMm: ptToMm,
    pxToPt: pxToPt,
    formatNumber: formatNumber
  };
})(window);
