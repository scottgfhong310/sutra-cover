/**
 * routes/sutra-cover.js — 典籍封面的存取（/api/sutra-cover）
 *
 * 資料層＝ DATABASE_GUIDELINES §0 的層 1：一份封面一個 JSON 檔，
 *   public/upload/sutra-cover/<編號>.json      （**一個編號一份**，owner 2026-09-23 拍板）
 * 資料夾由第一次寫入惰性建立（WORKFLOW A4：回灌不重建資料夾）；不存在＝清單為空。
 *
 *   GET    /covers              → { ok, covers, skipped }
 *   GET    /covers/:code        → { ok, cover }                     找不到 404
 *   PUT    /covers/:code        body { title,author,size,ls, overwrite }
 *                                → { ok, cover, created }            已存在且未 overwrite → 409 'exists'
 *   DELETE /covers/:code        → { ok }                            移進 .bak/，不是真的刪
 *
 * ⚠️ 驗證與正規化**不在這裡另寫一份**：載入前端的 sutra-cover-lib.js（normalize／cleanCode／
 *    isValidCode）。兩份實作遲早會漂開，而漂開的症狀是「畫面上存得進去的值，伺服器擋下來」或反過來。
 * ⚠️ 新建用 fs.open(…,'wx') 原子建立（§3.3）：「先查存不存在再寫」在兩個分頁同時新建同一個編號時
 *    會讓後寫的那個安靜地蓋掉先寫的。覆寫（overwrite:true）則先 .bak 再寫（§3.4）。
 */
'use strict';

const express = require('express');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const vm = require('vm');

const LIB_PATH = path.join(__dirname, '..', 'public', 'apps', 'sutra-cover', 'sutra-cover-lib.js');
const DEFAULT_DIR = path.join(__dirname, '..', 'public', 'upload', 'sutra-cover');

function loadLib() {
  const box = { window: {}, URLSearchParams };
  vm.runInNewContext(fsSync.readFileSync(LIB_PATH, 'utf8'), box, { filename: LIB_PATH });
  return box.window.SutraCoverLib;
}

const pad2 = (n) => String(n).padStart(2, '0');
function timestamp(d = new Date()) {
  return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
    pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}

function createRouter(opts = {}) {
  const Lib = loadLib();
  const DIR = opts.dataDir || DEFAULT_DIR;
  const BAK = path.join(DIR, '.bak');
  const router = express.Router();

  /** 編號 → 絕對路徑；不合法回 null。落點檢查是雙保險（§3.4），正規表示式已擋 / \ 與 '..' */
  function fileOf(rawCode) {
    const code = Lib.cleanCode(rawCode);
    if (!Lib.isValidCode(code)) return null;
    const abs = path.resolve(DIR, code + '.json');
    if (!abs.startsWith(path.resolve(DIR) + path.sep)) return null;
    return { code, abs };
  }

  async function readCover(abs) {
    const j = JSON.parse(await fs.readFile(abs, 'utf8'));
    const r = Lib.toRecord(j);
    return Object.assign(r, { createdAt: j.createdAt || null, updatedAt: j.updatedAt || null });
  }

  async function backup(abs, code) {
    await fs.mkdir(BAK, { recursive: true });
    const dst = path.join(BAK, `${code}.json-${timestamp()}.bak`);
    await fs.copyFile(abs, dst);
    return dst;
  }

  router.get('/covers', async (req, res) => {
    let names = [];
    try {
      names = await fs.readdir(DIR);
    } catch (e) {
      if (e.code !== 'ENOENT') return res.status(500).json({ ok: false, error: e.message });
    }
    const covers = [];
    const skipped = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const f = fileOf(name.slice(0, -5));
      // 檔名不合規（或大小寫與正規形不同）：不假裝它是某一筆，列進 skipped 讓畫面講出來
      if (!f || f.code + '.json' !== name) { skipped.push(name); continue; }
      try {
        covers.push(await readCover(f.abs));
      } catch (e) {
        skipped.push(name);
      }
    }
    res.json({ ok: true, covers, skipped });
  });

  router.get('/covers/:code', async (req, res) => {
    const f = fileOf(req.params.code);
    if (!f) return res.status(400).json({ ok: false, error: 'invalid-code' });
    try {
      res.json({ ok: true, cover: await readCover(f.abs) });
    } catch (e) {
      if (e.code === 'ENOENT') return res.status(404).json({ ok: false, error: 'not-found' });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.put('/covers/:code', async (req, res) => {
    const f = fileOf(req.params.code);
    if (!f) return res.status(400).json({ ok: false, error: 'invalid-code' });
    const b = req.body || {};
    const rec = Lib.toRecord({ code: f.code, title: b.title, author: b.author, size: b.size, ls: b.ls });
    const now = new Date().toISOString();
    await fs.mkdir(DIR, { recursive: true });

    if (b.overwrite !== true) {
      let fh;
      try {
        fh = await fs.open(f.abs, 'wx');
      } catch (e) {
        if (e.code === 'EEXIST') return res.status(409).json({ ok: false, error: 'exists' });
        return res.status(500).json({ ok: false, error: e.message });
      }
      const cover = Object.assign(rec, { createdAt: now, updatedAt: now });
      try {
        await fh.writeFile(JSON.stringify(cover, null, 2) + '\n', 'utf8');
      } finally {
        await fh.close();
      }
      console.log(`[sutra-cover] created ${f.code}`);
      return res.json({ ok: true, cover, created: true });
    }

    let createdAt = now;
    let existed = false;
    try {
      const old = JSON.parse(await fs.readFile(f.abs, 'utf8'));
      existed = true;
      if (old && old.createdAt) createdAt = old.createdAt;
      await backup(f.abs, f.code);
    } catch (e) {
      if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) return res.status(500).json({ ok: false, error: e.message });
      if (e instanceof SyntaxError) { existed = true; await backup(f.abs, f.code); }
    }
    const cover = Object.assign(rec, { createdAt, updatedAt: now });
    await fs.writeFile(f.abs, JSON.stringify(cover, null, 2) + '\n', 'utf8');
    console.log(`[sutra-cover] ${existed ? 'overwrote' : 'created'} ${f.code}`);
    res.json({ ok: true, cover, created: !existed });
  });

  router.delete('/covers/:code', async (req, res) => {
    const f = fileOf(req.params.code);
    if (!f) return res.status(400).json({ ok: false, error: 'invalid-code' });
    try {
      await fs.mkdir(BAK, { recursive: true });
      await fs.rename(f.abs, path.join(BAK, `${f.code}.json-${timestamp()}.deleted.bak`));
      console.log(`[sutra-cover] deleted ${f.code} (moved to .bak/)`);
      res.json({ ok: true });
    } catch (e) {
      if (e.code === 'ENOENT') return res.status(404).json({ ok: false, error: 'not-found' });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
