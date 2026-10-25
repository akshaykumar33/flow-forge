import type { MeasureText, TextStyle } from './types.js';

/**
 * Deterministic width estimate for proportional sans-serif fonts: average glyph width of
 * 0.58em, wide glyphs (W, M, CJK) counted larger and narrow ones (i, l, punctuation) smaller.
 * Good enough to size boxes without a DOM; renderers that know the font can pass a real
 * measurer instead.
 */
export const estimateTextWidth: MeasureText = (text, style) => {
  let ems = 0;
  for (const ch of text) {
    if (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿＀-｠]/.test(ch)) ems += 1;
    else if (/[WMwm@%]/.test(ch)) ems += 0.85;
    else if (/[A-Z0-9]/.test(ch)) ems += 0.65;
    else if (/[iljtf.,:;'!|() ]/.test(ch)) ems += 0.32;
    else ems += 0.55;
  }
  const boldFactor = style.fontWeight >= 600 ? 1.06 : 1;
  return Math.ceil(ems * style.fontSize * boldFactor);
};

/**
 * Greedy word wrap to `maxWidth`. Explicit line breaks are kept; a single word longer than the
 * limit gets its own line rather than being split mid-word.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  style: TextStyle,
  measure: MeasureText,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (line !== '' && measure(candidate, style) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function lineHeight(style: TextStyle): number {
  return Math.ceil(style.fontSize * 1.35);
}
