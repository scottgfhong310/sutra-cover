# sutra-cover

> 版本 v1.2｜最後更新 2026-09-24

[English](README.md) ｜ [繁體中文](README.zh-Hant.md) ｜ [日本語](README.ja.md)

A cover page maker for **sutras and classical texts**. Type a title and a translator / author line;
the app sets them vertically on an A4 page — title on the right, author on the left, bottoms aligned —
and you print it. The title's size and letter spacing are adjustable.

The layout comes from a hand-made prototype (`cover.html`) and is reproduced exactly: measured side
by side, the title column, author column, bottom alignment and column gap match to the pixel.

## Features

- **The preview is the print.** The page on screen is laid out at real size (mm) and scaled to fit;
  printing hides everything else. `@page` is A4 portrait with zero margin, and the 10 mm margin lives
  inside the sheet — so screen and paper agree to the millimetre.
- **Title size (pt) and spacing (em)**, each with a slider and a number box. The trailing spacing after
  the last character is cancelled so the title and author columns stay bottom-aligned at any spacing.
- **Fit gauge**: how much of the usable height the title takes (measured, not guessed), an estimate of
  how many characters fit at the current size, and a red line at the page margin when it overflows.
  The app warns instead of shrinking your title — the size you chose is left alone.
- **Font check**: the layout uses *Weibei TC* (a macOS system font). The app measures pixels to tell
  whether that font is actually in use and says so plainly when it is not, instead of printing in a
  fallback serif without telling you.
- **Full-width spaces are kept** — `遍照金剛　撰` stays exactly as typed.
- **Saved covers with a text number.** Give each cover its number (e.g. `T2428` for 即身成佛義) and save
  it (side tool or ⌘/Ctrl-S). The **cover list** slides in from the right, like the file list in
  `markdown-reader`: filter by number, title or author, click to load, delete (moved to a backup).
  One number = one cover; saving an existing number asks before overwriting. The number is data only —
  it is not printed on the cover.
- A **clear** button next to Print empties the number, title and author (size and spacing stay).
- Deep links: everything lives in the URL (`?c=&t=&a=&s=&ls=`); `?c=T2428` alone opens that saved cover.
- Light / dark theme (prints on white either way), zh-Hant / en / ja interface.

## Run

```bash
npm install
npm start          # → http://localhost:3000/apps/sutra-cover/
npm run verify     # 36 contract checks (6 of them run the API against a temp folder)
```

Node ≥ 18. `PORT` overrides the port.

When printing, choose margins **None** or **Default** and turn **headers and footers off**.

## Structure

```
app.js                        static files + /api/sutra-cover + / → 302 + JSON 404
routes/sutra-cover.js         save / list / delete covers (validation comes from the lib)
scripts/verify.js             contract checks
public/apps/sutra-cover/
  index.html                  structure only
  sutra-cover.css             theme tokens, page styles, cover layout, print
  sutra-cover.js              controller: DOM, events, measuring, font check, i18n
  sutra-cover-lib.js          core logic, no DOM → window.SutraCoverLib
  i18n.js, locales/           zh-Hant / en / ja
  side-tool.*, filter-clear.*, materialize-dark.css   family shared components
  icons/                      favicon, apple-touch, PWA manifest
public/upload/sutra-cover/    saved covers, <code>.json (not in git)
```

## HTTP

| Method | Path | Description |
|---|---|---|
| GET | `/` | 302 → `/apps/sutra-cover/` |
| GET | `/apps/sutra-cover/…` | static front end |
| GET | `/api/sutra-cover/covers` | `{ ok, covers, skipped }` — covers sorted by number; `skipped` lists files that could not be read |
| GET | `/api/sutra-cover/covers/:code` | `{ ok, cover }`; 404 if missing |
| PUT | `/api/sutra-cover/covers/:code` | body `{ title, author, size, ls, overwrite }` → `{ ok, cover, created }`; **409 `exists`** unless `overwrite:true` (the old file is backed up to `.bak/` first) |
| DELETE | `/api/sutra-cover/covers/:code` | `{ ok }` — the file is moved to `.bak/`, not erased |

A cover is stored as `public/upload/sutra-cover/<code>.json` — **one file per number**. Numbers are
upper-cased (macOS file names are case-insensitive, so `t2428` and `T2428` are the same file) and may
contain letters, digits and `. _ -`. Invalid numbers get `400 invalid-code`.

## Deep links

| Param | Meaning | Default |
|---|---|---|
| `c` | text number (alone: open that saved cover) | `T2428` |
| `t` | title | `即身成佛義` |
| `a` | translator / author | `遍照金剛　撰` |
| `s` | title size, pt (8–96) | `36` |
| `ls` | title letter spacing, em (0–3) | `1.25` |

An empty `t=` means an empty title — it is not replaced by the sample.

## Core library

`window.SutraCoverLib` — pure functions, no DOM:

| Function | Returns |
|---|---|
| `normalize(input)` | `{ code, title, author, size, ls }`, clamped; missing fields fall back to the prototype values |
| `cleanCode(s)` / `isValidCode(code)` | strip spaces + upper-case / can it be a key and file name |
| `compareCode(a, b)` / `matchCover(cover, q)` | number-aware sort (T262 before T2428) / list filter |
| `listCovers()` / `getCover(code)` / `saveCover(params, overwrite)` / `deleteCover(code)` | the API, as Promises |
| `parseQuery(search)` / `buildQuery(params, baseSearch?)` | URL ⇄ params (keeps unrelated params such as `lang`) |
| `trailingCompensation(ls)` | the title's end margin, `−ls` em |
| `availableHeightPt()` | usable height for the title on A4, pt |
| `titleSpanPt(n, size, ls)` / `maxChars(size, ls)` | estimated span of *n* characters / how many fit |
| `fitState(ratio)` | `'ok'`, `'tight'` or `'over'` |

## Notes

- *Weibei TC* is a system font with no redistribution licence; it is referenced by name only and is
  **never bundled**. On machines without it the page tells you and prints in a generic serif.
- The character-count estimate assumes 1 em per character (true for CJK). The fit gauge itself is
  measured from the rendered page.
- Needs the Express server for saving and the list (printing works without it). **Not configured for GitHub Pages.**
- There is no login: anyone who can reach the server can save and delete covers (deleted files stay in `.bak/`).

[MIT](LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
