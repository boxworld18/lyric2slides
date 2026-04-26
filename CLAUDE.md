# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Lyric2Slides converts song lyrics into PowerPoint (.pptx) slides. It's a Traditional Chinese (繁體中文) web app built for singing competitions where audiences follow along on-screen. Users paste lyrics, configure styling, preview slides, and download a PPTX file.

## Commands

```bash
npm start          # Start local server on port 8080 (or --port N)
npm test           # Run vitest tests (logic.test.js)
npx vitest run -t "test name"  # Run a single test by name
```

The server requires `PEXELS_KEY` in `.env` for the AI background image suggestion feature.

## Architecture

**No build step.** The app is a single `index.html` with embedded CSS/JS, served by a lightweight Node HTTP server.

### Key Files

- **`index.html`** — The entire frontend: UI, slide preview, PPTX generation (via PptxGenJS from CDN), and AI background image selection. Contains a duplicate of `parseSlides` and layout logic from `logic.js` (the HTML version is the runtime copy; `logic.js` is the testable extract).
- **`logic.js`** — Pure functions extracted for unit testing: `parseSlides`, `calcTextPosition`, `calcPreviewOffset`, `calcPreviewFontSize`, `calcCoverCropSourceRect`, and shared layout constants (`LAYOUT`, `PPTX`).
- **`server.js`** — Node HTTP server that serves static files and provides two API endpoints:
  - `POST /api/suggest-bg` — Extracts Chinese imagery words from lyrics, maps them to English search terms, queries Pexels API
  - `GET /api/proxy-image?url=` — CORS proxy for fetching Pexels images client-side
- **`fetch-lyrics.js`** — Standalone CLI tool that scrapes KKBOX for lyrics using Patchright (browser automation). Not part of the web app; uses a local proxy at `localhost:7897`.

### Critical Invariant: Preview/PPTX Alignment

The HTML preview and the exported PPTX must produce visually identical slide layouts. Both derive positions from the shared `LAYOUT` constants (fractions of slide height). The test suite (`logic.test.js`) explicitly verifies that `calcPreviewOffset` and `calcTextPosition` produce matching proportional values across all margin percentages. When changing any layout math, run tests and visually verify both preview and exported PPTX.

### Lyrics Parsing

`parseSlides(text, maxLines, blankLineEmpty)` — blank lines in lyrics create slide breaks; continuous text auto-chunks by `maxLines`. Groups exceeding `maxLines` get sub-split evenly. When `blankLineEmpty` is true, blank lines also generate empty slides (for interludes). Leading/trailing empty slides are trimmed.

### PPTX Generation

Uses PptxGenJS (loaded from CDN in `index.html`). Slide masters handle background images and footer; lyrics are added per-slide. Background images are cropped client-side to 1920x1080 via canvas before embedding. The cover slide is optional and contains song metadata.

## Interface Language

All UI strings are in Traditional Chinese. Variable names and code comments are in English.
