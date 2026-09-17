import { messagingApi } from '@line/bot-sdk';
import { config, runtimeState, KNOWN_ACCOUNTS } from '../config.js';
import { MetaService } from '../metaService.js';
import { FlexBuilder } from '../formatters/flexBuilder.js';
import { pushMorningBrief } from '../cron/pushMorningBrief.js';
import { AIAgent } from '../aiAgent.js';

export async function handleTextMessage(
  text: string,
  replyToken: string,
  lineClient: messagingApi.MessagingApiClient,
  userId?: string
): Promise<void> {
  const trimmed = text.trim();

  try {
    // 指令 0: 查詢自己的 LINE User ID (公開指令，方便獲取 ID)
    if (/^(id|我的id|uid|user\s*id)$/i.test(trimmed)) {
      await lineClient.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: `👤 您的 LINE User ID 為：\n${userId || '未能取得'}\n\n可將此 ID 提供給管理員加入白名單，即可調閱廣告數據與接收每日晨報！`,
          },
        ],
      });
      return;
    }

    // 🔒 管理員白名單安全防護 (Admin Whitelist Guard)
    // 支援單一 ID 或以逗號分隔的多個授權 ID
    const allowedAdmins = (config.adminUserId || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const isAuthorized = allowedAdmins.length === 0 || (userId && allowedAdmins.includes(userId));

    if (!isAuthorized) {
      console.warn(`🚨 [資安攔截] 阻擋來自未授權用戶 [${userId || '未知'}] 的成效查詢: "${trimmed}"`);
      await lineClient.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: `🔒 存取受限 (私密模式)\n\n本系統目前處於「個人專屬私密模式」，僅限授權管理員調閱廣告成效數據。\n\n您的專屬 ID：\n${userId || '未能識別'}\n\n若您是專案成員，請將此 ID 提供給管理者加入白名單。`,
          },
        ],
      });
      return;
    }

    // 指令 1: 看成效 / 大盤
    if (/^看成效|^大盤|^成效|^report|^今日成效|^本週成效/i.test(trimmed)) {
      const metrics = await MetaService.getAccountOverview(runtimeState.currentAdAccountId, 'last_7d');
      const flex = FlexBuilder.buildOverviewFlex(metrics);
      await lineClient.replyMessage({
        replyToken,
        messages: [flex],
      });
      return;
    }

    // 指令 1.5: 手動測試或即時推播晨報
    if (/^(晨報|推播晨報|發送晨報|morning\s*brief)$/i.test(trimmed)) {
      await lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: '🚀 正在為您即時生成並推播最新廣告晨報戰情卡片...' }],
      });
      await pushMorningBrief();
      return;
    }

    // 指令 2: 查疲勞 / 疲勞
    if (/^查疲勞|^疲勞|^fatigue/i.test(trimmed)) {
      const fatigued = await MetaService.detectFatigue(runtimeState.currentAdAccountId);
      const flex = FlexBuilder.buildFatigueFlex(fatigued, runtimeState.currentAccountName);
      await lineClient.replyMessage({
        replyToken,
        messages: [flex],
      });
      return;
    }

    // 指令 3: 查活動 / 活動
    if (/^查活動|^活動|^campaign/i.test(trimmed)) {
      const campaigns = await MetaService.listCampaigns(runtimeState.currentAdAccountId, 'last_7d');
      const flex = FlexBuilder.buildCampaignsFlex(campaigns, runtimeState.currentAccountName);
      await lineClient.replyMessage({
        replyToken,
        messages: [flex],
      });
      return;
    }

    // 指令 4: 切換帳號
    if (/^切換|^換帳號/i.test(trimmed)) {
      const target = trimmed.replace(/^切換|^換帳號/i, '').trim();

      if (!target) {
        // 列出已知帳號讓使用者選擇
        const accountList = Object.keys(KNOWN_ACCOUNTS)
          .map((k) => `👉 「切換 ${k}」`)
          .join('\n');
        await lineClient.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: `目前監控帳號：【${runtimeState.currentAccountName}】\n\n可直接回覆以下指令切換目標：\n${accountList}`,
            },
          ],
        });
        return;
      }

      // 比對帳號名稱或 ID
      const matchedKey = Object.keys(KNOWN_ACCOUNTS).find(
        (k) => k.toLowerCase() === target.toLowerCase()
      );

      if (matchedKey) {
        runtimeState.currentAdAccountId = KNOWN_ACCOUNTS[matchedKey].id;
        runtimeState.currentAccountName = KNOWN_ACCOUNTS[matchedKey].name;
        await lineClient.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: `✅ 已成功切換目標帳號為：【${runtimeState.currentAccountName}】(\`${runtimeState.currentAdAccountId}\`)\n\n請輸入「看成效」立即調閱數據！`,
            },
          ],
        });
        return;
      } else if (target.startsWith('act_') || /^\d+$/.test(target)) {
        const id = target.startsWith('act_') ? target : `act_${target}`;
        runtimeState.currentAdAccountId = id;
        runtimeState.currentAccountName = id;
        await lineClient.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: `✅ 已切換至自訂帳號 ID：\`${id}\`\n\n請輸入「看成效」立即調閱數據！`,
            },
          ],
        });
        return;
      } else {
        await lineClient.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: `❌ 找不到名為「${target}」的帳號。\n請輸入「切換」查看可用清單，或直接輸入帳號 ID（如 act_123456）。`,
            },
          ],
        });
        return;
      }
    }

    // 指令 5: 說明手冊
    if (/^(說明|help|\?|？|指令)$/i.test(trimmed)) {
      const helpFlex = FlexBuilder.buildHelpFlex(runtimeState.currentAccountName);
      await lineClient.replyMessage({
        replyToken,
        messages: [helpFlex],
      });
      return;
    }

    // 🤖 AI 顧問特助大腦：處理所有自由對話與自然語言查詢
    if (config.gemini.apiKey) {
      const aiReply = await AIAgent.handleUserMessage(trimmed);
      await lineClient.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: aiReply,
          },
        ],
      });
      return;
    }

    // 若未設定 GEMINI_API_KEY，回傳預設說明卡片
    const fallbackHelp = FlexBuilder.buildHelpFlex(runtimeState.currentAccountName);
    await lineClient.replyMessage({
      replyToken,
      messages: [fallbackHelp],
    });
  } catch (err: any) {
    console.error('處理 LINE 訊息失敗:', err);
    const rawMsg = err.message || '';
    const rawLower = rawMsg.toLowerCase();
    let replyText = `⚠️ 處理訊息時發生錯誤：${rawMsg}`;

    if (rawLower.includes('quota') || rawLower.includes('resource_exhausted') || rawLower.includes('429')) {
      replyText = `⏳ AI 模型目前連線頻率較高，算力配額暫時冷卻中（約需 5~10 秒）。\n\n請稍候片刻再輸入問題，或直接輸入「看成效」、「查活動」以極速專線卡片調閱數據！`;
    } else if (rawLower.includes('high demand') || rawLower.includes('503')) {
      replyText = `⏳ 目前 Google AI 伺服器尖峰負載中，請等待數秒後再次發問即可！`;
    }

    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: replyText,
        },
      ],
    });
  }
}
