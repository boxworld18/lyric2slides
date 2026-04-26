#!/usr/bin/env node

/**
 * fetch-lyrics.js — Fetch song lyrics from KKBOX using Patchright.
 *
 * Usage:
 *   node fetch-lyrics.js "歌曲名稱"
 *   node fetch-lyrics.js "歌曲名稱" --debug     # opens visible browser
 *   node fetch-lyrics.js "歌曲名稱" --no-copy   # don't copy to clipboard
 *
 * The tool:
 *   1. Searches KKBOX for the given song name
 *   2. Clicks the top search result
 *   3. Scrapes lyrics from the song page
 *   4. Copies lyrics to clipboard (and prints to stdout)
 */

import { chromium } from 'patchright';
import clipboard from 'clipboardy';

// ===== Config =====
const KKBOX_SEARCH_URL = 'https://www.kkbox.com/tw/tc/search';
const TIMEOUT = 30000;
const PAGE_WAIT = 3000;
const MAX_RETRIES = 3;

// ===== Main =====
async function main() {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`🔍 搜尋: ${query} (第 ${attempt}/${MAX_RETRIES} 次)`);

    const browser = await chromium.launch({
      headless: headless,
      proxy: {
        server: 'http://localhost:7897',
      },
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'zh-TW',
    });

    const page = await context.newPage();

    try {
      // Step 1: Search
      const searchUrl = `${KKBOX_SEARCH_URL}?q=${encodeURIComponent(query)}`;
      console.log(`📡 正在連線 KKBOX...`);

      await page.goto(searchUrl, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(PAGE_WAIT);

      // Step 2: Find song links in search results
      console.log(`📋 正在解析搜尋結果...`);

      let songLink = await findFirstSongLink(page);

      if (!songLink) {
        const songsTab = await page.$('text=歌曲');
        if (songsTab) {
          await songsTab.click();
          await page.waitForTimeout(PAGE_WAIT);
        }
        songLink = await findFirstSongLink(page);
        if (!songLink) {
          throw new Error('找不到搜尋結果。請確認歌曲名稱是否正確。');
        }
      }

      // Step 3: Navigate to song page
      const title = songLink.text;
      console.log(`🎵 找到: ${title}`);
      console.log(`📄 前往歌曲頁面...`);

      await page.goto(songLink.href, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(PAGE_WAIT);

      // Step 4: Extract lyrics
      const lyrics = await extractLyrics(page);

      if (!lyrics) {
        throw new Error('找不到歌詞。此歌曲可能沒有提供歌詞。');
      }

      // Step 5: Output
      console.log('\n' + '='.repeat(50));
      console.log(lyrics);
      console.log('='.repeat(50));

      if (!noCopy) {
        await clipboard.write(lyrics);
        console.log('\n✅ 歌詞已複製到剪貼簿！直接到網頁貼上即可。');
      } else {
        console.log('\n✅ 歌詞已顯示於上方。');
      }

      return; // success, exit retry loop

    } catch (err) {
      lastError = err;
      const isConnectionError = err.message.includes('ERR_CONNECTION') ||
                                 err.message.includes('ERR_NETWORK') ||
                                 err.message.includes('ERR_ABORTED') ||
                                 err.message.includes('Timeout');

      if (isConnectionError && attempt < MAX_RETRIES) {
        console.log(`⚠️  連線失敗，${attempt} 秒後重試...`);
        await new Promise(r => setTimeout(r, attempt * 1000));
      } else {
        console.error(`\n❌ 錯誤: ${err.message}`);

        if (debug) {
          console.log('\n⏳ Debug 模式：瀏覽器保持開啟 30 秒供檢查...');
          await page.screenshot({ path: '/tmp/kkbox-debug.png', fullPage: true });
          console.log('📸 截圖已儲存至 /tmp/kkbox-debug.png');
          await page.waitForTimeout(30000);
        }

        process.exit(1);
      }
    } finally {
      await browser.close();
    }
  }

  console.error(`\n❌ 重試 ${MAX_RETRIES} 次後仍然失敗: ${lastError.message}`);
  process.exit(1);
}

// ===== Main =====
async function main() {
  console.log(`🔍 搜尋: ${query}`);

  const browser = await chromium.launch({
    headless: headless, // Default: headed (false), KKBOX may block headless
    proxy: {
      server: 'http://localhost:7897',
    },
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'zh-TW',
  });

  const page = await context.newPage();

  try {
    // Step 1: Search
    const searchUrl = `${KKBOX_SEARCH_URL}?q=${encodeURIComponent(query)}`;
    console.log(`📡 正在連線 KKBOX...`);

    await page.goto(searchUrl, { timeout: TIMEOUT });
    await page.waitForTimeout(PAGE_WAIT);

    // Step 2: Find song links in search results
    // KKBOX search results contain links to song pages with /song/ in the URL
    console.log(`📋 正在解析搜尋結果...`);

    // Wait for search results to appear
    // Try multiple possible selectors for search results
    const songLink = await findFirstSongLink(page);

    if (!songLink) {
      // Try clicking on "Songs" tab if available
      const songsTab = await page.$('text=歌曲');
      if (songsTab) {
        await songsTab.click();
        await page.waitForTimeout(PAGE_WAIT);
      }
      const songLinkRetry = await findFirstSongLink(page);
      if (!songLinkRetry) {
        throw new Error('找不到搜尋結果。請確認歌曲名稱是否正確。');
      }
    }

    // Step 3: Navigate to song page
    const href = songLink.href;
    const title = songLink.text;
    console.log(`🎵 找到: ${title}`);
    console.log(`📄 前往歌曲頁面...`);

    await page.goto(href, { timeout: TIMEOUT });
    await page.waitForTimeout(PAGE_WAIT);

    // Step 4: Extract lyrics
    const lyrics = await extractLyrics(page);

    if (!lyrics) {
      throw new Error('找不到歌詞。此歌曲可能沒有提供歌詞。');
    }

    // Step 5: Output
    console.log('\n' + '='.repeat(50));
    console.log(lyrics);
    console.log('='.repeat(50));

    if (!noCopy) {
      await clipboard.write(lyrics);
      console.log('\n✅ 歌詞已複製到剪貼簿！直接到網頁貼上即可。');
    } else {
      console.log('\n✅ 歌詞已顯示於上方。');
    }

  } catch (err) {
    console.error(`\n❌ 錯誤: ${err.message}`);

    if (debug) {
      console.log('\n⏳ Debug 模式：瀏覽器保持開啟 30 秒供檢查...');
      await page.screenshot({ path: '/tmp/kkbox-debug.png', fullPage: true });
      console.log('📸 截圖已儲存至 /tmp/kkbox-debug.png');
      await page.waitForTimeout(30000);
    }

    process.exit(1);
  } finally {
    await browser.close();
  }
}

/**
 * Find the first song link in KKBOX search results.
 * Tries multiple selector strategies since KKBOX may change their markup.
 */
async function findFirstSongLink(page) {
  // Strategy 1: Look for links containing /song/ in href
  const songLinks = await page.$$eval('a[href*="/song/"]', links =>
    links.slice(0, 5).map(l => ({
      href: l.href,
      text: l.textContent.trim().substring(0, 100),
    }))
  );

  if (songLinks.length > 0) {
    return songLinks[0];
  }

  // Strategy 2: Look for links in search result containers
  const resultLinks = await page.$$eval(
    '[class*="search"] a, [class*="result"] a, [class*="track"] a, [class*="song-item"] a',
    links => links
      .filter(l => l.href && l.href.includes('kkbox.com'))
      .slice(0, 5)
      .map(l => ({ href: l.href, text: l.textContent.trim().substring(0, 100) }))
  );

  if (resultLinks.length > 0) {
    return resultLinks[0];
  }

  // Strategy 3: Look for any clickable song-like element
  const clickables = await page.$$eval('a', links =>
    links
      .filter(l => {
        const href = l.href || '';
        const text = l.textContent || '';
        return (href.includes('/song') || href.includes('/track')) && text.length > 0 && text.length < 200;
      })
      .slice(0, 5)
      .map(l => ({ href: l.href, text: l.textContent.trim().substring(0, 100) }))
  );

  return clickables.length > 0 ? clickables[0] : null;
}

/**
 * Extract lyrics from a KKBOX song page.
 * Tries multiple selector strategies.
 */
async function extractLyrics(page) {
  // Strategy 1: Look for elements with "lyric" in class name
  const lyricSelectors = [
    '[class*="lyric" i]',
    '[class*="Lyric"]',
    '[class*="lyrics" i]',
    '[data-testid*="lyric" i]',
    '[class*="song-description"]',
    '[class*="song_description"]',
  ];

  for (const sel of lyricSelectors) {
    try {
      const els = await page.$$(sel);
      for (const el of els) {
        const text = await el.textContent();
        const cleaned = cleanLyrics(text);
        if (cleaned && cleaned.length > 20) {
          return cleaned;
        }
      }
    } catch {
      // Selector not found, try next
    }
  }

  // Strategy 2: Look for <p> elements with multiple newlines (lyrics pattern)
  try {
    const pTexts = await page.$$eval('p', els =>
      els
        .map(e => e.innerText.trim())
        .filter(t => t.includes('\n') && t.length > 30)
        .sort((a, b) => b.length - a.length)
    );
    if (pTexts.length > 0) {
      return cleanLyrics(pTexts[0]);
    }
  } catch {
    // No match
  }

  // Strategy 3: Look for <pre> tags
  try {
    const preTexts = await page.$$eval('pre', els =>
      els.map(e => e.innerText.trim()).filter(t => t.length > 30)
    );
    if (preTexts.length > 0) {
      return cleanLyrics(preTexts[0]);
    }
  } catch {
    // No match
  }

  // Strategy 4: Try to find the lyrics by looking for a "展開" (expand) button
  try {
    const expandBtn = await page.$('text=展開');
    if (expandBtn) {
      await expandBtn.click();
      await page.waitForTimeout(1000);
      // Retry strategy 1 after expanding
      for (const sel of lyricSelectors) {
        try {
          const els = await page.$$(sel);
          for (const el of els) {
            const text = await el.textContent();
            const cleaned = cleanLyrics(text);
            if (cleaned && cleaned.length > 20) {
              return cleaned;
            }
          }
        } catch {
          // continue
        }
      }
    }
  } catch {
    // No expand button
  }

  return null;
}

/**
 * Clean up lyrics text — remove excess whitespace, credits, and trim lines.
 */
function cleanLyrics(text) {
  if (!text) return '';

  let lines = text.split('\n').map(line => line.trim());

  // Remove credit lines at the top (作詞, 作曲, 編曲, 監製, etc.)
  const creditPattern = /^(作詞|作曲|編曲|監製|填詞|Lyrics|Composer|Arranger|Producer)\s*[：:／/]/i;
  while (lines.length > 0 && (lines[0] === '' || creditPattern.test(lines[0]))) {
    lines.shift();
  }

  // Remove consecutive blank lines (keep at most one)
  lines = lines.filter((line, i, arr) => {
    if (line === '' && i > 0 && arr[i - 1] === '') return false;
    return true;
  });

  return lines.join('\n').trim();
}

// ===== Run =====
main();
