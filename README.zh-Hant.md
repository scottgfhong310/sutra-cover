# sutra-cover

> 版本 v1.0｜最後更新 2026-09-23

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
- 深連結：所有參數都在網址（`?t=&a=&s=&ls=`），複製連結＝存檔。
- light / dark 主題（兩者印出來都是白紙）、繁中／英／日介面。

## 執行

```bash
npm install
npm start          # → http://localhost:3000/apps/sutra-cover/
npm run verify     # 22 條契約檢查
```

Node ≥ 18，`PORT` 可覆寫埠號。

列印時請把邊界設為「**無**」或「**預設**」，並**關閉頁首與頁尾**。

## 目錄結構

```
app.js                        靜態檔 + / → 302 + JSON 404（無 API）
scripts/verify.js             契約檢查
public/apps/sutra-cover/
  index.html                  純結構
  sutra-cover.css             主題 token、頁面樣式、封面版式、列印
  sutra-cover.js              控制器：DOM、事件、量版面、字型檢查、i18n
  sutra-cover-lib.js          核心邏輯，不碰 DOM → window.SutraCoverLib
  i18n.js, locales/           繁中／英／日
  side-tool.*, materialize-dark.css   家族共用件
  icons/                      favicon、apple-touch、PWA manifest
```

## HTTP

| Method | Path | 說明 |
|---|---|---|
| GET | `/` | 302 → `/apps/sutra-cover/` |
| GET | `/apps/sutra-cover/…` | 靜態前端 |
| * | `/api/*` | `404 { ok: false }`——沒有 API |

## 深連結

| 參數 | 意義 | 預設 |
|---|---|---|
| `t` | 題名 | `即身成佛義` |
| `a` | 譯者／作者 | `遍照金剛　撰` |
| `s` | 題名字級，pt（8–96） | `36` |
| `ls` | 題名字距，em（0–3） | `1.25` |

`t=` 留空就是空題名——**不會被補回範例**。

## 核心 library

`window.SutraCoverLib`——純函式、不碰 DOM：

| 函式 | 回傳 |
|---|---|
| `normalize(input)` | `{ title, author, size, ls }`，夾值；沒給的欄位退回原型值 |
| `parseQuery(search)` / `buildQuery(params, baseSearch?)` | 網址 ⇄ 參數（保留 `lang` 等不相干的參數） |
| `trailingCompensation(ls)` | 題名末字抵銷，`−ls` em |
| `availableHeightPt()` | A4 上題名可用高度（pt） |
| `titleSpanPt(n, size, ls)` / `maxChars(size, ls)` | *n* 字的估計佔高／放得下幾字 |
| `fitState(ratio)` | `'ok'`、`'tight'` 或 `'over'` |

## 備註

- *Weibei TC* 是沒有再散布授權的系統字型，只以名稱引用、**永遠不隨 repo 散布**。
  沒有它的電腦上，頁面會講明並以一般明體列印。
- 字數估計假設每字 1em（漢字成立）；版面量尺本身是量實際畫面得來的。
- 純前端、相對路徑，Express 只負責提供檔案。**未設定 GitHub Pages。**

[MIT](LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
