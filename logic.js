/**
 * Pure logic functions for Lyric2Slides.
 * Extracted for testability — these are used by both index.html and unit tests.
 */

/**
 * Parse lyrics text into slide data.
 * @param {string} text - Raw lyrics text
 * @param {number} maxLines - Max lines per slide (default 4)
 * @param {boolean} blankLineEmpty - Whether blank lines produce empty slides
 * @returns {Array<{lines: string[], index: number, isEmpty: boolean}>}
 */
export function parseSlides(text, maxLines = 4, blankLineEmpty = false) {
  const rawLines = text.split('\n');
  const groups = [];
  let current = [];
  let hasBlankLines = false;

  for (const line of rawLines) {
    if (line.trim() === '') {
      hasBlankLines = true;
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
      if (blankLineEmpty) {
        groups.push([]);
      }
    } else {
      current.push(line.trim());
    }
  }
  if (current.length > 0) groups.push(current);

  // Remove trailing empty groups
  while (groups.length > 0 && groups[groups.length - 1].length === 0) {
    groups.pop();
  }
  // Remove leading empty groups
  while (groups.length > 0 && groups[0].length === 0) {
    groups.shift();
  }

  // If no blank lines found at all, split by maxLines
  if (!hasBlankLines && groups.length === 1) {
    const allLines = groups[0];
    if (allLines.length > maxLines) {
      const chunks = [];
      for (let i = 0; i < allLines.length; i += maxLines) {
        chunks.push(allLines.slice(i, i + maxLines));
      }
      return chunks.map((lines, idx) => ({ lines, index: idx, isEmpty: false }));
    }
  }

  // Sub-split groups that are too long; preserve empty groups as empty slides
  const result = [];
  for (const group of groups) {
    if (group.length === 0) {
      result.push([]);
    } else if (group.length > maxLines) {
      const numChunks = Math.ceil(group.length / maxLines);
      const chunkSize = Math.ceil(group.length / numChunks);
      for (let i = 0; i < group.length; i += chunkSize) {
        result.push(group.slice(i, i + chunkSize));
      }
    } else {
      result.push(group);
    }
  }

  return result.map((lines, idx) => ({ lines, index: idx, isEmpty: lines.length === 0 }));
}

/**
 * PPTX slide dimensions for LAYOUT_WIDE (16:9).
 */
export const PPTX = {
  WIDTH: 13.33,   // inches
  HEIGHT: 7.5,    // inches
  MARGIN_X: 0.5,  // left/right margin
  FOOTER_H: 0.8,  // footer reserved height at bottom
};

/**
 * Shared layout constants as fractions of slide height.
 * Derived from PPTX inches so preview and PPTX are always in sync.
 */
export const LAYOUT = {
  topPad:    0.3 / 7.5,                        // ~4% from top
  footerH:   0.8 / 7.5,                        // ~10.7% footer
  textH:     3.5 / 7.5,                        // ~46.7% text block
  marginX:   0.5 / 13.33,                      // ~3.75% left/right
};

/**
 * Calculate the PPTX text box position based on margin-top percentage.
 *
 * - 0%   → text block top edge at the top of the usable area
 * - 50%  → text block vertically centered in usable area
 * - 100% → text block bottom edge at the bottom of usable area (just above footer)
 *
 * @param {number} marginPercent - 0 to 100
 * @param {number} textBlockHeight - height of the text box in inches
 * @returns {{x: number, y: number, w: number, h: number}} position/size in inches
 */
export function calcTextPosition(marginPercent, textBlockHeight) {
  const topPad = LAYOUT.topPad * PPTX.HEIGHT;
  const usableBottom = PPTX.HEIGHT - LAYOUT.footerH * PPTX.HEIGHT;
  const usableHeight = usableBottom - topPad;

  // Clamp text block height to usable area
  const h = Math.min(textBlockHeight, usableHeight);

  // The travel range: how far the top edge can move down
  const travel = usableHeight - h;

  // y = topPad + travel * (marginPercent / 100)
  const y = topPad + travel * (marginPercent / 100);

  return {
    x: PPTX.MARGIN_X,
    y: y,
    w: PPTX.WIDTH - 2 * PPTX.MARGIN_X,
    h: h,
  };
}

/**
 * Calculate the preview vertical offset as a fraction of slide height.
 *
 * Uses the same LAYOUT constants as calcTextPosition so preview and PPTX
 * are pixel-identical in proportion.
 *
 * @param {number} marginPercent - 0 to 100
 * @returns {{top: number, height: number}} fractions of slide height (0–1)
 *   top    — where the text block's top edge sits
 *   height — how tall the text block is (as fraction)
 */
export function calcPreviewOffset(marginPercent) {
  const usable = 1.0 - LAYOUT.topPad - LAYOUT.footerH;
  const textH = Math.min(LAYOUT.textH, usable);
  const travel = Math.max(0, usable - textH);

  const top = LAYOUT.topPad + travel * (marginPercent / 100);

  return { top, height: textH };
}

/**
 * Convert exported PPTX font size to the matching browser preview font size.
 *
 * PPTX font sizes are points; 72 points equals 1 inch. The preview slide is a
 * scaled version of the 13.33in x 7.5in PPTX canvas, so the correct browser
 * size is the physical font height scaled by the preview's pixels-per-inch.
 *
 * @param {number} fontSizePt - PPTX font size in points
 * @param {number} previewWidthPx - rendered preview slide width in CSS pixels
 * @param {number} previewHeightPx - rendered preview slide height in CSS pixels
 * @returns {number} CSS font size in pixels
 */
export function calcPreviewFontSize(fontSizePt, previewWidthPx, previewHeightPx) {
  const widthScale = previewWidthPx > 0 ? previewWidthPx / PPTX.WIDTH : 0;
  const heightScale = previewHeightPx > 0 ? previewHeightPx / PPTX.HEIGHT : 0;
  const pxPerInch = widthScale && heightScale ? Math.min(widthScale, heightScale) : widthScale || heightScale;

  if (!pxPerInch) return fontSizePt;

  return (fontSizePt / 72) * pxPerInch;
}
