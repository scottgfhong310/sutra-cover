# sutra-cover

> 版本 v1.2｜最後更新 2026-09-24

[English](README.md) ｜ [繁體中文](README.zh-Hant.md) ｜ [日本語](README.ja.md)

**典籍封面**編排工具。輸入題名與譯者／作者，app 以直排把它們排在一張 A4 上——題名在右、
作者在左、兩欄底部對齊——直接列印。題名的字級與字距可調。

版式來自一支手工原型（`cover.html`），**逐項照原型重現**：並排實測，題名欄高、作者欄高、
底部對齊與兩欄間距逐像素相同。

## 功能

- **預覽就是列印內容。** 畫面上那張紙以真實尺寸（mm）排版、再縮到欄寬；列印時只藏掉其他東西。
  `@page` 是 A4 直式、邊界 0，10mm 留邊在紙內——**畫面與紙張逐 mm 相同**。
- **題名字級（pt）與字距（em）**：滑桿與數字框各一，互相同步。末字後多出的字距會被抵銷，
  所以任何字距下題名與作者都保持底部對齊。
- **版面量尺**：題名佔可用高度的比例（**量出來的**，不是猜的）、這組字級字距約可容納幾字，
  超出時紙的下留邊畫紅線。**只警示、不自動縮小**——你指定的字級不會被偷改。
- **字型檢查**：版式用 *Weibei TC*（魏碑，macOS 系統字型）。app 以像素判斷是否真的用上，
  沒用上就明講，而不是無聲地用一般明體印出來。
- **全形空格照原樣保留**——`遍照金剛　撰` 不會被剝掉。
- **存檔，並記錄典籍編號。** 每份封面填一個編號（例如即身成佛義是 `T2428`），按側鍵或 ⌘／Ctrl-S 儲存。
  **封面清單**從右側滑出（形制同 `markdown-reader` 的檔案清單）：可依編號、題名、作者篩選，點一下載入，
  也可刪除（移進備份）。一個編號一份；存到已有的編號會先問要不要覆寫。編號只是資料，**不印在封面上**。
- 「列印」旁的**清除鈕**一次清空編號、題名、作者（字級與字距保留）。
- 深連結：所有參數都在網址（`?c=&t=&a=&s=&ls=`）；只帶 `?c=T2428` 就是開啟那一份已存的封面。
- light / dark 主題（兩者印出來都是白紙）、繁中／英／日介面。

## 執行

```bash
npm install
npm start          # → http://localhost:3000/apps/sutra-cover/
npm run verify     # 36 條契約檢查（其中 6 條在暫存資料夾裡實際跑 API）
```

Node ≥ 18，`PORT` 可覆寫埠號。

列印時請把邊界設為「**無**」或「**預設**」，並**關閉頁首與頁尾**。

## 目錄結構

```
app.js                        靜態檔 + /api/sutra-cover + / → 302 + JSON 404
routes/sutra-cover.js         封面的存／列／刪（驗證規則取自 lib）
scripts/verify.js             契約檢查
public/apps/sutra-cover/
  index.html                  純結構
  sutra-cover.css             主題 token、頁面樣式、封面版式、列印
  sutra-cover.js              控制器：DOM、事件、量版面、字型檢查、i18n
  sutra-cover-lib.js          核心邏輯，不碰 DOM → window.SutraCoverLib
  i18n.js, locales/           繁中／英／日
  side-tool.*, filter-clear.*, materialize-dark.css   家族共用件
  icons/                      favicon、apple-touch、PWA manifest
public/upload/sutra-cover/    已存的封面 <編號>.json（不進版控）
```

## HTTP

| Method | Path | 說明 |
|---|---|---|
| GET | `/` | 302 → `/apps/sutra-cover/` |
| GET | `/apps/sutra-cover/…` | 靜態前端 |
| GET | `/api/sutra-cover/covers` | `{ ok, covers, skipped }`——依編號排序；`skipped` 是讀不進來的檔名 |
| GET | `/api/sutra-cover/covers/:code` | `{ ok, cover }`；不存在 404 |
| PUT | `/api/sutra-cover/covers/:code` | body `{ title, author, size, ls, overwrite }` → `{ ok, cover, created }`；已存在而未帶 `overwrite:true` 時回 **409 `exists`**（覆寫前舊檔先備份到 `.bak/`） |
| DELETE | `/api/sutra-cover/covers/:code` | `{ ok }`——檔案移進 `.bak/`，不是真的刪掉 |

一份封面存成 `public/upload/sutra-cover/<編號>.json`——**一個編號一份**。編號一律轉大寫
（macOS 的檔名不分大小寫，`t2428` 與 `T2428` 是同一個檔），可用英數與 `. _ -`；不合規回 `400 invalid-code`。

## 深連結

| 參數 | 意義 | 預設 |
|---|---|---|
| `c` | 典籍編號（只帶它＝開啟那一份已存的封面） | `T2428` |
| `t` | 題名 | `即身成佛義` |
| `a` | 譯者／作者 | `遍照金剛　撰` |
| `s` | 題名字級，pt（8–96） | `36` |
| `ls` | 題名字距，em（0–3） | `1.25` |

`t=` 留空就是空題名——**不會被補回範例**。

## 核心 library

`window.SutraCoverLib`——純函式、不碰 DOM：

| 函式 | 回傳 |
|---|---|
| `normalize(input)` | `{ code, title, author, size, ls }`，夾值；沒給的欄位退回原型值 |
| `cleanCode(s)` / `isValidCode(code)` | 去空白＋轉大寫／能不能當鍵與檔名 |
| `compareCode(a, b)` / `matchCover(cover, q)` | 數字感知排序（T262 在 T2428 前面）／清單篩選 |
| `listCovers()` / `getCover(code)` / `saveCover(params, overwrite)` / `deleteCover(code)` | 上面那組 API，回 Promise |
| `parseQuery(search)` / `buildQuery(params, baseSearch?)` | 網址 ⇄ 參數（保留 `lang` 等不相干的參數） |
| `trailingCompensation(ls)` | 題名末字抵銷，`−ls` em |
| `availableHeightPt()` | A4 上題名可用高度（pt） |
| `titleSpanPt(n, size, ls)` / `maxChars(size, ls)` | *n* 字的估計佔高／放得下幾字 |
| `fitState(ratio)` | `'ok'`、`'tight'` 或 `'over'` |

## 備註

- *Weibei TC* 是沒有再散布授權的系統字型，只以名稱引用、**永遠不隨 repo 散布**。
  沒有它的電腦上，頁面會講明並以一般明體列印。
- 字數估計假設每字 1em（漢字成立）；版面量尺本身是量實際畫面得來的。
- 存檔與清單需要 Express 伺服器（列印不需要）。**未設定 GitHub Pages。**
- 沒有登入：連得到伺服器的人都能存、刪封面（刪掉的檔留在 `.bak/`）。

[MIT](LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
