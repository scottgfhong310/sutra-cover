/**
 * sutra-cover — 獨立執行的 Express 伺服器
 *
 * 典籍封面編排：輸入編號、題名與譯者／作者，以直排版式在一張 A4 上排好、直接列印。
 * 封面可存成 public/upload/sutra-cover/<編號>.json（DATABASE_GUIDELINES §0 的層 1），
 * API 只有 /api/sutra-cover（見 routes/sutra-cover.js）；沒有上傳，故不掛 /api/upload。
 *
 * 啟動： npm install && npm start
 *        預設 http://localhost:3000/apps/sutra-cover/
 */

const express = require('express');
const path = require('path');
const logger = require('morgan');

const coverRouter = require('./routes/sutra-cover');

const app = express();

app.use(logger('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/sutra-cover', coverRouter);

// 根路徑導向應用頁
app.get('/', (req, res) => res.redirect('/apps/sutra-cover/'));

// 404（API 回 JSON，其餘回純文字）
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
  res.status(404).type('text/plain').send('Not found');
});

// 錯誤：API 一律回 { ok:false }（壞掉的 JSON body、route 內未接住的例外）
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  console.error('[sutra-cover]', err.message);
  if (req.path.startsWith('/api/')) return res.status(status).json({ ok: false, error: err.message });
  res.status(status).type('text/plain').send(err.message);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[sutra-cover] →  http://localhost:${PORT}/apps/sutra-cover/`));
