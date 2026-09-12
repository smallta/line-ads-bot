# LINE OA 廣告成效特助 (LINE Meta Ads Assistant)

專為行銷團隊與管理層打造的 **LINE 官方帳號廣告成效監控特助**。
將 Meta Marketing API 即時數據轉化為高質感的 **LINE Flex Message 圖形化儀表板卡片**，支援「每日晨報定時推播」、「素材疲勞/拒登即時警報」與「聊天室雙向自然語言即時查詢」。

---

## 🌟 兩大核心應用模式

### 1. 每日 09:00 晨報與即時警報主動推播 (Push Notification)
* **自動晨報**：每日早上自動推送前一日/近 7 天的花費、轉換數、CPA、ROAS 與主力活動。
* **緊急風控警報**：當素材觸發「三選二」疲勞或遭 Meta 拒登時，即刻發送紅底警告卡片。
* **費用保證**：僅推播給管理員個人或 1 個內部工作群組，每日 1 則，每月約 30 則，**完全落在 LINE 官方提供的「每月 200 則免費額度」內，零額外費用！**

### 2. 聊天室雙向即時查詢 (Interactive 2-Way Chat)
在 LINE 聊天室直接發送文字，AI 即時調閱 Meta API 回傳視覺化卡片：
* 📊 發送 **「看成效」** 或 **「大盤」** ➔ 調閱近 7 天花費、ROAS、CPA、CTR。
* ⚡ 發送 **「查疲勞」** ➔ 執行三選二素材疲勞檢測（頻率>4.0、CTR降>15%、CPA漲>20%）。
* 🎯 發送 **「查活動」** ➔ 列出當前活躍活動 Top 6 與投報率排行。
* 🔄 發送 **「切換 一起夢想」** 或 **「切換 DR.WU」** ➔ 一秒切換不同品牌專案！
* 💬 **費用說明**：使用者主動發問、機器人回答（Reply Message）**完全免費且無限量**！

---

## 🚀 3 步驟快速設定教學

### 步驟 1：在 LINE Developers 申請 Messaging API

1. 前往 **[LINE Developers Console](https://developers.line.biz/)**（使用個人 LINE 帳號登入）。
2. 點擊 **Create a new provider**（輸入您的組織名稱，例如 `TogetherDream` 或 `Agency`）。
3. 點擊 **Create a Messaging API channel**：
   * Channel name：輸入機器人名稱（例如：`廣告成效特助`）。
   * Channel description：輸入簡短說明。
   * Category / Subcategory：隨選（如 `Company`）。
   * 點擊同意條款並建立。
4. 取得 3 個關鍵憑證：
   * **`LINE_CHANNEL_SECRET`**：位於 **Basic settings** 頁籤中段。
   * **`LINE_CHANNEL_ACCESS_TOKEN`**：位於 **Messaging API** 頁籤最底部的 Channel access token，點擊「Issue」產出長效權杖。
   * **`ADMIN_LINE_USER_ID`**：位於 **Basic settings** 頁籤最下方的 **Your user ID**（以 `U` 開頭的 33 碼字串，這是用來接收推播的管理員代碼）。

---

### 步驟 2：配置環境變數 (`.env`)

在 `line-ads-bot/` 目錄中編輯 `.env`：

```env
# LINE Messaging API 設定
LINE_CHANNEL_SECRET=貼上您的_Channel_Secret
LINE_CHANNEL_ACCESS_TOKEN=貼上您的_Channel_Access_Token
ADMIN_LINE_USER_ID=貼上您的_User_ID (Uxxxxxxxx...)
PORT=3000

# Meta API 設定 (已自動同步自 meta-ads-mcp)
META_ACCESS_TOKEN=EAAOUf69C6...
META_AD_ACCOUNT_ID=act_4000297516716904
META_API_VERSION=v20.0
```

---

### 步驟 3：啟動與掛載 Webhook

#### 本地測試模式 (搭配 ngrok)：

1. **啟動伺服器**：
   ```bash
   npm start
   ```
   伺服器將在 `http://localhost:3000` 監聽。

2. **使用 ngrok 產生公開 HTTPS 網址**：
   ```bash
   ngrok http 3000
   ```
   取得類似 `https://xxxx-xx-xx.ngrok-free.app` 的網址。

3. **設定 LINE Webhook**：
   * 回到 **[LINE Developers Console](https://developers.line.biz/)** ➔ 進入您的 Channel ➔ **Messaging API** 頁籤。
   * 在 **Webhook URL** 填入：`https://xxxx-xx-xx.ngrok-free.app/callback`。
   * 點擊 **Update** 並點擊 **Verify**（需顯示 Success）。
   * 將 **Use webhook** 開關切換為 **開啟 (Enabled)**。

4. **調整 LINE 官方回應設定**：
   * 點擊頁面上的 **LINE Official Account Manager** 連結進入後台。
   * 前往 **設定 ➔ 回應設定**：
     * 回應模式：選擇 **「聊天 (Bot)」**。
     * 自動回應訊息：**「關閉」**（避免官方預設罐頭訊息覆蓋我們機器人的回覆）。
     * Webhook：**「開啟」**。

5. **加入好友並開始使用**：
   * 掃描 Messaging API 頁籤上的 QR Code 將機器人加入好友。
   * 在聊天室傳送「**看成效**」，即可見證高質感的 Flex 儀表板卡片！

---

## ⏰ 設定每日 09:00 自動推播晨報

若要每日固定向管理員推播晨報，可透過 macOS/Linux 原生 `crontab` 設定：

```bash
crontab -e
```
加入以下排程（每天早上 09:00 自動執行）：
```bash
0 9 * * * cd /Users/Sephiroth/Desktop/訓練/line-ads-bot && npm run push-brief >> /tmp/line-push.log 2>&1
```

也可在任何時候手動觸發推播測試：
```bash
npm run push-brief
```

---

## 📱 支援對話指令一覽

| 指令 | 觸發功能 | 回傳視覺效果 |
| :--- | :--- | :--- |
| **`看成效`** / **`大盤`** | 調閱當前帳號近 7 天總花費、ROAS、CPA、CTR、轉換數 | 📊 Flex 綜合儀表板卡片 (含 2x2 指標與快捷按鈕) |
| **`查疲勞`** | 比對近 3 天 vs 前 7 天，執行三選二疲勞檢測 | ⚡ 綠色安全卡片 或 紅色警報卡片 |
| **`查活動`** | 列出當前活躍活動 Top 6 與 CBO 預算、ROAS 排名 | 🎯 活動排行卡片 (綠色高亮 ROAS ≥ 2.0 之金牛) |
| **`切換 [名稱]`** | 切換目標監控帳號（如 `切換 一起夢想` 或 `切換 DR.WU`） | 🔄 即時切換確認訊息 |
| **`切換`** | 列出目前支援的所有內建專案清單 | 📋 可切換帳號清單與使用方式 |
| **`說明`** / **`help`** | 查看所有支援的關鍵字手冊 | 🤖 圖文指南說明卡片 |
