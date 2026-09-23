/* English (en) */
I18n.register('en', {
  'title.page': 'Sutra Cover',
  'app.title': 'Sutra Cover',
  'app.sub': 'Enter a title and translator / author — set vertically on A4, ready to print',

  /* Input */
  'form.legend': 'Content',
  'form.code': 'Text number',
  'form.codeHelp': 'e.g. T2428; the key used when saving (letters, digits, . _ -; upper-cased)',
  'form.title': 'Title',
  'form.author': 'Translator / Author',
  'form.authorHelp': 'Full-width spaces (　) are kept as typed, e.g. 遍照金剛　撰',
  'form.titleStyle': 'Title style',
  'form.size': 'Size (pt)',
  'form.ls': 'Spacing (em)',
  'btn.reset': 'Reset size & spacing',
  'btn.print': 'Print',
  'btn.clearText': 'Clear number, title and author',

  /* Layout */
  'status.legend': 'Layout',
  'status.chars': 'Title characters',
  'status.ratio': 'Height used',
  'status.span': '({used} / {avail} mm)',
  'status.max': 'Fits at this size / spacing',
  'status.about': '≈ {n}',
  'status.charUnit': 'chars',
  'fit.empty': 'The title is empty — only the translator / author will print.',
  'fit.blank': 'Both the title and the translator / author are empty — the page would print blank.',
  'fit.over': 'The title runs past the bottom of the page; the overflow will be cut off. Reduce the size or spacing.',
  'fit.tight': 'The title is close to the bottom of the page.',
  'font.yes': 'Font: {f} (Weibei) is in use.',
  'font.no': '{f} is not available here; a generic serif is used instead — the print will not be in Weibei.',
  'font.unknown': 'Cannot tell whether {f} is in use (this browser cannot measure font differences).',

  /* Preview */
  'preview.hint': 'The preview is exactly what prints (A4 portrait); the dashed line is the page margin, and anything past the bottom is cut off. When printing, set margins to “None” or “Default” and turn off headers and footers.',
  'print.docTitle': 'Cover: {t}',

  /* List */
  'side.header': 'Covers',
  'side.filter': 'Filter by number, title, author…',
  'side.empty': 'No covers yet — fill in the form and press Save',
  'side.skipped': '{n} file(s) could not be read and are not listed: {list}',

  /* Side tools */
  'tool.print': 'Print',
  'tool.menu': 'Cover list',
  'tool.save': 'Save this cover (⌘ / Ctrl-S)',
  'tool.delete': 'Delete',
  'tool.copyLink': 'Copy a link to this cover',
  'tool.mode': 'Toggle light / dark',
  'tool.lang': 'Language',
  'tool.more': 'More tools',
  'tool.clearFilter': 'Clear',

  /* toast */
  'toast.lang': 'Switched to {name}',
  'toast.copied': 'Copied',
  'toast.copyFail': 'Copy failed',
  'toast.printOver': 'The title runs past the bottom of the page and will be cut off',
  'toast.saved': 'Saved: {c}',
  'toast.deleted': 'Deleted: {n}',
  'toast.codeInvalid': 'Enter a text number first (letters, digits, . _ -; e.g. T2428)',
  'toast.saveFail': 'Save failed: {m}',
  'toast.deleteFail': 'Delete failed: {m}',
  'toast.listFail': 'Failed to load file list: {m}',
  'toast.loadFail': 'Failed to load: {n} ({m})',
  'confirm.overwrite': '“{c}” is already saved. Overwrite it with the current content? (The old one is backed up to .bak)',
  'confirm.delete': 'Delete “{c} {t}”? The file will be moved to the .bak backup.'
});
