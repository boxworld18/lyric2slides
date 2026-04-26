import { describe, it, expect } from 'vitest';
import { calcTextPosition, calcPreviewOffset, calcPreviewFontSize, PPTX, LAYOUT, parseSlides } from './logic.js';

// =============================================================================
// calcTextPosition — PPTX margin-from-top
// =============================================================================
describe('calcTextPosition', () => {
  const textH = 3.5; // default text block height matching LAYOUT.textH * 7.5

  it('at 0% the text block top edge is at the top of usable area', () => {
    const pos = calcTextPosition(0, textH);
    expect(pos.y).toBeCloseTo(LAYOUT.topPad * PPTX.HEIGHT, 2);
  });

  it('at 100% the text block bottom edge is just above the footer', () => {
    const pos = calcTextPosition(100, textH);
    const bottomEdge = pos.y + pos.h;
    const footerTop = PPTX.HEIGHT * (1 - LAYOUT.footerH);
    expect(bottomEdge).toBeCloseTo(footerTop, 1);
  });

  it('at 50% the text block is vertically centered in usable area', () => {
    const pos = calcTextPosition(50, textH);
    const usableTop = LAYOUT.topPad * PPTX.HEIGHT;
    const usableBottom = PPTX.HEIGHT * (1 - LAYOUT.footerH);
    const usableCenter = (usableTop + usableBottom) / 2;
    const blockCenter = pos.y + pos.h / 2;
    expect(blockCenter).toBeCloseTo(usableCenter, 1);
  });

  it('y increases monotonically from 0% to 100%', () => {
    let prevY = -Infinity;
    for (let pct = 0; pct <= 100; pct += 10) {
      const pos = calcTextPosition(pct, textH);
      expect(pos.y).toBeGreaterThanOrEqual(prevY);
      prevY = pos.y;
    }
  });

  it('text block never exceeds the usable area', () => {
    const topLimit = LAYOUT.topPad * PPTX.HEIGHT;
    const bottomLimit = PPTX.HEIGHT * (1 - LAYOUT.footerH);
    for (let pct = 0; pct <= 100; pct += 5) {
      const pos = calcTextPosition(pct, textH);
      expect(pos.y).toBeGreaterThanOrEqual(topLimit - 0.01);
      expect(pos.y + pos.h).toBeLessThanOrEqual(bottomLimit + 0.01);
    }
  });

  it('width spans slide minus left/right margins', () => {
    const pos = calcTextPosition(50, textH);
    expect(pos.w).toBeCloseTo(PPTX.WIDTH - 2 * PPTX.MARGIN_X, 1);
  });

  it('handles text block taller than usable area by clamping', () => {
    const hugeH = 20;
    const pos = calcTextPosition(50, hugeH);
    const usableHeight = PPTX.HEIGHT * (1 - LAYOUT.topPad - LAYOUT.footerH);
    expect(pos.h).toBeCloseTo(usableHeight, 1);
    expect(pos.y).toBeCloseTo(LAYOUT.topPad * PPTX.HEIGHT, 1);
  });

  it('0% and 100% produce different y values for normal text block', () => {
    const top = calcTextPosition(0, textH);
    const bottom = calcTextPosition(100, textH);
    expect(bottom.y).toBeGreaterThan(top.y);
  });
});

// =============================================================================
// calcPreviewOffset — browser preview margin
// =============================================================================
describe('calcPreviewOffset', () => {
  it('at 0% top equals topPad fraction', () => {
    const result = calcPreviewOffset(0);
    expect(result.top).toBeCloseTo(LAYOUT.topPad, 3);
  });

  it('at 100% bottom edge of text block is just above footer', () => {
    const result = calcPreviewOffset(100);
    const bottomEdge = result.top + result.height;
    expect(bottomEdge).toBeCloseTo(1.0 - LAYOUT.footerH, 2);
  });

  it('at 50% text block is centered in usable area', () => {
    const result = calcPreviewOffset(50);
    const usableCenter = (LAYOUT.topPad + (1 - LAYOUT.footerH)) / 2;
    const blockCenter = result.top + result.height / 2;
    expect(blockCenter).toBeCloseTo(usableCenter, 2);
  });

  it('top increases monotonically', () => {
    let prev = -Infinity;
    for (let pct = 0; pct <= 100; pct += 10) {
      const result = calcPreviewOffset(pct);
      expect(result.top).toBeGreaterThanOrEqual(prev);
      prev = result.top;
    }
  });

  it('never returns negative top', () => {
    const result = calcPreviewOffset(0);
    expect(result.top).toBeGreaterThanOrEqual(0);
  });

  it('height matches LAYOUT.textH', () => {
    const result = calcPreviewOffset(50);
    expect(result.height).toBeCloseTo(LAYOUT.textH, 3);
  });
});

// =============================================================================
// CRITICAL: Preview and PPTX produce identical proportional positions
// =============================================================================
describe('preview/PPTX alignment', () => {
  it('preview top fraction matches PPTX y fraction for all margin values', () => {
    const pptxTextH = LAYOUT.textH * PPTX.HEIGHT; // inches
    for (let pct = 0; pct <= 100; pct += 5) {
      const pptx = calcTextPosition(pct, pptxTextH);
      const preview = calcPreviewOffset(pct);

      // PPTX y as fraction of slide height
      const pptxFraction = pptx.y / PPTX.HEIGHT;

      expect(preview.top).toBeCloseTo(pptxFraction, 3,
        `Mismatch at ${pct}%: preview top=${preview.top}, pptx fraction=${pptxFraction}`
      );
    }
  });

  it('preview text height fraction matches PPTX text height fraction', () => {
    const pptxTextH = LAYOUT.textH * PPTX.HEIGHT;
    const pptx = calcTextPosition(50, pptxTextH);
    const preview = calcPreviewOffset(50);

    const pptxHeightFraction = pptx.h / PPTX.HEIGHT;
    expect(preview.height).toBeCloseTo(pptxHeightFraction, 3);
  });

  it('at 0% both place text at same proportional top', () => {
    const pptxTextH = LAYOUT.textH * PPTX.HEIGHT;
    const pptx = calcTextPosition(0, pptxTextH);
    const preview = calcPreviewOffset(0);
    expect(preview.top).toBeCloseTo(pptx.y / PPTX.HEIGHT, 3);
  });

  it('at 100% both place text bottom at same proportional position', () => {
    const pptxTextH = LAYOUT.textH * PPTX.HEIGHT;
    const pptx = calcTextPosition(100, pptxTextH);
    const preview = calcPreviewOffset(100);

    const pptxBottom = (pptx.y + pptx.h) / PPTX.HEIGHT;
    const previewBottom = preview.top + preview.height;
    expect(previewBottom).toBeCloseTo(pptxBottom, 3);
  });
});

// =============================================================================
// calcPreviewFontSize — PPTX points to browser pixels
// =============================================================================
describe('calcPreviewFontSize', () => {
  it('scales a PPTX font size to the rendered preview width', () => {
    const result = calcPreviewFontSize(54, 640, 360);
    expect(result).toBeCloseTo((54 / 72) * Math.min(640 / PPTX.WIDTH, 360 / PPTX.HEIGHT), 2);
  });

  it('uses the smaller scale if width and height are slightly inconsistent', () => {
    const result = calcPreviewFontSize(36, 640, 300);
    expect(result).toBeCloseTo((36 / 72) * (300 / PPTX.HEIGHT), 2);
  });

  it('falls back to the point value when preview dimensions are unavailable', () => {
    expect(calcPreviewFontSize(40, 0, 0)).toBe(40);
  });
});

// =============================================================================
// parseSlides
// =============================================================================
describe('parseSlides', () => {
  it('splits by blank lines', () => {
    const text = 'line1\nline2\n\nline3\nline4';
    const slides = parseSlides(text, 4, false);
    expect(slides).toHaveLength(2);
    expect(slides[0].lines).toEqual(['line1', 'line2']);
    expect(slides[1].lines).toEqual(['line3', 'line4']);
  });

  it('auto-splits by maxLines when no blank lines', () => {
    const text = 'a\nb\nc\nd\ne\nf\ng\nh';
    const slides = parseSlides(text, 3, false);
    expect(slides).toHaveLength(3);
    expect(slides[0].lines).toEqual(['a', 'b', 'c']);
    expect(slides[1].lines).toEqual(['d', 'e', 'f']);
    expect(slides[2].lines).toEqual(['g', 'h']);
  });

  it('respects custom maxLines value', () => {
    const text = 'a\nb\nc\nd\ne\nf';
    const slides2 = parseSlides(text, 2, false);
    expect(slides2).toHaveLength(3);
    expect(slides2[0].lines).toEqual(['a', 'b']);

    const slides6 = parseSlides(text, 6, false);
    expect(slides6).toHaveLength(1);
    expect(slides6[0].lines).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('produces empty slides for blank lines when blankLineEmpty=true', () => {
    const text = 'verse1\n\nverse2';
    const slides = parseSlides(text, 4, true);
    expect(slides).toHaveLength(3);
    expect(slides[0].lines).toEqual(['verse1']);
    expect(slides[1].isEmpty).toBe(true);
    expect(slides[1].lines).toEqual([]);
    expect(slides[2].lines).toEqual(['verse2']);
  });

  it('does NOT produce empty slides for blank lines when blankLineEmpty=false', () => {
    const text = 'verse1\n\nverse2';
    const slides = parseSlides(text, 4, false);
    expect(slides).toHaveLength(2);
    expect(slides.every(s => !s.isEmpty)).toBe(true);
  });

  it('trims leading/trailing empty slides', () => {
    const text = '\n\nverse1\n\nverse2\n\n';
    const slides = parseSlides(text, 4, true);
    expect(slides[0].isEmpty).toBe(false);
    expect(slides[slides.length - 1].isEmpty).toBe(false);
  });

  it('sub-splits groups that exceed maxLines', () => {
    const text = 'a\nb\nc\nd\ne\nf\n\ng\nh';
    const slides = parseSlides(text, 3, false);
    expect(slides).toHaveLength(3);
    expect(slides[0].lines).toHaveLength(3);
    expect(slides[1].lines).toHaveLength(3);
    expect(slides[2].lines).toEqual(['g', 'h']);
  });

  it('handles single line', () => {
    const slides = parseSlides('hello', 4, false);
    expect(slides).toHaveLength(1);
    expect(slides[0].lines).toEqual(['hello']);
  });

  it('trims whitespace from lines', () => {
    const text = '  hello  \n  world  ';
    const slides = parseSlides(text, 4, false);
    expect(slides[0].lines).toEqual(['hello', 'world']);
  });
});
