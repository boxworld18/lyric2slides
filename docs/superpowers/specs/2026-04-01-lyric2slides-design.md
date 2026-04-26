# Lyric2Slides Design Spec

**Date:** 2026-04-01
**Project:** 歌詞轉投影片 (Lyric-to-Slides Converter)

## Purpose

A web-based tool for converting song lyrics into downloadable PowerPoint (.pptx) slides. Designed for a singing competition where the audience needs to follow along. Each slide contains 3-4 lines of lyrics, centered text, a background image sourced from Unsplash, and song/singer metadata at the bottom.

## Architecture

Single static HTML page (`index.html`) with embedded CSS and JavaScript. No build tools, no backend. Hosted on GitHub Pages.

### External Libraries (CDN)

- **PptxGenJS** — client-side PPTX generation (jsDelivr CDN)

### External APIs

- **Unsplash Source** — background image search (source.unsplash.com, no API key needed)

## UI Layout

Two-panel layout (left: input, right: preview). Stacks vertically on mobile.

### Left Panel: Input & Settings

1. Song Title input — used in slide footer and Unsplash keywords
2. Singer/Performer input — displayed in slide footer
3. Lyrics Textarea — blank lines = slide breaks; otherwise auto-split every 4 lines
4. Style Controls: font size (24/32/40/48pt), text color, background color
5. Background Image: Unsplash keyword search, thumbnail preview, enable/disable toggle
6. Action Buttons: Preview + Download PPTX

### Right Panel: Slide Preview

- 16:9 preview with background + overlay + centered lyrics + bottom footer
- Prev/next navigation + page indicator

## Lyrics Parsing

- Split by blank lines if present; otherwise chunk every 4 lines
- Groups exceeding 4 lines get sub-split evenly

## Slide Structure

- Background: solid color or image with ~40% dark overlay
- Lyrics: centered, chosen font size, line spacing ~1.8x
- Footer: "{song title} — {singer}", 14pt, bottom-center

## File Structure

```
lyric2slides/
├── index.html    # Entire application
└── docs/         # Design specs
```

## Scope Boundaries

In scope: paste lyrics, split, preview, download PPTX, style customization, Unsplash background, footer metadata.

Out of scope: user accounts, session persistence, multi-song, LRC, animations, drag-reorder, PDF/Google Slides output.

## Interface Language

Traditional Chinese (繁體中文).

## Deployment

GitHub Pages on `main` branch.
