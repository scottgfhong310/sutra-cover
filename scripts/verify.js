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

const os = require('os');

const ROOT = process.env.SUTRA_COVER_ROOT || path.join(__dirname, '..');
const APP = path.join(ROOT, 'public/apps/sutra-cover');
const FAMILY = path.join(ROOT, '..', 'nodeapp-webapp-family');
const LOCAL_READER = path.join(ROOT, '..', 'local-reader', 'public', 'apps', 'local-reader');

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

check('網址 round-trip：編號／題名／作者（含全形空格）／字級／字距原樣回來', () => {
  const p = { code: 'T1796', title: '大日經\u3000疏', author: '一行\u3000記', size: 28.5, ls: 0.85 };
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

check('編號：去空白、轉大寫（macOS 不分大小寫，t2428 與 T2428 是同一個檔）；不合規的擋下', () => {
  assert(Lib.cleanCode(' t 2428 ') === 'T2428', Lib.cleanCode(' t 2428 '));
  ['T2428', 'X1000', 'T1796-01', 'B.23', 'A_1'].forEach((c) => assert(Lib.isValidCode(c), `該通過：${c}`));
  ['', '../X', 'A..B', '.T1', '-T1', 'T/1', 'T\\1', '經', 'A'.repeat(33), 'T 1', 't1'].forEach((c) =>
    assert(!Lib.isValidCode(c), `該擋下：${JSON.stringify(c)}`));
});

check('排序是數字感知的（T262 < T2428 < T10000；X 在 T 之後）', () => {
  const got = ['T2428', 'X0001', 'T10000', 'T262', 'T2428A', 'B1'].sort(Lib.compareCode).join(' ');
  assert(got === 'B1 T262 T2428 T2428A T10000 X0001', got);
});

check('清單篩選：編號／題名／作者三欄子字串、不分大小寫；空字串全部通過', () => {
  const c = { code: 'T2428', title: '即身成佛義', author: '遍照金剛\u3000撰' };
  assert(Lib.matchCover(c, 't24') && Lib.matchCover(c, '成佛') && Lib.matchCover(c, '金剛') && Lib.matchCover(c, ''), 'hit');
  assert(!Lib.matchCover(c, '大日'), 'miss');
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
  assert(/\.sidenav,/.test(print) && /\.sidenav-overlay/.test(print), '列印沒藏掉右側清單與遮罩');
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

check('側鍵順序：#setting-menu（folder_open）→ app 工具 → #setting-mode → #setting-lang（§5.5／§5.6）', () => {
  const order = [...html.matchAll(/id="(setting-[\w-]+)"/g)].map((m) => m[1]);
  assert(order[0] === 'setting-menu' && order[1] === 'setting-save', order.join(' → '));
  assert(order.slice(-2).join() === 'setting-mode,setting-lang', order.join(' → '));
  assert(/id="setting-menu"[^>]*>\s*<i class="material-icons">folder_open</.test(html), '#setting-menu 不是 folder_open');
});

check('右側清單：Sidenav edge right，關閉的 class 綁 onCloseStart（onCloseEnd 在背景分頁永遠不來）', () => {
  assert(/M\.Sidenav\.init\([\s\S]*?edge:\s*'right'/.test(ctrl), 'edge 不是 right');
  assert(/onCloseStart:[^\n]*sidenav-open/.test(ctrl), '沒有在 onCloseStart 拿掉 sidenav-open');
  const code = ctrl.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');   // 註解裡講「不要用它」不算用了
  assert(!/onCloseEnd/.test(code), '用了 onCloseEnd');
});

check('後端不另寫一份驗證：route 載入 sutra-cover-lib.js、自己不寫編號規則', () => {
  const route = fs.readFileSync(path.join(ROOT, 'routes', 'sutra-cover.js'), 'utf8');
  assert(route.includes("'sutra-cover-lib.js'"), 'route 沒有載入 lib');
  assert(route.includes('Lib.isValidCode') && route.includes('Lib.toRecord'), 'route 沒用 lib 的規則');
  const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert(!/\[A-Z0-9\]|toUpperCase|Math\.min\(|clamp/.test(code), 'route 裡有第二份編號／夾值規則');
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

check('共用件與家族權威版 byte-identical（materialize-dark／side-tool／i18n；filter-clear 權威在 local-reader）', () => {
  if (!fs.existsSync(FAMILY) || !fs.existsSync(LOCAL_READER)) return 'skip';
  const md5 = (p) => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
  const bad = ['materialize-dark.css', 'side-tool.css', 'side-tool.js', 'i18n.js']
    .filter((f) => md5(path.join(APP, f)) !== md5(path.join(FAMILY, f)))
    .concat(['filter-clear.css', 'filter-clear.js']
      .filter((f) => md5(path.join(APP, f)) !== md5(path.join(LOCAL_READER, f))));
  assert(bad.length === 0, bad.join(', '));
});

// ── API：在暫存資料夾裡真的跑一次（不碰 public/upload/sutra-cover/）──────
async function checkApi() {
  let express;
  try { express = require(path.join(ROOT, 'node_modules', 'express')); } catch (e) {
    n += 1; console.log(`  SKIP ${String(n).padStart(2)} API（沒有 node_modules，先 npm install）`); return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sutra-cover-verify-'));
  const { createRouter } = require(path.join(ROOT, 'routes', 'sutra-cover.js'));
  const app = express();
  app.use(express.json());
  app.use('/api/sutra-cover', createRouter({ dataDir: dir }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/sutra-cover/covers`;
  const call = async (method, code, body) => {
    const res = await fetch(base + (code == null ? '' : '/' + encodeURIComponent(code)), {
      method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body)
    });
    return { status: res.status, j: await res.json() };
  };
  const results = [];
  const acheck = async (name, fn) => {
    n += 1;
    try { await fn(); results.push(`  ok   ${String(n).padStart(2)} ${name}`); }
    catch (e) { fails += 1; results.push(`  FAIL ${String(n).padStart(2)} ${name}\n         ${e.message}`); }
  };
  try {
    await acheck('API：新建 → 同編號（小寫也算）再建回 409 → overwrite 覆寫、保留 createdAt、留 .bak', async () => {
      let r = await call('PUT', 'T2428', { title: '即身成佛義', author: '遍照金剛\u3000撰', size: 36, ls: 1.25 });
      assert(r.status === 200 && r.j.created === true && r.j.cover.code === 'T2428', JSON.stringify(r));
      const created = r.j.cover.createdAt;
      r = await call('PUT', 't2428', { title: 'X' });
      assert(r.status === 409 && r.j.error === 'exists', `second create: ${r.status}`);
      r = await call('PUT', 'T2428', { title: '即身成佛義', author: '空海', size: 999, overwrite: true });
      assert(r.status === 200 && r.j.created === false && r.j.cover.size === 96, JSON.stringify(r.j));
      assert(r.j.cover.createdAt === created, 'createdAt 被改掉');
      assert(fs.readdirSync(path.join(dir, '.bak')).some((f) => f.startsWith('T2428.json-')), '沒有 .bak');
      assert(JSON.parse(fs.readFileSync(path.join(dir, 'T2428.json'), 'utf8')).author === '空海', '檔案內容');
    });
    await acheck('API：不合規編號（../X、A..B、漢字）一律 400，不落檔', async () => {
      for (const c of ['../X', 'A..B', '經']) {
        const r = await call('PUT', c, { title: 'x' });
        assert(r.status === 400 && r.j.error === 'invalid-code', `${c}: ${r.status}`);
      }
      assert(fs.readdirSync(dir).filter((f) => f.endsWith('.json')).join() === 'T2428.json', fs.readdirSync(dir).join());
    });
    await acheck('API：20 個同編號併發新建只有 1 個成功（wx 原子建立，§3.3）', async () => {
      const st = await Promise.all(Array.from({ length: 20 }, (_, i) => call('PUT', 'RACE', { title: 't' + i }).then((r) => r.status)));
      assert(st.filter((x) => x === 200).length === 1 && st.filter((x) => x === 409).length === 19, st.join(','));
    });
    await acheck('API：清單依編號排序；讀不進來的檔列在 skipped，不是安靜地少一筆', async () => {
      fs.writeFileSync(path.join(dir, 'BAD.json'), '{not json');
      fs.writeFileSync(path.join(dir, 't9.json'), '{}');
      const r = await call('GET');
      assert(r.j.covers.map((c) => c.code).join() === 'RACE,T2428', r.j.covers.map((c) => c.code).join());
      assert(r.j.skipped.sort().join() === 'BAD.json,t9.json', r.j.skipped.join());
    });
    await acheck('API：刪除＝移進 .bak；再刪 404；讀不存在的 404', async () => {
      let r = await call('DELETE', 'RACE');
      assert(r.status === 200 && !fs.existsSync(path.join(dir, 'RACE.json')), 'still there');
      assert(fs.readdirSync(path.join(dir, '.bak')).some((f) => f.startsWith('RACE.json-') && f.endsWith('.deleted.bak')), 'not in .bak');
      r = await call('DELETE', 'RACE');
      assert(r.status === 404, String(r.status));
      r = await call('GET', 'RACE');
      assert(r.status === 404, String(r.status));
    });
    await acheck('API：資料夾不存在＝空清單（回灌不重建資料夾，由第一次寫入惰性建立）', async () => {
      const s2 = express();
      s2.use('/x', createRouter({ dataDir: path.join(dir, 'nope', 'deeper') }));
      const srv = await new Promise((r) => { const s = s2.listen(0, () => r(s)); });
      const j = await (await fetch(`http://127.0.0.1:${srv.address().port}/x/covers`)).json();
      srv.close();
      assert(j.ok && j.covers.length === 0 && !fs.existsSync(path.join(dir, 'nope')), JSON.stringify(j));
    });
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  results.forEach((l) => console.log(l));
}

checkApi().then(() => {
  console.log(fails ? `\n${fails} / ${n} FAIL` : `\nall ${n} checks passed`);
  process.exit(fails ? 1 : 0);
});
