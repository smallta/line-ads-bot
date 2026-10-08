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

// 即時日誌記憶體緩衝區（保留最新 200 行，便於遠端診斷與即時排除問題）
const runtimeLogs: string[] = [];
function recordLog(level: string, ...args: any[]) {
  const time = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  runtimeLogs.push(`[${time}] [${level}] ${str}`);
  if (runtimeLogs.length > 200) runtimeLogs.shift();
}
const _origLog = console.log;
const _origErr = console.error;
const _origWarn = console.warn;
console.log = (...args: any[]) => { recordLog('INFO', ...args); _origLog(...args); };
console.error = (...args: any[]) => { recordLog('ERROR', ...args); _origErr(...args); };
console.warn = (...args: any[]) => { recordLog('WARN', ...args); _origWarn(...args); };

// 健康檢查首頁 (極簡回傳 2 字元 OK，供保活排程 ping 使用)
app.all(['/', '/healthz', '/ping'], (req, res) => {
  res.status(200).send('OK');
});

// 查看即時伺服器日誌端點（供遠端診斷異常）
app.get('/logs', (req, res) => {
  res.type('text/plain; charset=utf-8').send(runtimeLogs.join('\n') || '尚無日誌記錄');
});

// 外部排程觸發端點 (用於定時喚醒與觸發晨報，立即回傳 200 避免 cron-job.org 逾時，背景非同步推播)
app.all('/cron/push-brief', (req, res) => {
  console.log('⏰ [External Trigger] 收到排程觸發請求，立即回應 200 並於背景執行晨報推播...');
  res.status(200).send('OK');

  setImmediate(async () => {
    try {
      await pushMorningBrief();
      console.log('✅ [External Trigger] 背景晨報推播成功完成！');
    } catch (err: any) {
      console.error('❌ [External Trigger] 背景晨報推送失敗:', err.message);
    }
  });
});

// 外部排程觸發端點 (用於定時喚醒與觸發每週週報，立即回傳 200 避免 cron-job.org 逾時，背景非同步推播)
app.all('/cron/push-weekly', (req, res) => {
  console.log('⏰ [External Trigger] 收到排程觸發請求，立即回應 200 並於背景執行每週成效週報推播...');
  res.status(200).send('OK');

  setImmediate(async () => {
    try {
      await pushWeeklyReport();
      console.log('✅ [External Trigger] 背景週報推播成功完成！');
    } catch (err: any) {
      console.error('❌ [External Trigger] 背景週報推送失敗:', err.message);
    }
  });
});

// 外部排程觸發端點 (用於定時喚醒與觸發今日成效晚報，立即回傳 200 避免 cron-job.org 逾時，背景非同步推播)
app.all('/cron/push-evening', (req, res) => {
  console.log('⏰ [External Trigger] 收到排程觸發請求，立即回應 200 並於背景執行今日成效晚報推播...');
  res.status(200).send('OK');

  setImmediate(async () => {
    try {
      const { pushEveningBrief } = await import('./cron/pushEveningBrief.js');
      await pushEveningBrief();
      console.log('✅ [External Trigger] 背景晚報推播成功完成！');
    } catch (err: any) {
      console.error('❌ [External Trigger] 背景晚報推送失敗:', err.message);
    }
  });
});

// 一鍵建立與更新圖文選單端點
app.all('/setup-rich-menu', async (req, res) => {
  try {
    const { setupRichMenu } = await import('./setupRichMenu.js');
    const richMenuId = await setupRichMenu();
    res.status(200).send(`OK: Rich Menu 已成功建立並啟用！ID: ${richMenuId}`);
  } catch (err: any) {
    console.error('設定 Rich Menu 失敗:', err);
    res.status(500).send(`Error: ${err.message}`);
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
        console.log(`💬 訊息內容: "${event.message.text}" (replyToken: ${event.replyToken})`);
        await handleTextMessage(event.message.text, event.replyToken, lineClient, senderId);
        console.log(`✅ 訊息 "${event.message.text}" 處理完成！`);
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
      console.error('❌ 處理 Webhook 事件失敗:', err.message, err.stack);
    }
  }
});

import cron from 'node-cron';
import { pushMorningBrief } from './cron/pushMorningBrief.js';
import { pushEveningBrief } from './cron/pushEveningBrief.js';
import { pushWeeklyReport } from './cron/pushWeeklyReport.js';

// 每日 09:00 (Asia/Taipei) 自動推播廣告成效晨報
cron.schedule(
  '0 9 * * *',
  async () => {
    console.log('⏰ [Cron] 觸發每日 09:00 廣告成效晨報自動推播...');
    try {
      await pushMorningBrief();
    } catch (err: any) {
      console.error('❌ [Cron] 晨報自動推播失敗:', err);
    }
  },
  {
    timezone: 'Asia/Taipei',
  }
);

// 每日 21:30 (Asia/Taipei) 自動推播今日成效日落晚報
cron.schedule(
  '30 21 * * *',
  async () => {
    console.log('⏰ [Cron] 觸發每日 21:30 今日成效晚報自動推播...');
    try {
      await pushEveningBrief();
    } catch (err: any) {
      console.error('❌ [Cron] 晚報自動推播失敗:', err);
    }
  },
  {
    timezone: 'Asia/Taipei',
  }
);

// 每週一 10:00 (Asia/Taipei) 自動推播廣告成效週報
cron.schedule(
  '0 10 * * 1',
  async () => {
    console.log('⏰ [Cron] 觸發每週一 10:00 廣告成效週報自動推播...');
    try {
      await pushWeeklyReport();
    } catch (err: any) {
      console.error('❌ [Cron] 週報自動推播失敗:', err);
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
  console.log(`⏰ 晚報自動推播：每日 21:30 (Asia/Taipei)`);
  console.log(`⏰ 週報自動推播：每週一 10:00 (Asia/Taipei)`);
  console.log(`=======================================================`);

  // 🌟 伺服器自主保活心跳（每 10 分鐘對外發送一次 public ping，重置 Render 15 分鐘休眠倒數）
  const publicUrl = process.env.RENDER_EXTERNAL_URL || 'https://line-ads-bot-xrz5.onrender.com';
  const sendHeartbeat = () => {
    fetch(`${publicUrl}/ping`)
      .then((res) => {
        if (res.ok) {
          console.log(`💓 [KeepAlive] 自主心跳成功 (${publicUrl}/ping)，維持伺服器常駐！`);
        }
      })
      .catch((err) => {
        console.warn('⚠️ [KeepAlive] 自主心跳連線失敗:', err.message);
      });
  };

  // 啟動 30 秒後初次心跳，隨後每 10 分鐘定期心跳
  setTimeout(sendHeartbeat, 30 * 1000);
  setInterval(sendHeartbeat, 10 * 60 * 1000);
});
