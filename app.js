/**
 * sutra-cover — 獨立執行的 Express 伺服器
 *
 * 典籍封面編排：輸入題名與譯者／作者，以直排版式在一張 A4 上排好、直接列印。
 * 輸入在網址與表單裡、輸出就是列印，**沒有任何持久化**，
 * 故後端無 API（同 circle-text／faber-castell-color 先例，DESIGN_GUIDELINES §3.1 的最小形）：
 * 只負責靜態檔、根路徑轉址、JSON 404。
 *
 * 啟動： npm install && npm start
 *        預設 http://localhost:3000/apps/sutra-cover/
 */

const express = require('express');
const path = require('path');
const logger = require('morgan');

const app = express();

app.use(logger('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// 根路徑導向應用頁
app.get('/', (req, res) => res.redirect('/apps/sutra-cover/'));

// 404（API 回 JSON，其餘回純文字）
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
  res.status(404).type('text/plain').send('Not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[sutra-cover] →  http://localhost:${PORT}/apps/sutra-cover/`));
