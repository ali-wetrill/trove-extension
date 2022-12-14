export interface TextRange {
  context: string; // For display on the frontend
  contextStartIdx: number; // Start idx of text in context
  text: string; // Text that was highlighted
  uniqueTextStartIdx: number; // Start idx of text in uniqueText
  uniqueText: string; // Text that has been highlighted + prefix/suffix to make it unique
}

/**
 * Serialize selection through text content instead of range.
 */
export const getTextRangeFromRange = (range: Range): TextRange => {
  const ss1 = new SelectionStore().saveSelection();
  const s = getSelection()!;
  s.removeAllRanges();
  s.addRange(range);
  const text = s.toString();
  const fn = s.focusNode!;
  const fo = s.focusOffset;

  const ss2 = new SelectionStore().saveSelection();
  const pageText = getPageText();

  // In case the selected text isn't unique on the current page, we grab context before and after
  // such that we have a unique string
  let uniqueText: string = text;
  let uniqueTextOffset = 0;
  let uniqueTextStartIdx = 0;
  while (isTextUnique(uniqueText, pageText) !== 1) {
    uniqueTextOffset += 5;
    ss2.restoreSelection();
    s.collapseToStart();
    for (let i = 0; i < uniqueTextOffset; i++) s.modify('extend', 'left', 'character');
    s.collapseToStart();
    s.extend(fn, fo);
    uniqueTextStartIdx = s.toString().lastIndexOf(text);
    for (let i = 0; i < uniqueTextOffset; i++) s.modify('extend', 'right', 'character');
    uniqueText = s.toString();
  }

  // Get context
  ss2.restoreSelection();
  s.collapseToStart();
  for (let i = 0; i < 10; i++) s.modify('extend', 'left', 'word');
  s.collapseToStart();
  s.extend(fn, fo);
  const contextStartIdx = s.toString().lastIndexOf(text);
  for (let i = 0; i < 10; i++) s.modify('extend', 'right', 'word');
  const context = s.toString();
  ss1.restoreSelection();
  return { context, contextStartIdx, text, uniqueTextStartIdx, uniqueText };
};

/**
 * Deserialize stored selection.
 * TODO: account for case where selection is no longer unique upon deserialization.
 */
export const getRangeFromTextRange = (tr: TextRange) => {
  const ss1 = new SelectionStore().saveSelection();

  // Irritatingly, text split across divs is represented with '\n\n' in selection.toString(),
  // but selection.modify() traverses the two characters with one hop. Not sure if \n\n\n+ needs to
  // be reduced as well.
  const uniqueTextReduced = tr.uniqueText.replace('\n\n', '\n');
  const textReduced = tr.text.replace('\n\n', '\n');
  const textPrefixReduced = tr.uniqueText.slice(0, tr.uniqueTextStartIdx).replace('\n\n', '\n');

  // Since window.line breaks on new line characters, we use it to find the longest line instead
  const line = uniqueTextReduced.split('\n').reduce((s1, s2) => (s1.length >= s2.length ? s1 : s2));
  const s = getSelection()!;
  s.removeAllRanges();
  const ss2 = new SelectionStore();

  // Check to see if each hit for line is the one we want
  while (window.find(line, true, false)) {
    ss2.saveSelection();

    // Expand current selection (line) to uniqueText
    s.collapseToStart();
    const m1 = uniqueTextReduced.indexOf(line);
    const e1 = uniqueTextReduced.length;
    for (let i = 0; i < m1; i++) s.modify('move', 'left', 'character');
    for (let i = 0; i < e1; i++) s.modify('extend', 'right', 'character');

    // Shrink selected uniqueText to text
    if (s.toString() === tr.uniqueText) {
      if (tr.uniqueText === tr.text) {
        const range = s.getRangeAt(0).cloneRange();
        ss1.restoreSelection();
        return range;
      }

      s.collapseToStart();
      const m2 = textPrefixReduced.length;
      const e2 = textReduced.length;
      for (let i = 0; i < m2; i++) s.modify('move', 'right', 'character');
      for (let i = 0; i < e2; i++) s.modify('extend', 'right', 'character');
      const range = s.getRangeAt(0).cloneRange();
      ss1.restoreSelection();
      return range;
    } else {
      // This wasn't the correct hit, so restore selection for next pass of window.find
      ss2.restoreSelection();
    }
  }

  console.error("Couldn't find Range corresponding to text:", tr.text);
  ss1.restoreSelection();
  return null;
};

/**
 * Compare two TextRanges and return whether or not they describe the same Range.
 * @param tr1
 * @param tr2
 */
export const areTextRangesEqual = (tr1: TextRange, tr2: TextRange): boolean => {
  return (
    tr1.uniqueText === tr2.uniqueText &&
    tr1.uniqueTextStartIdx === tr2.uniqueTextStartIdx &&
    tr1.text === tr2.text
  );
};

/**
 * Determine if given text is unique on current page.
 * @param text
 * @param memoPageText
 * @returns -1 if text is not found
 *           0 if text is found multiple times
 *           1 if text is found only once
 */
const isTextUnique = (text: string, memoPageText?: string): number => {
  const pageText = memoPageText || getPageText();
  const idx1 = pageText.indexOf(text);
  let isUnique = -1;
  if (idx1 !== -1) {
    const idx2 = pageText.lastIndexOf(text);
    isUnique = idx1 === idx2 ? 1 : 0;
  }

  return isUnique;
};

/**
 * Get all text on the current page.
 */
export const getPageText = () => {
  const range = document.createRange();
  range.selectNodeContents(document.body);

  const selection = getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection.toString();
};

/**
 * Simple class to save and restore selections.
 */
class SelectionStore {
  range: Range | null = null;

  saveSelection = () => {
    const selection = getSelection()!;
    if (selection.rangeCount > 0) {
      this.range = selection.getRangeAt(0).cloneRange();
    }

    return this;
  };

  restoreSelection = () => {
    const s = getSelection()!;
    s.removeAllRanges();

    if (!this.range) return null;
    s.addRange(this.range);
    return this.range;
  };
}
