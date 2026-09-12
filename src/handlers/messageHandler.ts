import { messagingApi } from '@line/bot-sdk';
import { runtimeState, KNOWN_ACCOUNTS } from '../config.js';
import { MetaService } from '../metaService.js';
import { FlexBuilder } from '../formatters/flexBuilder.js';

export async function handleTextMessage(
  text: string,
  replyToken: string,
  lineClient: messagingApi.MessagingApiClient,
  userId?: string
): Promise<void> {
  const trimmed = text.trim();

  try {
    // 指令 0: 查詢自己的 LINE User ID
    if (/^(id|我的id|uid|user\s*id)$/i.test(trimmed)) {
      await lineClient.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: `👤 您的 LINE User ID 為：\n${userId || '未能取得'}\n\n可將此 ID 填入 .env 的 ADMIN_LINE_USER_ID，即可接收每日 09:00 晨報與警報！`,
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

    // 預設指令: 說明手冊
    const helpFlex = FlexBuilder.buildHelpFlex(runtimeState.currentAccountName);
    await lineClient.replyMessage({
      replyToken,
      messages: [helpFlex],
    });
  } catch (err: any) {
    console.error('處理 LINE 訊息失敗:', err);
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: `⚠️ 調閱 Meta 數據時發生錯誤：${err.message || '未知錯誤，請稍後再試'}`,
        },
      ],
    });
  }
}
