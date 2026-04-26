#!/usr/bin/env node

/**
 * server.js — Local server for Lyric2Slides.
 *
 * Serves the static web app and provides API endpoints for
 * background image suggestions via Pexels.
 *
 * Usage:
 *   node server.js              # start on port 8080
 *   node server.js --port 3000  # custom port
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== Config =====
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const PORT = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 8080;
const PEXELS_KEY = process.env.PEXELS_KEY;

// ===== MIME types =====
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

// ===== Helpers =====

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers }, (res) => {
      // Follow redirects
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(data));
}

// ===== Keyword Extraction =====
const IMAGERY_WORDS = new Set([
  '月','月亮','太阳','星','星星','天空','夜','夜空','海','海洋','河','河流',
  '山','花','雨','雪','风','云','雾','彩虹','日落','日出','黄昏','黎明',
  '森林','树','草','路','桥','城市','街','灯','火','冰','水','湖',
  '沙漠','岛','秋','春','夏','冬','阳光','星光','月光','晚霞','朝霞',
  '海边','沙滩','天堂','玫瑰','樱花','梅花','荷花','落叶',
  '烟火','烟花','蝴蝶','飞鸟','鸟','鱼','窗','门','船','车站',
  '教堂','城堡','田野','草原','荒野','高山','深海',
  '落日','晚风','夕阳','繁星','银河','极光','彩霞',
]);

// Map Chinese imagery words to good English search terms for Pexels
const IMAGERY_EN = {
  '月': 'moon', '月亮': 'moon night', '太阳': 'sun', '星': 'stars', '星星': 'starry sky',
  '天空': 'sky', '夜': 'night', '夜空': 'night sky', '海': 'ocean', '海洋': 'ocean waves',
  '河': 'river', '河流': 'river landscape', '山': 'mountain', '花': 'flowers',
  '雨': 'rain', '雪': 'snow', '风': 'wind field', '云': 'clouds', '雾': 'fog mist',
  '彩虹': 'rainbow', '日落': 'sunset', '日出': 'sunrise', '黄昏': 'dusk twilight',
  '黎明': 'dawn', '森林': 'forest', '树': 'tree', '草': 'grass meadow',
  '路': 'road path', '桥': 'bridge', '城市': 'city night', '街': 'street',
  '灯': 'lights bokeh', '火': 'fire flames', '冰': 'ice crystal', '水': 'water',
  '湖': 'lake calm', '沙漠': 'desert sand', '岛': 'island tropical',
  '秋': 'autumn leaves', '春': 'spring blossom', '夏': 'summer sunshine', '冬': 'winter snow',
  '阳光': 'sunlight rays', '星光': 'starlight', '月光': 'moonlight',
  '晚霞': 'sunset glow', '朝霞': 'sunrise glow',
  '海边': 'seaside beach', '沙滩': 'sandy beach', '天堂': 'heaven clouds',
  '玫瑰': 'rose flower', '樱花': 'cherry blossom', '梅花': 'plum blossom', '荷花': 'lotus flower',
  '落叶': 'fallen leaves', '烟火': 'fireworks', '烟花': 'fireworks night',
  '蝴蝶': 'butterfly', '飞鸟': 'birds flying', '鸟': 'bird', '鱼': 'fish underwater',
  '窗': 'window light', '门': 'doorway', '船': 'boat sea', '车站': 'train station',
  '教堂': 'church', '城堡': 'castle', '田野': 'countryside field', '草原': 'prairie grassland',
  '荒野': 'wilderness', '高山': 'high mountain', '深海': 'deep ocean',
  '落日': 'setting sun', '晚风': 'evening breeze field', '夕阳': 'sunset silhouette',
  '繁星': 'starry night', '银河': 'milky way', '极光': 'aurora borealis', '彩霞': 'colorful clouds',
};

function extractImageryFromText(text) {
  const found = [];
  for (const word of IMAGERY_WORDS) {
    if (text.includes(word)) found.push(word);
  }
  return found.filter(w => !found.some(o => o !== w && o.includes(w) && o.length > w.length));
}

function buildPexelsQuery(title, lyrics) {
  const candidates = [];
  if (title) candidates.push(...extractImageryFromText(title));
  if (lyrics) {
    const lines = lyrics.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 6)) {
      candidates.push(...extractImageryFromText(line));
    }
  }
  const unique = [...new Set(candidates)];

  // Convert to English for Pexels (much better results)
  const enTerms = unique.map(w => IMAGERY_EN[w] || w).slice(0, 3);

  if (enTerms.length > 0) return { query: enTerms.join(' '), zhHint: unique.join(' ') };

  // Fallback: use title or generic
  if (title) return { query: title, zhHint: title };
  return { query: 'beautiful landscape dark', zhHint: '風景' };
}

// ===== API: Suggest Background Images (Pexels) =====
async function handleSuggestBg(req, res) {
  try {
    const rawBody = await readBody(req);
    const { lyrics, title } = JSON.parse(rawBody);

    if (!lyrics && !title) {
      return sendJSON(res, 400, { error: '請提供歌詞或歌曲名稱' });
    }
    if (!PEXELS_KEY) {
      return sendJSON(res, 500, { error: '未設定 PEXELS_KEY，無法使用背景推薦' });
    }

    const { query, zhHint } = buildPexelsQuery(title, lyrics);
    console.log(`🔍 Pexels 搜圖: "${query}" (意象: ${zhHint})`);

    const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`;
    const pexelsRes = await httpsGet(pexelsUrl, { Authorization: PEXELS_KEY });

    if (pexelsRes.statusCode !== 200) {
      console.error('Pexels API error:', pexelsRes.statusCode, pexelsRes.body.toString().slice(0, 200));
      return sendJSON(res, 502, { error: 'Pexels API 錯誤' });
    }

    const data = JSON.parse(pexelsRes.body.toString('utf-8'));
    const images = (data.photos || []).map(p => ({
      url: p.src.landscape,       // 1200x627, good for slides
      urlFull: p.src.original,    // full resolution for PPTX
      urlMedium: p.src.medium,    // medium for preview
      caption: p.alt || '',
      width: p.width,
      height: p.height,
      photographer: p.photographer || '',
    }));

    return sendJSON(res, 200, { images, query, zhHint });
  } catch (err) {
    console.error('handleSuggestBg error:', err);
    return sendJSON(res, 500, { error: '伺服器內部錯誤：' + err.message });
  }
}

// ===== API: Proxy Image (avoid CORS) =====
async function handleProxyImage(req, res) {
  try {
    const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
    const imageUrl = reqUrl.searchParams.get('url');

    if (!imageUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Missing url parameter');
    }

    const imgRes = await httpsGet(imageUrl, {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'image/*,*/*',
    });

    if (imgRes.statusCode !== 200) {
      res.writeHead(imgRes.statusCode, { 'Content-Type': 'text/plain' });
      return res.end('Failed to fetch image: HTTP ' + imgRes.statusCode);
    }

    res.writeHead(200, {
      'Content-Type': imgRes.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(imgRes.body);
  } catch (err) {
    console.error('handleProxyImage error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy error: ' + err.message);
  }
}

// ===== HTTP Server =====
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/suggest-bg' && req.method === 'POST') {
    return handleSuggestBg(req, res);
  }
  if (url.pathname === '/api/proxy-image' && req.method === 'GET') {
    return handleProxyImage(req, res);
  }

  // Static files
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  const ext = path.extname(filePath);

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`🎤 Lyric2Slides 伺服器已啟動`);
  console.log(`   網頁: http://localhost:${PORT}`);
  console.log(`   API:  Pexels 搜圖 + 圖片代理`);
  console.log(`\n   按 Ctrl+C 停止伺服器`);
});
