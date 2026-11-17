import type PDFDocument from 'pdfkit';

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

/**
 * Visual (left-to-right drawing) order of the words in one line.
 * PDFKit shapes Arabic letters but has no bidi algorithm: it lays words out
 * left to right. So: a line whose first letter is Arabic is right-to-left
 * (word order reversed), and runs of Latin words/numbers inside it keep their
 * own order, and vice versa.
 */
export function visualWords(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.some((w) => ARABIC.test(w))) return words;
  const firstStrong = text.match(/[A-Za-z\u0600-\u06FF]/)?.[0] ?? '';
  const rtl = ARABIC.test(firstStrong);

  // Strong direction per word: Arabic letters, Latin letters, or neutral (digits/punctuation).
  const strong = words.map((w) => (ARABIC.test(w) ? 'ar' : /[A-Za-z]/.test(w) ? 'lat' : null));
  const paragraph = rtl ? 'ar' : 'lat';
  const resolved = words.map((word, i) => {
    if (strong[i]) return strong[i];
    const prev = strong.slice(0, i).reverse().find(Boolean) ?? null;
    const next = strong.slice(i + 1).find(Boolean) ?? null;
    // Numbers follow the text before them ("Apt 7", "قهوة 250"); other
    // neutrals take the side they sit in, or the paragraph direction.
    if (/\d/.test(word) && prev) return prev;
    return prev && prev === next ? prev : paragraph;
  });

  // Group consecutive words of the same direction.
  const runs: { arabic: boolean; words: string[] }[] = [];
  words.forEach((word, i) => {
    const arabic = resolved[i] === 'ar';
    const last = runs[runs.length - 1];
    if (last && last.arabic === arabic) last.words.push(word);
    else runs.push({ arabic, words: [word] });
  });
  const ordered = rtl ? [...runs].reverse() : runs;
  return ordered.flatMap((run) => (run.arabic ? [...run.words].reverse() : run.words));
}

/**
 * Draws one line of mixed Arabic/English text inside [x, x + width], shrinking
 * the font if it does not fit. Each word is drawn separately in visual order.
 */
export function drawLine(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  x: number,
  y: number,
  width: number,
  opts: { size: number; font: string; align?: 'left' | 'right' | 'center'; color?: string },
): void {
  const words = visualWords(text);
  doc.font(opts.font).fillColor(opts.color ?? '#1c1917');
  let size = opts.size;
  const measure = () => {
    doc.fontSize(size);
    const space = doc.widthOfString(' ');
    return words.reduce((sum, w) => sum + doc.widthOfString(w), 0) + space * Math.max(words.length - 1, 0);
  };
  let total = measure();
  while (total > width && size > 6) {
    size -= 0.5;
    total = measure();
  }
  const space = doc.widthOfString(' ');
  let cursor =
    opts.align === 'right' ? x + width - total : opts.align === 'center' ? x + (width - total) / 2 : x;
  for (const word of words) {
    doc.text(word, cursor, y, { lineBreak: false });
    cursor += doc.widthOfString(word) + space;
  }
}
