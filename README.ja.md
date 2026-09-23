# sutra-cover

> 版本 v1.1｜最後更新 2026-09-23

[English](README.md) ｜ [繁體中文](README.zh-Hant.md) ｜ [日本語](README.ja.md)

**典籍の表紙**を組むツール。題名と訳者／著者を入力すると、A4 に縦組みで配置します——題名は右、
著者は左、両欄の下端をそろえて——そのまま印刷できます。題名の文字サイズと字間は調整可能です。

版面は手作りのプロトタイプ（`cover.html`）をそのまま再現しています。並べて計測すると、題名欄の高さ・
著者欄の高さ・下端そろえ・欄間はピクセル単位で一致します。

## 機能

- **プレビューがそのまま印刷されます。** 画面上の用紙は実寸（mm）で組んでから縮小表示し、印刷時は他の要素を
  隠すだけです。`@page` は A4 縦・余白 0、10mm の余白は用紙の内側にあるため、**画面と紙がミリ単位で一致**します。
- **題名の文字サイズ（pt）と字間（em）**：スライダーと数値欄が連動します。最後の文字の後ろに付く字間は打ち消されるので、
  どの字間でも題名と著者の下端はそろいます。
- **レイアウト計**：題名が使用可能な高さの何％を占めるか（**実測値**）、このサイズ・字間でおよそ何字入るか、
  はみ出すと用紙下端の余白線が赤くなります。**警告するだけで自動縮小はしません**——指定したサイズは変えません。
- **フォント確認**：版面は *Weibei TC*（魏碑、macOS のシステムフォント）を使います。実際に使われているかをピクセルで判定し、
  使われていなければはっきり表示します。代替の明朝体で黙って印刷することはありません。
- **全角スペースはそのまま保持**——`遍照金剛　撰` は入力どおりです。
- **典籍番号つきで保存。** 表紙ごとに番号（即身成佛義なら `T2428`）を付け、サイドツールか ⌘／Ctrl-S で保存します。
  **表紙一覧**は右からスライドして開き（`markdown-reader` のファイル一覧と同じ形）、番号・題名・著者で絞り込み、
  クリックで読み込み、削除（バックアップへ移動）ができます。1 番号 1 表紙で、既存の番号に保存するときは上書きを確認します。
  番号はデータのみで、**表紙には印刷しません**。
- ディープリンク：すべての値は URL（`?c=&t=&a=&s=&ls=`）にあり、`?c=T2428` だけなら保存済みの表紙を開きます。
- ライト／ダーク（どちらでも白い紙に印刷）、繁体中文／英語／日本語 UI。

## 実行

```bash
npm install
npm start          # → http://localhost:3000/apps/sutra-cover/
npm run verify     # 33 項目の契約チェック（うち 6 項目は一時フォルダで API を実際に実行）
```

Node ≥ 18。`PORT` でポートを上書きできます。

印刷時は余白を「**なし**」か「**デフォルト**」にし、**ヘッダーとフッターをオフ**にしてください。

## ディレクトリ構成

```
app.js                        静的ファイル + /api/sutra-cover + / → 302 + JSON 404
routes/sutra-cover.js         表紙の保存／一覧／削除（検証規則は lib から）
scripts/verify.js             契約チェック
public/apps/sutra-cover/
  index.html                  構造のみ
  sutra-cover.css             テーマトークン、ページスタイル、表紙版面、印刷
  sutra-cover.js              コントローラー：DOM、イベント、計測、フォント確認、i18n
  sutra-cover-lib.js          コアロジック、DOM に触れない → window.SutraCoverLib
  i18n.js, locales/           繁体中文／英語／日本語
  side-tool.*, filter-clear.*, materialize-dark.css   ファミリー共通部品
  icons/                      favicon、apple-touch、PWA manifest
public/upload/sutra-cover/    保存した表紙 <番号>.json（git 管理外）
```

## HTTP

| Method | Path | 説明 |
|---|---|---|
| GET | `/` | 302 → `/apps/sutra-cover/` |
| GET | `/apps/sutra-cover/…` | 静的フロントエンド |
| GET | `/api/sutra-cover/covers` | `{ ok, covers, skipped }`——番号順；`skipped` は読み込めなかったファイル名 |
| GET | `/api/sutra-cover/covers/:code` | `{ ok, cover }`；存在しなければ 404 |
| PUT | `/api/sutra-cover/covers/:code` | body `{ title, author, size, ls, overwrite }` → `{ ok, cover, created }`；既存で `overwrite:true` がなければ **409 `exists`**（上書き前に古いファイルを `.bak/` へバックアップ） |
| DELETE | `/api/sutra-cover/covers/:code` | `{ ok }`——ファイルは `.bak/` へ移動、消去はしません |

表紙は `public/upload/sutra-cover/<番号>.json` に保存——**1 番号 1 ファイル**。番号は大文字に変換されます
（macOS のファイル名は大文字小文字を区別しないため `t2428` と `T2428` は同じファイル）。英数字と `. _ -` が使えます。不正な番号は `400 invalid-code`。

## ディープリンク

| パラメータ | 意味 | 既定値 |
|---|---|---|
| `c` | 典籍番号（これだけなら保存済みの表紙を開く） | `T2428` |
| `t` | 題名 | `即身成佛義` |
| `a` | 訳者／著者 | `遍照金剛　撰` |
| `s` | 題名の文字サイズ、pt（8–96） | `36` |
| `ls` | 題名の字間、em（0–3） | `1.25` |

`t=` が空なら題名は空です——**見本に戻されることはありません**。

## コアライブラリ

`window.SutraCoverLib`——純粋関数、DOM に触れません：

| 関数 | 戻り値 |
|---|---|
| `normalize(input)` | `{ code, title, author, size, ls }`、範囲内に丸め、未指定はプロトタイプの値 |
| `cleanCode(s)` / `isValidCode(code)` | 空白除去＋大文字化／キーとファイル名に使えるか |
| `compareCode(a, b)` / `matchCover(cover, q)` | 数字を考慮した並び（T262 は T2428 の前）／一覧の絞り込み |
| `listCovers()` / `getCover(code)` / `saveCover(params, overwrite)` / `deleteCover(code)` | 上記 API を Promise で |
| `parseQuery(search)` / `buildQuery(params, baseSearch?)` | URL ⇄ パラメータ（`lang` など無関係なパラメータは保持） |
| `trailingCompensation(ls)` | 題名末尾の打ち消し、`−ls` em |
| `availableHeightPt()` | A4 上で題名が使える高さ（pt） |
| `titleSpanPt(n, size, ls)` / `maxChars(size, ls)` | *n* 字の推定高さ／何字入るか |
| `fitState(ratio)` | `'ok'`、`'tight'`、`'over'` |

## 備考

- *Weibei TC* は再配布許諾のないシステムフォントで、名前で参照するだけです。**リポジトリには決して含めません**。
  ない環境ではその旨を表示し、一般的な明朝体で印刷されます。
- 文字数の推定は 1 字 1em を前提とします（漢字では成立）。レイアウト計そのものは実際の画面から計測しています。
- 保存と一覧には Express サーバーが必要です（印刷は不要）。**GitHub Pages 用の設定はしていません。**
- ログインはありません。サーバーに届く人なら誰でも表紙を保存・削除できます（削除したファイルは `.bak/` に残ります）。

[MIT](LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
