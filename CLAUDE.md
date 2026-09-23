# CLAUDE.md — sutra-cover

> 版本 v1.2｜最後更新 2026-09-24

典籍封面編排：輸入編號、題名與譯者／作者，直排排在 A4 上直接列印；封面可存、右側有清單。
**單頁、零資料庫**——資料層是 DATABASE_GUIDELINES §0 的**層 1**（一份封面一個 JSON 檔），
後端只有 `/api/sutra-cover`（存／列／刪）＋靜態檔＋根路徑轉址＋JSON 404。

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
app.js                          Express：json(5mb) + static + /api/sutra-cover + / → 302 + JSON 404／錯誤 + PORT||3000
routes/sutra-cover.js           封面的存／列／刪；驗證與正規化載入 lib（不另寫一份）
scripts/verify.js               契約檢查（`npm run verify`；SUTRA_COVER_ROOT=<副本> 做反向驗證）
public/apps/sutra-cover/
  index.html                    純結構（唯一 inline script ＝ §4.1 的防閃爍開機腳本）
  sutra-cover.css               主題 token + 本頁樣式 + 封面版式 + 列印
  sutra-cover.js                控制器：DOM / 事件 / 量版面 / 字型偵測 / i18n / toast
  sutra-cover-lib.js            核心：純邏輯，不碰 DOM → window.SutraCoverLib
  i18n.js, locales/{zh-Hant,en,ja}.js
  side-tool.css, side-tool.js, filter-clear.css, filter-clear.js, materialize-dark.css
  icons/                        favicon / apple-touch / PWA manifest
public/upload/sutra-cover/      <編號>.json（.gitignore 排除，只留 .gitkeep；.bak/ 不經 static 送出）
```

## 執行與驗證

```bash
npm install && npm start        # → http://localhost:3000/apps/sutra-cover/
npm run verify                  # 36 條契約檢查（第 31–36 條在暫存資料夾裡實跑 API），全過 exit 0
```

## 這支的 canon 重點

- **預覽就是列印內容。** 畫面上那張紙以真實尺寸（mm）排版、再用 `transform` 縮到欄寬；
  列印時只由 `@media print` 藏掉其他東西，**不另組一份 DOM**。`@page` 是 `A4 portrait / margin 0`，
  紙內留邊 10mm 由 `.sheet` 的 padding 提供——所以畫面與紙張逐 mm 相同。
- **版式數值的權威在 `sutra-cover-lib.js`**（`TOP_PX`／`COVER_PT`／`GAP_EM`／`PAGE`／`FONT_FAMILY`），
  CSS 寫同樣的數字；兩處一致由 verify 第 14 條盯著。
- **題名的末字字距抵銷（`margin-inline-end: −字距`）要跟字距一起變**，且規則的特異度必須
  ≥ `.cover .vertical { margin: 0 }`——寫成單獨的 `.cv-title` 會被蓋掉、**沒有任何警告**
  （實際踩過，量到 0px）。verify 第 15 條擋著。
- **「佔可用高度」是量 DOM 的**（`offsetHeight`，不受縮放 transform 影響；
  **不要**改用 `getBoundingClientRect`，它量到的是縮小後的值）。lib 的 `maxChars()` 只是估計，畫面上標「約」。
- **文字欄不 trim**：`String.prototype.trim()` 會剝掉 U+3000，而全形空格是版式的一部分（第 3 條）。
  **清空是合法意圖**：`''` 不可以被補回範例文字（第 2 條）。
- **字型偵測是三態**（用上／沒用上／量不出來），以 canvas 像素比對，自帶 serif vs sans-serif 對照組。
  `document.fonts.check()` 對任何字型都回 `true`，**不能用**。
- **WeiBei TC 是 macOS 系統字型（文鼎），沒有再散布授權**——只以族名引用、**永遠不放進 repo**。
- **JS 原始碼裡的 U+3000 要寫成 `\u3000`**：Claude Code 的寫檔工具會把轉義轉成實體字元（第 29 條）——本檔這一行自己就中過一次。
- **儲存：一個編號一份**（owner 拍板）。前端先試新建、**409 才問要不要覆寫**；後端新建用 `fs.open(…,'wx')`
  原子建立（第 33 條：20 個併發只有 1 個成功）——「先查清單再決定」是 TOCTOU（§3.3），不要改回去。
  覆寫先 `.bak`、刪除是**移進 `.bak/`**（第 31／35 條）。
- **編號一律轉大寫**：macOS 的檔名不分大小寫，不轉的話 `t2428` 與 `T2428` 會互相覆寫（第 11 條）。
  **編號不印在封面上**（owner 拍板）。
- **後端的驗證載入前端 lib**（`routes/sutra-cover.js` 以 `vm` 跑 `sutra-cover-lib.js`）——規則只有一份（第 27 條）。
  改 `normalize`／`cleanCode`／`isValidCode` 等於同時改兩邊，**不要在 route 裡補一份自己的**。
- **讀不進來的檔列在 `skipped`，畫面上講出來**（第 34 條）——安靜地少一筆與「沒存過」長得一模一樣。
- 右側清單的 `sidenav-open` 在 **`onCloseStart`** 拿掉（第 26 條）；`onCloseEnd` 在背景分頁永遠不來。
- **清除鈕（`#btn-clear`，圖示 `clear`）在內容卡的「列印」正前方**（第 23 條），**只清編號／題名／作者三欄**
  ——字級、字距不動、不碰任何檔案（第 24 條）；純圖示鈕的 `aria-label` 由 `applyI18n()` 補（`I18n.apply` 碰不到它）。
- 三欄的 `.text-field` 把 `margin-top` 由 14px 加到 28px（第 25 條）：Materialize 的 label 浮起時會上移進 margin 裡，
  14px 下 label 上緣正好貼齊前一個元素（實量 0px）；28px 之後是 14px。
- 側鍵排序照 §5.5／§5.6：`#setting-menu`（`folder_open`）→ `#setting-save` → app 工具 → `#setting-mode` → `#setting-lang`（第 22 條）。
- 共用文案照 §6 正典表逐字抄（第 20 條）。偏離要在 `db_inprogress.meta_i18n.fd_note` 寫理由
  （`tool.menu`／`side.header` 刻意寫「封面清單」／「典籍封面」而不是多數的「檔案清單」，理由已登記）。

## 複製件登記

以下檔案是**家族共用件的 byte-identical 複製件**——改就改權威版再同步各複製點，
**不要在本 repo 就地改**（`npm run verify` 第 30 條會比對）：

| 檔案 | 權威版 |
|---|---|
| `i18n.js` | 家族 repo 根 [`i18n.js`](https://github.com/scottgfhong310/nodeapp-webapp-family/blob/main/i18n.js) |
| `side-tool.css` / `side-tool.js` | 家族 repo 根（DESIGN_GUIDELINES §5.5） |
| `materialize-dark.css` | 家族 repo 根（§5.1） |
| `filter-clear.css` / `filter-clear.js` | **app `local-reader`**（§5.12；唯一權威不在家族 repo 根的那一類） |

`icons/` 是本 app 自有資產，不是複製件。

## InProgress 鏡像

本 repo 是權威。改完要**回灌**孵化器（WORKFLOW A4）：

```bash
cp -R public/apps/sutra-cover/. ../../InProgress/public/apps/sutra-cover/
cp routes/sutra-cover.js ../../InProgress/routes/sutra-cover.js
diff -rq public/apps/sutra-cover ../../InProgress/public/apps/sutra-cover
cmp routes/sutra-cover.js ../../InProgress/routes/sutra-cover.js
```

InProgress 的 `app.js` 只多兩行（`require('./routes/sutra-cover')` ＋ `app.use('/api/sutra-cover', …)`），
**不要**蓋掉它的 `app.js`／`upload.js`；**不要**預先建 `public/upload/sutra-cover/`（第一次儲存時惰性建立）。
改了 route 要重啟 3001——**重啟由 owner 來**。

版式的前身是 InProgress 的 `public/lib/cover.html`（owner 的原型，未動）。
