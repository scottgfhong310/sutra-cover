/* 繁體中文（zh-Hant） */
I18n.register('zh-Hant', {
  'title.page': '典籍封面',
  'app.title': '典籍封面',
  'app.sub': '輸入題名與譯者／作者，直排排在 A4 上直接列印',

  /* 輸入 */
  'form.legend': '內容',
  'form.code': '典籍編號',
  'form.codeHelp': '例：T2428；儲存時的鍵（英數與 . _ -，自動轉大寫）',
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

  /* 清單 */
  'side.header': '典籍封面',
  'side.filter': '篩選編號、題名、作者…',
  'side.empty': '尚無封面——填好後按側鍵的「儲存」',
  'side.skipped': '有 {n} 個檔讀不進來，未列在上面：{list}',

  /* 側鍵 */
  'tool.print': '列印',
  'tool.menu': '封面清單',
  'tool.save': '儲存這份封面（⌘／Ctrl-S）',
  'tool.delete': '刪除',
  'tool.copyLink': '複製這份封面的連結',
  'tool.mode': '切換 light / dark',
  'tool.lang': '語言',
  'tool.more': '更多工具',
  'tool.clearFilter': '清除',

  /* toast */
  'toast.lang': '已切換為 {name}',
  'toast.copied': '已複製',
  'toast.copyFail': '複製失敗',
  'toast.printOver': '題名超出紙張下緣，印出來會被裁掉',
  'toast.saved': '已儲存：{c}',
  'toast.deleted': '已刪除：{n}',
  'toast.codeInvalid': '請先填典籍編號（英數與 . _ -，例：T2428）',
  'toast.saveFail': '存檔失敗：{m}',
  'toast.deleteFail': '刪除失敗：{m}',
  'toast.listFail': '讀取檔案清單失敗：{m}',
  'toast.loadFail': '載入失敗：{n}（{m}）',
  'confirm.overwrite': '「{c}」已經存過了。要用目前的內容覆寫嗎？（舊的那份會備份到 .bak）',
  'confirm.delete': '確定要刪除「{c}　{t}」嗎？檔案會移到 .bak 備份。'
});
