# Lyric2Slides — 歌詞轉投影片

將歌詞貼上、調整樣式，一鍵產生 PowerPoint (.pptx) 投影片。專為歌唱活動設計，讓觀眾能即時跟唱。

## 功能

- 貼上歌詞，自動依空行或行數分頁
- 即時 16:9 投影片預覽
- 自訂字體、字級、文字顏色、背景顏色
- 上傳背景圖片或由 AI 根據歌詞意象推薦（Pexels）
- 文字外發光效果，在背景圖上更清晰
- 可選首頁投影片，顯示歌名、演唱者、作詞、作曲
- 空行可產生空白頁（間奏用）
- 下載 .pptx，直接用於簡報軟體

## 快速開始

```bash
git clone https://github.com/boxworld18/lyric2slides && cd lyric2slides
npm install
```

如需 AI 背景推薦功能，建立 `.env` 並填入 Pexels API Key：

```bash
cp .env.example .env
# 編輯 .env，填入 PEXELS_KEY
```

啟動伺服器：

```bash
npm start
# 開啟 http://localhost:8080
```

## 歌詞擷取工具

`fetch-lyrics.js` 是獨立的 CLI 工具，可從 KKBOX 搜尋並擷取歌詞到剪貼簿：

```bash
node fetch-lyrics.js "月亮代表我的心"
node fetch-lyrics.js "歌曲名稱" --debug     # 開啟可見瀏覽器
node fetch-lyrics.js "歌曲名稱" --no-copy   # 不複製到剪貼簿
```

需要 [Patchright](https://github.com/nicecai/patchright) 及本機代理（預設 `localhost:7897`）。

## 授權

ISC
