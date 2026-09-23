#!/usr/bin/env node
/**
 * sutra-cover — 契約檢查（零依賴）
 *
 *   node scripts/verify.js            # 全部跑；任何一條 FAIL → exit 1
 *   SUTRA_COVER_ROOT=<dir> node …     # 對另一份副本跑（反向驗證：改壞副本、確認會 FAIL）
 *
 * 每一條檢查的性質都**不是**「我剛實作的規則」的複述——期望值盡量走另一條路取得
 * （例如 maxChars 用 titleSpanPt 夾擠驗、共用文案對 DESIGN_GUIDELINES §6 的正典表）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = process.env.SUTRA_COVER_ROOT || path.join(__dirname, '..');
const APP = path.join(ROOT, 'public/apps/sutra-cover');
const FAMILY = path.join(ROOT, '..', 'nodeapp-webapp-family');

let fails = 0;
let n = 0;
function check(name, fn) {
  n += 1;
  try {
    const r = fn();
    if (r === 'skip') { console.log(`  SKIP ${String(n).padStart(2)} ${name}`); return; }
    console.log(`  ok   ${String(n).padStart(2)} ${name}`);
  } catch (e) {
    fails += 1;
    console.log(`  FAIL ${String(n).padStart(2)} ${name}\n         ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

// ── 載入 lib（它掛在 window 上）────────────────────────────────────────
const sandbox = { window: {}, URLSearchParams };
vm.runInNewContext(read('sutra-cover-lib.js'), sandbox);
const Lib = sandbox.window.SutraCoverLib;

// ── 載入字典 ────────────────────────────────────────────────────────────
const LANGS = ['zh-Hant', 'en', 'ja'];
const dict = {};
LANGS.forEach((code) => {
  const box = { I18n: { register: (c, d) => { dict[c] = d; } } };
  vm.runInNewContext(read(`locales/${code}.js`), box);
});

const html = read('index.html');
const css = read('sutra-cover.css');
const ctrl = read('sutra-cover.js');

console.log('sutra-cover verify');

// ── lib ────────────────────────────────────────────────────────────────
check('normalize：沒給的欄位退回 cover.html 的原值（36pt／1.25em／即身成佛義）', () => {
  const p = Lib.normalize({});
  assert(p.size === 36 && p.ls === 1.25, `size/ls = ${p.size}/${p.ls}`);
  assert(p.title === '即身成佛義', `title = ${p.title}`);
  assert(p.author === '遍照金剛\u3000撰', `author = ${JSON.stringify(p.author)}`);
});

check('normalize：清空文字是合法意圖（"" 不可以被補回範例）', () => {
  const p = Lib.normalize({ title: '', author: '' });
  assert(p.title === '' && p.author === '', JSON.stringify(p));
});

check('normalize：全形空格保留、控制字元與換行拿掉、截到 200 碼位', () => {
  assert(Lib.normalize({ author: '\u3000甲\u3000撰\u3000' }).author === '\u3000甲\u3000撰\u3000', '全形空格被動到');
  assert(Lib.normalize({ title: '即\n身\t成\u0000佛' }).title === '即身成佛', '控制字元沒拿掉');
  const long = '𠀀'.repeat(250);                         // 擴充區字：一個碼位兩個 code unit
  assert(Lib.countChars(Lib.normalize({ title: long }).title) === 200, '沒有以碼位截到 200');
});

check('normalize：數字夾到範圍、對齊 step、非數字退回預設', () => {
  const L = Lib.LIMITS;
  assert(Lib.normalize({ size: 1e9 }).size === L.size.max, 'size 上限');
  assert(Lib.normalize({ size: -3 }).size === L.size.min, 'size 下限');
  assert(Lib.normalize({ size: 'abc' }).size === 36, 'size NaN');
  assert(Lib.normalize({ ls: 0.1 + 0.2 }).ls === 0.3, `ls 尾數：${Lib.normalize({ ls: 0.1 + 0.2 }).ls}`);
  assert(Lib.normalize({ ls: '9' }).ls === L.ls.max, 'ls 上限');
});

check('網址 round-trip：題名／作者（含全形空格）／字級／字距原樣回來', () => {
  const p = { title: '大日經\u3000疏', author: '一行\u3000記', size: 28.5, ls: 0.85 };
  const back = Lib.normalize(Lib.parseQuery(Lib.buildQuery(p)));
  assert(JSON.stringify(back) === JSON.stringify(Lib.normalize(p)), JSON.stringify(back));
});

check('網址：重寫時保留不歸本 app 管的參數（?lang=）', () => {
  const q = new URLSearchParams(Lib.buildQuery({}, '?lang=ja&t=舊'));
  assert(q.get('lang') === 'ja', 'lang 被丟掉');
  assert(q.getAll('t').length === 1 && q.get('t') === '即身成佛義', `t = ${q.getAll('t')}`);
});

check('maxChars 與 titleSpanPt 夾擠一致：放得下 max 個、放不下 max+1 個', () => {
  const avail = Lib.availableHeightPt();
  [[36, 1.25], [24, 0.5], [8, 0], [96, 3], [52.5, 1.05]].forEach(([s, l]) => {
    const m = Lib.maxChars(s, l);
    assert(m === 0 || Lib.titleSpanPt(m, s, l) <= avail + 1e-6, `${s}/${l}: ${m} 個就超出`);
    assert(Lib.titleSpanPt(m + 1, s, l) > avail, `${s}/${l}: ${m + 1} 個也放得下`);
  });
});

check('cover.html 的原值：36pt／1.25em 在 A4 上放得下 9 字（「大毘盧遮那成佛神變加持經」12 字放不下）', () => {
  assert(Lib.maxChars(36, 1.25) === 9, `maxChars = ${Lib.maxChars(36, 1.25)}`);
});

check('末字字距抵銷＝ −字距（兩者是同一個數字）', () => {
  [0, 0.2, 1.25, 3].forEach((l) => assert(Lib.trailingCompensation(l) === -l, String(l)));
});

check('fitState 三段：ok／tight／over，量不出來（NaN）不可以落進 over', () => {
  assert(Lib.fitState(0.5) === 'ok' && Lib.fitState(0.97) === 'tight' && Lib.fitState(1.2) === 'over', 'three states');
  assert(Lib.fitState(NaN) === 'ok', 'NaN');
});

// ── CSS 與 lib 常數一致（同一個事實寫在兩個地方）─────────────────────
function ruleBody(selector) {
  const i = css.indexOf(selector + ' {');
  assert(i >= 0, `找不到規則 ${selector}`);
  return css.slice(i, css.indexOf('}', i));
}

check('CSS 與 lib 常數一致：字型族名／上方留白／紙內留邊／A4／兩欄間距／.cover 字級', () => {
  const cover = ruleBody('.cover');
  assert(cover.includes(`'${Lib.FONT_FAMILY}'`), `font-family 不是 ${Lib.FONT_FAMILY}`);
  assert(cover.includes(`padding-top: ${Lib.TOP_PX}px`), 'padding-top ≠ TOP_PX');
  assert(cover.includes(`gap: ${Lib.GAP_EM}em`), 'gap ≠ GAP_EM');
  assert(cover.includes(`font-size: ${Lib.COVER_PT}pt`), '.cover font-size ≠ COVER_PT');
  const sheet = ruleBody('.sheet');
  assert(sheet.includes(`width: ${Lib.PAGE.width}mm`) && sheet.includes(`height: ${Lib.PAGE.height}mm`), '紙張尺寸');
  assert(sheet.includes(`padding: ${Lib.PAGE.margin}mm`), '.sheet padding ≠ PAGE.margin');
  assert(/@page\s*\{[^}]*size:\s*A4 portrait[^}]*margin:\s*0/.test(css), '@page 不是 A4 portrait / margin 0');
});

check('題名的抵銷規則特異度 ≥ `.cover .vertical { margin: 0 }`（實際踩過：被蓋掉而量到 0px）', () => {
  const m = css.match(/([^{}\n]+)\{[^}]*margin-inline-end:\s*var\(--title-comp/);
  assert(m, '找不到 margin-inline-end 那條規則');
  const sel = m[1].trim();
  const spec = (s) => (s.match(/[.#][\w-]+/g) || []).length;
  const vIdx = css.indexOf('.cover .vertical {');
  assert(spec(sel) > spec('.cover .vertical') || (spec(sel) === spec('.cover .vertical') && css.indexOf(sel) > vIdx),
    `「${sel}」會被 .cover .vertical 的 margin:0 蓋掉`);
});

check('dark 主題列印回淺色（§5.1 的兩個坑：color-scheme 與 transition）', () => {
  const print = css.slice(css.indexOf('@media print'));
  assert(/color-scheme:\s*light\s*!important/.test(print), 'color-scheme');
  assert(/transition:\s*none\s*!important/.test(print), 'transition');
  assert(/\.side-tools/.test(print) && /\.form-col/.test(print), '列印沒藏掉 UI');
});

// ── i18n ───────────────────────────────────────────────────────────────
check('三語 key 集合相同', () => {
  const keys = LANGS.map((c) => Object.keys(dict[c]).sort().join('|'));
  assert(keys[0] === keys[1] && keys[1] === keys[2], LANGS.map((c, i) => `${c}:${Object.keys(dict[c]).length}`).join(' '));
});

check('畫面與程式用到的每個 key 三語都有定義', () => {
  const used = new Set();
  for (const m of html.matchAll(/data-i18n(?:-html|-title|-placeholder|-doctitle)?="([^"]+)"/g)) used.add(m[1]);
  // 以 '.' 結尾的是動態組 key 的前綴（t('font.' + fontState)），由下一行展開
  for (const m of ctrl.matchAll(/\bt\('([\w.]+)'/g)) if (!m[1].endsWith('.')) used.add(m[1]);
  for (const m of ctrl.matchAll(/'font\.' \+ fontState/g)) ['font.yes', 'font.no', 'font.unknown'].forEach((k) => used.add(k));
  const missing = [];
  used.forEach((k) => LANGS.forEach((c) => { if (!(k in dict[c])) missing.push(`${c}:${k}`); }));
  assert(missing.length === 0, missing.join(', '));
});

check('參數集合三語一致（{x} 呼叫端沒傳就會顯示字面）', () => {
  const bad = [];
  Object.keys(dict['zh-Hant']).forEach((k) => {
    const ps = LANGS.map((c) => (String(dict[c][k]).match(/\{\w+\}/g) || []).sort().join(','));
    if (!(ps[0] === ps[1] && ps[1] === ps[2])) bad.push(`${k}(${ps.join(' / ')})`);
  });
  assert(bad.length === 0, bad.join(', '));
});

check('共用文案逐字符合 DESIGN_GUIDELINES §6 正典表', () => {
  const canon = {
    'tool.lang': ['語言', 'Language', '言語'],
    'tool.mode': ['切換 light / dark', 'Toggle light / dark', 'ライト / ダーク切替'],
    'tool.more': ['更多工具', 'More tools', 'その他のツール'],
    'toast.lang': ['已切換為 {name}', 'Switched to {name}', '{name} に切り替えました'],
    'toast.copied': ['已複製', 'Copied', 'コピーしました']
  };
  const bad = [];
  Object.entries(canon).forEach(([k, v]) => LANGS.forEach((c, i) => {
    if (dict[c][k] !== v[i]) bad.push(`${c}:${k}=${JSON.stringify(dict[c][k])}`);
  }));
  assert(bad.length === 0, bad.join(', '));
});

// ── 結構 ───────────────────────────────────────────────────────────────
check('控制器 $() 取的每個 id 都在 index.html 裡', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const miss = [...ctrl.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]).filter((id) => !ids.has(id));
  assert(miss.length === 0, miss.join(', '));
});

check('側鍵順序：app 工具 → #setting-mode → #setting-lang 墊底（§5.5）', () => {
  const order = [...html.matchAll(/id="(setting-[\w-]+)"/g)].map((m) => m[1]);
  assert(order.slice(-2).join() === 'setting-mode,setting-lang', order.join(' → '));
});

check('-lib.js 不碰 DOM（§4.1）', () => {
  const code = read('sutra-cover-lib.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hit = code.match(/\b(document|jQuery|\$\(|getComputedStyle|localStorage)\b/);
  assert(!hit, `lib 用到 ${hit && hit[0]}`);
});

check('原始碼無 NUL 位元組；JS 程式碼無實體 U+3000（要寫 \\u3000，寫檔工具會轉成實體字）', () => {
  const bad = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    if (!/\.(js|html|css|json|svg)$/.test(e.name)) return;
    const b = fs.readFileSync(p);
    if (b.includes(0)) bad.push(`NUL:${path.relative(ROOT, p)}`);
  });
  walk(path.join(ROOT, 'public'));
  walk(path.join(ROOT, 'scripts'));
  ['sutra-cover-lib.js', 'sutra-cover.js'].forEach((f) => { if (read(f).includes('\u3000')) bad.push(`U+3000:${f}`); });
  assert(bad.length === 0, bad.join(', '));
});

check('共用件與家族權威版 byte-identical（materialize-dark／side-tool／i18n）', () => {
  if (!fs.existsSync(FAMILY)) return 'skip';
  const md5 = (p) => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
  const bad = ['materialize-dark.css', 'side-tool.css', 'side-tool.js', 'i18n.js']
    .filter((f) => md5(path.join(APP, f)) !== md5(path.join(FAMILY, f)));
  assert(bad.length === 0, bad.join(', '));
});

console.log(fails ? `\n${fails} / ${n} FAIL` : `\nall ${n} checks passed`);
process.exit(fails ? 1 : 0);
