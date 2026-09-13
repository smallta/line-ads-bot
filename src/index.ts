import express from 'express';
import { middleware, messagingApi, WebhookEvent } from '@line/bot-sdk';
import { config, runtimeState } from './config.js';
import { handleTextMessage } from './handlers/messageHandler.js';
import { FlexBuilder } from './formatters/flexBuilder.js';

const app = express();

// LINE Webhook 密鑰檢驗中介層配置
const lineMiddlewareConfig = {
  channelSecret: config.line.channelSecret,
};

// 初始化 LINE 官方 Messaging API 客戶端
const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: config.line.channelAccessToken,
});

// 健康檢查首頁
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'LINE OA Meta Ads Diagnostic Bot',
    currentAdAccount: runtimeState.currentAccountName,
    currentAdAccountId: runtimeState.currentAdAccountId,
    timestamp: new Date().toISOString(),
  });
});

// 外部排程觸發端點 (用於定時喚醒與觸發晨報，極簡回傳 2 字元 OK 避免超出 cron 服務大小限制)
app.all('/cron/push-brief', async (req, res) => {
  console.log('⏰ [External Trigger] 收到排程觸發請求，開始執行晨報推播...');
  try {
    await pushMorningBrief();
    res.status(200).send('OK');
  } catch (err: any) {
    console.error('❌ [External Trigger] 晨報推送失敗:', err);
    res.status(500).send('ERR');
  }
});

// LINE Webhook 端點 (需經過 LINE 簽章驗證中介軟體)
app.post('/callback', middleware(lineMiddlewareConfig), async (req, res) => {
  const events: WebhookEvent[] = req.body.events;

  // 立即回傳 200 OK 給 LINE 伺服器，避免超時重發
  res.status(200).end();

  // 非同步依序處理各事件
  for (const event of events) {
    try {
      const senderId = event.source?.userId;
      console.log(`📩 [Webhook] 收到來自 ${senderId || '未知用戶'} 的事件: ${event.type}`);

      // 1. 處理文字訊息事件
      if (event.type === 'message' && event.message.type === 'text') {
        console.log(`💬 訊息內容: "${event.message.text}"`);
        await handleTextMessage(event.message.text, event.replyToken, lineClient, senderId);
      }
      // 2. 處理加入好友 / 解除封鎖事件 (Follow)
      else if (event.type === 'follow') {
        const welcomeFlex = FlexBuilder.buildHelpFlex(runtimeState.currentAccountName);
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [welcomeFlex],
        });
      }
    } catch (err: any) {
      console.error('處理 Webhook 事件失敗:', err);
    }
  }
});

import cron from 'node-cron';
import { pushMorningBrief } from './cron/pushMorningBrief.js';

// 每日 09:00 (Asia/Taipei) 自動推播廣告成效晨報
cron.schedule(
  '0 9 * * *',
  async () => {
    console.log('⏰ [Cron] 觸發每日 09:00 廣告成效晨報自動推播...');
    try {
      await pushMorningBrief();
    } catch (err: any) {
      console.error('❌ [Cron] 自動推播失敗:', err);
    }
  },
  {
    timezone: 'Asia/Taipei',
  }
);

// 啟動伺服器
app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🤖 LINE OA 廣告成效特助伺服器已啟動！`);
  console.log(`🌐 監聽通訊埠：http://localhost:${config.port}`);
  console.log(`📍 Webhook 路由：http://localhost:${config.port}/callback`);
  console.log(`🎯 預設監控帳號：【${runtimeState.currentAccountName}】(${runtimeState.currentAdAccountId})`);
  console.log(`⏰ 晨報自動推播：每日 09:00 (Asia/Taipei)`);
  console.log(`=======================================================`);
});
