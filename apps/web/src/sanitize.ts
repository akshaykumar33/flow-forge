import DOMPurify from 'dompurify';

/**
 * Defence in depth for the canvas. The renderer already escapes every model string and emits no
 * active content (renderer security tests), but the canvas is where untrusted diagrams meet a
 * live page, so its SVG passes through DOMPurify's SVG profile too. A future renderer bug then
 * cannot become script execution here. Icon data URIs on <image> are allowed by the profile.
 */
export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_ATTR: ['data-node-id', 'data-edge-id', 'data-group-id'],
  });
}
