/** Code points XML 1.0 does not allow: C0 controls except tab, LF and CR, and U+FFFE/U+FFFF. */
// eslint-disable-next-line no-control-regex -- matching these control characters is the purpose.
const XML_FORBIDDEN = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\uFFFE\\uFFFF]', 'g');

/**
 * Escapes text for XML text nodes and double-quoted attributes. Every string that came from a
 * diagram passes through here before reaching the SVG; that is the whole injection defence, so
 * it covers all five XML specials and strips characters XML 1.0 forbids.
 */
export function escapeXml(text: string): string {
  return text
    .replace(XML_FORBIDDEN, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Two decimals at most, no trailing zeros: stable output and compact files. */
export function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Theme colours are user-suppliable, so they are validated rather than trusted. */
export function color(value: string): string {
  if (
    /^#[0-9a-f]{3,8}$/i.test(value) ||
    /^(rgb|hsl)a?\([\d\s.,%/-]+\)$/i.test(value) ||
    value === 'none'
  ) {
    return value;
  }
  throw new Error(`Invalid theme colour "${value}". Use #hex, rgb(), hsl() or none.`);
}
