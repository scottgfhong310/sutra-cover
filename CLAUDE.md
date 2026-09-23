# CLAUDE.md — sutra-cover

> 版本 v1.0｜最後更新 2026-09-23

典籍封面編排：輸入題名與譯者／作者，直排排在 A4 上直接列印。**單頁、零後端、零資料庫**
——後端只有靜態檔、根路徑轉址、JSON 404。

## 先讀家族規範

- [DESIGN_GUIDELINES.md](https://github.com/scottgfhong310/nodeapp-webapp-family/blob/main/DESIGN_GUIDELINES.md)
  — 結構 / 後端 / 前端 / 視覺 / i18n / 安全
- [WORKFLOW.md](https://github.com/scottgfhong310/nodeapp-webapp-family/blob/main/WORKFLOW.md)
  — 新增／改版一支家族 app 的流程
- [SHARED_LIBRARY_GUIDELINES.md](https://github.com/scottgfhong310/nodeapp-webapp-family/blob/main/SHARED_LIBRARY_GUIDELINES.md)
  — 共用件的權威版與同步紀律

本 repo 的設計取捨（為什麼長這樣）見 [DESIGN.md](./DESIGN.md)；怎麼用見 [README.md](./README.md)。

## 結構

```
app.js                          Express：static + / → 302 + JSON 404 + PORT||3000
scripts/verify.js               契約檢查（`npm run verify`；SUTRA_COVER_ROOT=<副本> 做反向驗證）
public/apps/sutra-cover/
  index.html                    純結構（唯一 inline script ＝ §4.1 的防閃爍開機腳本）
  sutra-cover.css               主題 token + 本頁樣式 + 封面版式 + 列印
  sutra-cover.js                控制器：DOM / 事件 / 量版面 / 字型偵測 / i18n / toast
  sutra-cover-lib.js            核心：純邏輯，不碰 DOM → window.SutraCoverLib
  i18n.js, locales/{zh-Hant,en,ja}.js
  side-tool.css, side-tool.js, materialize-dark.css
  icons/                        favicon / apple-touch / PWA manifest
```

## 執行與驗證

```bash
npm install && npm start        # → http://localhost:3000/apps/sutra-cover/
npm run verify                  # 22 條契約檢查，全過 exit 0
```

## 這支的 canon 重點

- **預覽就是列印內容。** 畫面上那張紙以真實尺寸（mm）排版、再用 `transform` 縮到欄寬；
  列印時只由 `@media print` 藏掉其他東西，**不另組一份 DOM**。`@page` 是 `A4 portrait / margin 0`，
  紙內留邊 10mm 由 `.sheet` 的 padding 提供——所以畫面與紙張逐 mm 相同。
- **版式數值的權威在 `sutra-cover-lib.js`**（`TOP_PX`／`COVER_PT`／`GAP_EM`／`PAGE`／`FONT_FAMILY`），
  CSS 寫同樣的數字；兩處一致由 verify 第 11 條盯著。
- **題名的末字字距抵銷（`margin-inline-end: −字距`）要跟字距一起變**，且規則的特異度必須
  ≥ `.cover .vertical { margin: 0 }`——寫成單獨的 `.cv-title` 會被蓋掉、**沒有任何警告**
  （實際踩過，量到 0px）。verify 第 12 條擋著。
- **「佔可用高度」是量 DOM 的**（`offsetHeight`，不受縮放 transform 影響；
  **不要**改用 `getBoundingClientRect`，它量到的是縮小後的值）。lib 的 `maxChars()` 只是估計，畫面上標「約」。
- **文字欄不 trim**：`String.prototype.trim()` 會剝掉 U+3000，而全形空格是版式的一部分（第 3 條）。
  **清空是合法意圖**：`''` 不可以被補回範例文字（第 2 條）。
- **字型偵測是三態**（用上／沒用上／量不出來），以 canvas 像素比對，自帶 serif vs sans-serif 對照組。
  `document.fonts.check()` 對任何字型都回 `true`，**不能用**。
- **WeiBei TC 是 macOS 系統字型（文鼎），沒有再散布授權**——只以族名引用、**永遠不放進 repo**。
- **JS 原始碼裡的 U+3000 要寫成 `　`**：Claude Code 的寫檔工具會把轉義轉成實體字元（第 21 條）。
- 側鍵排序照 §5.5：app 工具 → `#setting-mode` → `#setting-lang`（第 19 條）。
- 共用文案照 §6 正典表逐字抄（第 17 條）。偏離要在 `db_inprogress.meta_i18n.fd_note` 寫理由。

## 複製件登記

以下檔案是**家族共用件的 byte-identical 複製件**——改就改權威版再同步各複製點，
**不要在本 repo 就地改**（`npm run verify` 第 22 條會比對）：

| 檔案 | 權威版 |
|---|---|
| `i18n.js` | 家族 repo 根 [`i18n.js`](https://github.com/scottgfhong310/nodeapp-webapp-family/blob/main/i18n.js) |
| `side-tool.css` / `side-tool.js` | 家族 repo 根（DESIGN_GUIDELINES §5.5） |
| `materialize-dark.css` | 家族 repo 根（§5.1） |

`icons/` 是本 app 自有資產，不是複製件。

## InProgress 鏡像

本 repo 是權威。改完要**回灌**孵化器（WORKFLOW A4）：

```bash
cp -R public/apps/sutra-cover/. ../../InProgress/public/apps/sutra-cover/
diff -rq public/apps/sutra-cover ../../InProgress/public/apps/sutra-cover
```

本 app 無後端 route，**不必**動 InProgress 的 `app.js`／`upload.js`。
版式的前身是 InProgress 的 `public/lib/cover.html`（owner 的原型，未動）。
