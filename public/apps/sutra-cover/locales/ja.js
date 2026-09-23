/* 日本語（ja） */
I18n.register('ja', {
  'title.page': '典籍表紙',
  'app.title': '典籍表紙',
  'app.sub': '題名と訳者／著者を入力し、A4 に縦組みで配置してそのまま印刷',

  /* 入力 */
  'form.legend': '内容',
  'form.code': '典籍番号',
  'form.codeHelp': '例：T2428。保存時のキー（英数字と . _ -、大文字に変換）',
  'form.title': '典籍の題名',
  'form.author': '訳者／著者',
  'form.authorHelp': '全角スペース（　）はそのまま保持されます（例：遍照金剛　撰）',
  'form.titleStyle': '題名のスタイル',
  'form.size': '文字サイズ (pt)',
  'form.ls': '字間 (em)',
  'btn.reset': '文字サイズと字間を戻す',
  'btn.print': '印刷',
  'btn.clearText': '番号・題名・著者をクリア',

  /* 版面 */
  'status.legend': 'レイアウト',
  'status.chars': '題名の文字数',
  'status.ratio': '使用可能な高さに対して',
  'status.span': '（{used} / {avail} mm）',
  'status.max': 'このサイズ／字間で収まる数',
  'status.about': '約 {n}',
  'status.charUnit': '字',
  'fit.empty': '題名が空です——訳者／著者だけが印刷されます。',
  'fit.blank': '題名も訳者／著者も空です——印刷すると白紙になります。',
  'fit.over': '題名が用紙の下端を超えています。はみ出した文字は切れます。文字サイズか字間を小さくしてください。',
  'fit.tight': '題名が用紙の下端に近づいています。',
  'font.yes': 'フォント：{f}（魏碑）を使用中。',
  'font.no': 'この環境には {f} がないため、一般的な明朝体で代用しています——印刷は魏碑になりません。',
  'font.unknown': '{f} が使われているか判定できません（このブラウザではフォントの違いを計測できません）。',

  /* プレビュー */
  'preview.hint': 'プレビューがそのまま印刷されます（A4 縦）。破線は余白で、下端を超えた部分は切れます。印刷時は余白を「なし」か「デフォルト」にし、ヘッダーとフッターをオフにしてください。',
  'print.docTitle': '表紙：{t}',

  /* 一覧 */
  'side.header': '典籍表紙',
  'side.filter': '番号・題名・著者で絞り込み…',
  'side.empty': '表紙はまだありません——入力して「保存」を押してください',
  'side.skipped': '{n} 件のファイルを読み込めず、一覧にありません：{list}',

  /* サイドツール */
  'tool.print': '印刷',
  'tool.menu': '表紙一覧',
  'tool.save': 'この表紙を保存（⌘／Ctrl-S）',
  'tool.delete': '削除',
  'tool.copyLink': 'この表紙のリンクをコピー',
  'tool.mode': 'ライト / ダーク切替',
  'tool.lang': '言語',
  'tool.more': 'その他のツール',
  'tool.clearFilter': 'クリア',

  /* toast */
  'toast.lang': '{name} に切り替えました',
  'toast.copied': 'コピーしました',
  'toast.copyFail': 'コピーに失敗しました',
  'toast.printOver': '題名が用紙の下端を超えており、印刷すると切れます',
  'toast.saved': '保存しました：{c}',
  'toast.deleted': '削除しました：{n}',
  'toast.codeInvalid': '先に典籍番号を入力してください（英数字と . _ -、例：T2428）',
  'toast.saveFail': '保存に失敗：{m}',
  'toast.deleteFail': '削除に失敗：{m}',
  'toast.listFail': 'ファイル一覧の取得に失敗：{m}',
  'toast.loadFail': '読み込み失敗：{n}（{m}）',
  'confirm.overwrite': '「{c}」はすでに保存されています。現在の内容で上書きしますか？（古いものは .bak にバックアップされます）',
  'confirm.delete': '「{c}　{t}」を削除しますか？ファイルは .bak に移動されます。'
});
