# LINE OA 廣告成效戰情特助 (LINE Meta Ads Intelligence Bot)

> 專為行銷團隊、廣告優化師與企業管理層打造的 **LINE 官方帳號 Meta Ads 智慧監控與分析特助**。  
> 整合 **Meta Marketing API (v20.0)**、**Google Gemini 2.5 Flash Function Calling Agent** 與 **LINE Messaging API (Flex Message 3.0)**，在手機聊天室實現「全自動定時推播」、「素材疲勞風控預警」與「自然語言即時數據調閱」。

---

## 📑 目錄
- [🌟 核心價值與應用場景](#-核心價值與應用場景)
- [🏗️ 系統架構與運作邏輯](#️-系統架構與運作邏輯)
  - [1. 雙軌成效指標體系 (Dual-Mode Reporting)](#1-雙軌成效指標體系-dual-mode-reporting)
  - [2. 素材疲勞風控算法 (Fatigue Detection)](#2-素材疲勞風控算法-fatigue-detection)
  - [3. 防重複推播與冷卻鎖機制 (In-flight Mutex & Cooldown)](#3-防重複推播與冷卻鎖機制-in-flight-mutex--cooldown)
  - [4. AI 對話式特助大腦 (Gemini 2.5 Flash + Tool Calling)](#4-ai-對話式特助大腦-gemini-25-flash--tool-calling)
  - [5. 高解析度 6 格大字版圖文選單 (Dynamic Rich Menu)](#5-高解析度-6-格大字版圖文選單-dynamic-rich-menu)
  - [6. 全時雲端保活機制 (Self-Heartbeat KeepAlive)](#6-全時雲端保活機制-self-heartbeat-keepalive)
- [🔒 資訊安全與機密隔離規範 (Security & Privacy)](#-資訊安全與機密隔離規範-security--privacy)
- [🚀 快速開始與部署指引 (Quick Start & Deployment)](#-快速開始與部署指引-quick-start--deployment)
  - [環境需求](#環境需求)
  - [步驟 1：申請並配置第三方憑證](#步驟-1申請並配置第三方憑證)
  - [步驟 2：配置環境變數 (.env)](#步驟-2配置環境變數-env)
  - [步驟 3：本地端開發與測試 (Local Dev with ngrok)](#步驟-3本地端開發與測試-local-dev-with-ngrok)
  - [步驟 4：雲端一鍵部署 (Render / Docker)](#步驟-4雲端一鍵部署-render--docker)
- [🛠️ API 端點與指令清單 (Endpoints & Commands)](#️-api-端點與指令清單-endpoints--commands)

---

## 🌟 核心價值與應用場景

1. **擺脫臃腫後台**：不再需要打開載入緩慢的 Meta Ads Manager，隨時隨地在手機 LINE 上一鍵查大盤、看週報、比對各廣告組合與素材成效。
2. **零額外訊息費用**：
   - 使用者主動點選圖文選單或發問，機器人回覆訊息（Reply Message）**完全免費且無上限**。
   - 每日定時推播晨報與晚報（Push Message）鎖定管理員或內部專案群組，每月推播用量低於 100 則，**完全落在 LINE 官方提供的「每月 200 則免費額度」內**。
3. **跨專案多帳號切換**：支援即時動態比對切換廣告帳號（包含電商、生鮮、醫美、生活用品、公益團體等），跨產業數據切換自如。

---

## 🏗️ 系統架構與運作邏輯

### 1. 雙軌成效指標體系 (Dual-Mode Reporting)
不同商業模式的行銷漏斗關注的指標截然不同，系統自動依據帳號類型切換分析維度：
* **電商／營收導向型帳號**：
  - 核心指標：**花費 (Spend)**、**ROAS (廣告投資報酬率)**、**客單價 (AOV)**、**購買轉換數 (Purchases)**。
  - 適用品牌：電商零售、品牌官網、CPAS 協同廣告。
* **醫美／潛在顧客／互動型帳號**：
  - 核心指標：**花費 (Spend)**、**單則訊息開啟成本 (Cost per Messaging Connection)**、**有效諮詢數 (Messaging Conversations)**、**名單成本 (CPA)**、**點擊率 (CTR)**。
  - 自動防呆：針對導訊目標廣告，不再計算無意義的 ROAS，改以獲客與諮詢成本為決策核心。

### 2. 素材疲勞風控算法 (Fatigue Detection)
比對「近 3 天即時表現」與「過去 7 天基準線」，嚴格執行**「三選二」**疲勞判定邏輯：
1. **頻率飆高**：曝光頻率 Frequency > 4.0。
2. **點擊意願驟降**：CTR 跌幅超過基準線 15% 以上。
3. **轉換成本失控**：CPA / 單則訊息成本漲幅超過基準線 20% 以上。
> 滿足兩項即判定為素材疲勞，自動標籤為 `⚡ 警示` 並發送紅色高對比警告卡片，建議行銷團隊更換新素材或調降預算。

### 3. 防重複推播與冷卻鎖機制 (In-flight Mutex & Cooldown)
為了解決雲端 PaaS 平台（如 Render）在定時排程喚醒或重啟時可能造成的重複 Webhook 請求，系統設計了雙重防護：
* **In-Flight Lock**：程式內置執行中狀態鎖，防止同時間多個請求並行。
* **30 分鐘冷卻保護 (30-Minute Cooldown)**：記錄上次成功推播的精準時間戳，若 30 分鐘內收到重複觸發訊號，自動攔截並略過，確保管理員絕不被雙重通知轟炸。

### 4. AI 對話式特助大腦 (Gemini 2.5 Flash + Tool Calling)
* 採用 Google 最新 `gemini-2.5-flash` 模型，具備毫秒級推理與結構化 Function Calling 能力。
* 當用戶在聊天室發問非制式問題（例如：*「哪一個廣告組表現比較差？」*、*「某某受眾的名單成本多少？」*），特助會自主拆解問題，調用 Meta Ads 專屬查詢工具撈取真實數據後，進行客觀分析與建議。

### 5. 高解析度 6 格大字版圖文選單 (Dynamic Rich Menu)
* 設計規格：2500 × 1686 像素超高解析度。
* 手機閱讀優化：核心大標題字體加大至 **122px ~ 136px**（相比標準版放大 120% 以上），消除未定義字型導致的方框破圖 `[]`，在窄螢幕手機上無需縮放即可清晰閱讀。
* 提供一鍵部署腳本（`npm run setup-richmenu`），自動建構 Rich Menu 區域結構、上傳背景並綁定預設值。

### 6. 全時雲端保活機制 (Self-Heartbeat KeepAlive)
* 免費或隨選型雲端主機（如 Render Free Plan）常在 15 分鐘無流量時自動休眠。
* 伺服器啟動後自動註冊每 10 分鐘一次的自我輕量心跳檢測（`GET /ping`），確保主機 24 小時長駐，訊息秒回不卡頓。

---

## 🔒 資訊安全與機密隔離規範 (Security & Privacy)

本專案恪遵最高資安防護與零機密外洩標準：

1. **嚴禁將任何金鑰納入 Git 版本控制**：
   - 專案根目錄 `.gitignore` 已嚴格隔離 `.env`、`.env.*`、憑證證書（`*.pem`, `*.key`）與日誌檔案。
   - 所有外部服務金鑰（LINE Token、Meta Token、Gemini API Key）僅能透過執行環境注入，倉庫內僅提供範本檔 `.env.example`。
2. **Meta Token 最小授權原則 (Principle of Least Privilege)**：
   - 建議於 Meta for Developers 建立專用 **System User (系統用戶)**。
   - 僅需勾選 **`ads_read`**（讀取廣告數據）與 **`read_insights`** 權限。
   - **嚴禁** 授予 `ads_management` 或付款帳號編輯權限，確保即便 Token 外洩也具備唯讀防護。
3. **客戶資訊去識別化**：
   - 程式內部動態透過 `MetaService.listAccessibleAccounts()` 讀取 Token 所授權之帳號清單，避免在公開代碼中硬編碼真實客戶機密。

---

## 🚀 快速開始與部署指引 (Quick Start & Deployment)

### 環境需求
* Node.js >= 18.0.0
* npm >= 9.0.0
* Python 3（可選，僅用於重新客製化產生圖文選單圖檔）

### 步驟 1：申請並配置第三方憑證

| 服務項目 | 申請入口 | 必備金鑰參數 |
| :--- | :--- | :--- |
| **LINE Messaging API** | [LINE Developers Console](https://developers.line.biz/) | `LINE_CHANNEL_SECRET`<br>`LINE_CHANNEL_ACCESS_TOKEN`<br>`ADMIN_LINE_USER_ID` |
| **Meta Marketing API** | [Meta for Developers](https://developers.facebook.com/) | `META_ACCESS_TOKEN` (長效權杖)<br>`META_AD_ACCOUNT_ID` |
| **Google Gemini API** | [Google AI Studio](https://aistudio.google.com/) | `GEMINI_API_KEY` |

### 步驟 2：配置環境變數 (.env)

複製範本檔並填寫您的專屬憑證：
```bash
cp .env.example .env
```

```env
# LINE Messaging API 設定
LINE_CHANNEL_SECRET=貼上您的_LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN=貼上您的_LINE_CHANNEL_ACCESS_TOKEN
ADMIN_LINE_USER_ID=貼上您的_LINE_USER_ID (格式為 U 開頭的 33 碼字串)

# 伺服器監聽 Port
PORT=3000

# Meta Marketing API 憑證 (建議使用 System User 長效權杖)
META_ACCESS_TOKEN=貼上您的_META_ACCESS_TOKEN
META_AD_ACCOUNT_ID=act_xxxxxxxxxxxxxxxxx
META_API_VERSION=v20.0

# Google Gemini AI Agent 設定
GEMINI_API_KEY=貼上您的_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash

# 雲端常駐保活網址 (若在 Render 請填入分配之 onrender.com 網址)
RENDER_EXTERNAL_URL=https://your-bot-service.onrender.com
```

### 步驟 3：本地端開發與測試 (Local Dev with ngrok)

1. **安裝依賴並編譯**：
   ```bash
   npm install
   npm run build
   ```

2. **啟動本機伺服器**：
   ```bash
   npm start
   ```

3. **透過 ngrok 映射公開 HTTPS 網址**：
   ```bash
   ngrok http 3000
   ```
   取得網址如：`https://xxxx-xx-xx.ngrok-free.app`

4. **設定 LINE Webhook**：
   - 進入 LINE Developers ➔ 您的 Channel ➔ **Messaging API**。
   - Webhook URL 填入：`https://xxxx-xx-xx.ngrok-free.app/callback`。
   - 點擊 **Update** 並點擊 **Verify** 確保顯示 Success。
   - 開啟 **Use webhook** 開關。
   - 前往 LINE Official Account Manager 後台 ➔ 設定 ➔ 回應設定：
     - 回應模式：選擇 **「聊天 (Bot)」**
     - 自動回應訊息：**「關閉」**
     - Webhook：**「開啟」**

5. **初始化上傳圖文選單**：
   ```bash
   npm run setup-richmenu
   ```

### 步驟 4：雲端一鍵部署 (Render / Docker)

專案已內建完整的 `Dockerfile`，支援任何支援容器化之雲端平台（如 Render, Fly.io, Railway, AWS ECS）：

1. **在 Render 建立 Web Service**：
   - 連接至本 GitHub 倉庫。
   - Environment 選擇 **Node** 或 **Docker**。
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
2. **在 Render 環境變數 (Environment Variables) 填入 `.env` 中的金鑰**。
3. **完成部署後**：
   - 將 Render 產生的對外網址（如 `https://line-ads-bot-xxxx.onrender.com/callback`）更新至 LINE Developers Webhook URL。
   - 瀏覽 `https://your-domain.onrender.com/setup-rich-menu` 即可於線上初始化圖文選單！

---

## 🛠️ API 端點與指令清單 (Endpoints & Commands)

### 1. HTTP 系統服務端點

| 端點 (Endpoint) | HTTP 方法 | 用途說明 |
| :--- | :--- | :--- |
| **`/callback`** | `POST` | LINE Webhook 主要接收入口（含簽章驗證） |
| **`/ping`** / **`/healthz`** | `GET` | 極簡健康檢查端點，供自我保活與監控服務使用 |
| **`/logs`** | `GET` | 查看記憶體內最新 200 行運行日誌，便於遠端即時排查 |
| **`/cron/push-brief`** | `GET/POST` | 外部手動觸發 09:00 晨報推播（非同步背景執行） |
| **`/cron/push-evening`** | `GET/POST` | 外部手動觸發 21:30 晚報推播（非同步背景執行） |
| **`/cron/push-weekly`** | `GET/POST` | 外部手動觸發每週一綜合週報推播 |
| **`/setup-rich-menu`** | `GET/POST` | 雲端一鍵重置、生成並套用大字版圖文選單 |

### 2. LINE 聊天室指令對照表

| 指令關鍵字 | 功能說明 | 回傳視覺效果 |
| :--- | :--- | :--- |
| **`看成效`** / **`大盤`** | 調閱當前帳號近 7 天綜合數據 | 📊 Flex 綜合儀表板卡片 (含 2x2 指標與快速動作按鈕) |
| **`今天`** / **`今日成效`** | 調閱當天 00:00 至今即時戰況 | 📈 今日即時消耗與轉換進度卡片 |
| **`昨天`** / **`昨日成效`** | 調閱昨日全天收盤數據 | 📅 昨日完整成效卡片 |
| **`查疲勞`** | 執行近 3 天 vs 7 天三選二疲勞分析 | ⚡ 綠色安全卡片 或 紅色警戒卡片 |
| **`素材象限`** | 針對活躍素材繪製成效象限診斷 | 🧩 素材評級卡片（核心推手 / 潛力股 / 待汰換） |
| **`看週報`** | 產出前週跨帳號與專案週環比報告 | 📑 完整週報卡片 |
| **`巡邏`** / **`全域巡邏`** | 跨所有授權帳號快速巡邏異常 | 🚨 跨帳號預算與風控卡片 |
| **`換帳號`** / **`切換`** | 列出目前 Token 授權的所有可用品牌帳號 | 🔄 可點擊之互動式帳號切換清單 |
| **`換帳號 [名稱]`** | 直接切換至指定品牌（如 `換帳號 DR.WU`） | ✅ 切換成功確認與貨幣設定提示 |
| **自然語言提問** | 如「哪一個廣告組點擊成本太高？」 | 🤖 Gemini 2.5 Flash 智能分析與策略建議 |

---

## 📄 授權條款 (License)
本專案採用 [MIT License](LICENSE) 開源授權，歡迎團隊依業務需求進行客製化與二開發。
