/* 繁體中文（zh-Hant） */
I18n.register('zh-Hant', {
  'title.page': '典籍封面',
  'app.title': '典籍封面',
  'app.sub': '輸入題名與譯者／作者，直排排在 A4 上直接列印',

  /* 輸入 */
  'form.legend': '內容',
  'form.title': '典籍題名',
  'form.author': '譯者／作者',
  'form.authorHelp': '全形空格（　）照原樣保留，例如「遍照金剛　撰」',
  'form.titleStyle': '題名樣式',
  'form.size': '字級 (pt)',
  'form.ls': '字距 (em)',
  'btn.reset': '還原字級與字距',
  'btn.print': '列印',

  /* 版面 */
  'status.legend': '版面',
  'status.chars': '題名字數',
  'status.ratio': '佔可用高度',
  'status.span': '（{used} / {avail} mm）',
  'status.max': '這組字級／字距可容納',
  'status.about': '約 {n}',
  'status.charUnit': '字',
  'fit.empty': '題名是空的——只會印出譯者／作者。',
  'fit.over': '題名超出紙張下緣，超出的字會被裁掉。請縮小字級或字距。',
  'fit.tight': '題名已貼近紙張下緣。',
  'font.yes': '字型：{f}（魏碑）已使用。',
  'font.no': '本機沒有 {f}，正以一般明體代替——印出來不會是魏碑。',
  'font.unknown': '無法偵測字型是否為 {f}（這個瀏覽器量不出字型差異）。',

  /* 預覽 */
  'preview.hint': '預覽即列印內容（A4 直式）；虛線是紙內留邊，題名超出下緣會被裁掉。列印時請把邊界設為「無」或「預設」並關閉頁首頁尾。',
  'print.docTitle': '封面：{t}',

  /* 側鍵 */
  'tool.print': '列印',
  'tool.copyLink': '複製這份封面的連結',
  'tool.mode': '切換 light / dark',
  'tool.lang': '語言',
  'tool.more': '更多工具',

  /* toast */
  'toast.lang': '已切換為 {name}',
  'toast.copied': '已複製',
  'toast.copyFail': '複製失敗',
  'toast.printOver': '題名超出紙張下緣，印出來會被裁掉'
});
