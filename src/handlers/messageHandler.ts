import { messagingApi } from '@line/bot-sdk';
import { config, runtimeState, KNOWN_ACCOUNTS } from '../config.js';
import { MetaService } from '../metaService.js';
import { FlexBuilder } from '../formatters/flexBuilder.js';
import { pushMorningBrief } from '../cron/pushMorningBrief.js';
import { AIAgent } from '../aiAgent.js';
import { AccountManager } from '../accountManager.js';

// 安全發送訊息器：優先使用免費 replyMessage，若遇逾時或 replyToken 失效則自動無縫改用 pushMessage 直達用戶
async function safeSendMessages(
  lineClient: messagingApi.MessagingApiClient,
  replyToken: string,
  userId: string | undefined,
  messages: any[]
): Promise<void> {
  try {
    await lineClient.replyMessage({
      replyToken,
      messages,
    });
  } catch (replyErr: any) {
    console.warn(`⚠️ [LINE Reply Failed] replyMessage 失敗 (${replyErr.message})，立即啟動 pushMessage 備援直達...`);
    if (userId) {
      try {
        const fallbackMessages = messages.map((m) => {
          if (m.type === 'text' && typeof m.text === 'string') {
            return {
              ...m,
              text: m.text + '\n\n💡 (⚡ 跨維度分析耗時較長，特助已透過專屬備援通道為您直送手機)',
            };
          }
          return m;
        });

        await lineClient.pushMessage({
          to: userId,
          messages: fallbackMessages,
        });
        console.log(`✅ [LINE Push Fallback] 成功透過 pushMessage 送達用戶 [${userId}]！`);
        return;
      } catch (pushErr: any) {
        console.error(`❌ [LINE Push Failed] pushMessage 亦失敗:`, pushErr.message);
      }
    }
    throw replyErr;
  }
}

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
      await safeSendMessages(lineClient, replyToken, userId, [
        {
          type: 'text',
          text: `👤 您的 LINE User ID 為：\n${userId || '未能取得'}\n\n可將此 ID 提供給管理員加入白名單，即可調閱廣告數據與接收每日晨報！`,
        },
      ]);
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
      await safeSendMessages(lineClient, replyToken, userId, [
        {
          type: 'text',
          text: `🔒 存取受限 (私密模式)\n\n本系統目前處於「個人專屬私密模式」，僅限授權管理員調閱廣告成效數據。\n\n您的專屬 ID：\n${userId || '未能識別'}\n\n若您是專案成員，請將此 ID 提供給管理者加入白名單。`,
        },
      ]);
      return;
    }

    // 🌟 立即向手機用戶展示 LINE 原生「AI 思考中」動畫 (消除等待焦慮，最多維持 25 秒)
    if (userId) {
      lineClient.showLoadingAnimation({ chatId: userId, loadingSeconds: 25 }).catch(() => {});
    }

    // 指令 1: 看成效 / 大盤
    if (/^看成效|^大盤|^成效|^report|^今日成效|^本週成效/i.test(trimmed)) {
      const metrics = await MetaService.getAccountOverview(runtimeState.currentAdAccountId, 'last_7d');
      const flex = FlexBuilder.buildOverviewFlex(metrics);
      await safeSendMessages(lineClient, replyToken, userId, [flex]);
      return;
    }

    // 指令 1.5: 手動測試或即時推播晨報
    if (/^(晨報|推播晨報|發送晨報|morning\s*brief)$/i.test(trimmed)) {
      await safeSendMessages(lineClient, replyToken, userId, [
        { type: 'text', text: '🚀 正在為您即時生成並推播最新廣告晨報戰情卡片...' },
      ]);
      await pushMorningBrief();
      return;
    }

    // 指令 2: 查疲勞 / 疲勞
    if (/^查疲勞|^疲勞|^fatigue/i.test(trimmed)) {
      const fatigued = await MetaService.detectFatigue(runtimeState.currentAdAccountId);
      const flex = FlexBuilder.buildFatigueFlex(fatigued, runtimeState.currentAccountName);
      await safeSendMessages(lineClient, replyToken, userId, [flex]);
      return;
    }

    // 指令 3: 查活動 / 活動
    if (/^查活動|^活動|^campaign/i.test(trimmed)) {
      const campaigns = await MetaService.listCampaigns(runtimeState.currentAdAccountId, 'last_7d');
      const flex = FlexBuilder.buildCampaignsFlex(campaigns, runtimeState.currentAccountName);
      await safeSendMessages(lineClient, replyToken, userId, [flex]);
      return;
    }

    // 指令 4: 切換帳號 / 換帳號（全面升級：動態讀取全帳號庫 + 智慧模糊比對 + 一鍵 Quick Reply）
    if (/^(切換|換帳號|換到|換成|切換帳號|帳號切換|切換到|切換成)/i.test(trimmed)) {
      // 檢查是否包含特定帳號關鍵字
      const matchResult = await AccountManager.matchAndSwitchAccount(trimmed);

      if (matchResult.success && matchResult.account) {
        const acc = matchResult.account;
        await safeSendMessages(lineClient, replyToken, userId, [
          {
            type: 'text',
            text: `✅ 已成功切換目標帳號為：【${acc.shortName}】(\`${acc.id}\`)\n\n📌 完整名稱：${acc.name}\n💰 結算幣別：${acc.currency}\n\n👉 請輸入「看成效」立即調閱該帳號數據！`,
            quickReply: {
              items: [
                { type: 'action', action: { type: 'message', label: '📊 看成效', text: '看成效' } },
                { type: 'action', action: { type: 'message', label: '🎯 查活動', text: '查活動' } },
                { type: 'action', action: { type: 'message', label: '⚡ 查疲勞', text: '查疲勞' } },
                { type: 'action', action: { type: 'message', label: '🏢 換其他帳號', text: '換帳號' } },
              ],
            },
          },
        ]);
        return;
      }

      // 未指定目標帳號或輸入無法識別時，動態調閱目前 Token 名下所有廣告帳號並輸出 Flex 卡片 + 快捷按鈕
      const accounts = await AccountManager.getAccessibleAccounts();
      const accountFlex = FlexBuilder.buildAccountListFlex(accounts, runtimeState.currentAdAccountId);

      const quickReplyItems = accounts.slice(0, 13).map((a) => ({
        type: 'action' as const,
        action: {
          type: 'message' as const,
          label: a.shortName.length > 20 ? a.shortName.slice(0, 19) + '…' : a.shortName,
          text: `切換 ${a.shortName}`,
        },
      }));

      const replyMessages: any[] = [accountFlex];
      if (matchResult.error) {
        replyMessages.unshift({
          type: 'text',
          text: `⚠️ ${matchResult.error}。\n請參考下方已授權的帳號清單直接點選切換：`,
        });
      }

      // 附加快捷點擊選單
      const lastMsg = replyMessages[replyMessages.length - 1];
      lastMsg.quickReply = { items: quickReplyItems };

      await safeSendMessages(lineClient, replyToken, userId, replyMessages);
      return;
    }

    // 指令 5: 說明手冊
    if (/^(說明|help|\?|？|指令)$/i.test(trimmed)) {
      const helpFlex = FlexBuilder.buildHelpFlex(runtimeState.currentAccountName);
      await safeSendMessages(lineClient, replyToken, userId, [helpFlex]);
      return;
    }

    // 🤖 AI 顧問特助大腦：處理所有自由對話與自然語言查詢
    if (config.gemini.apiKey) {
      const aiReply = await AIAgent.handleUserMessage(trimmed);
      await safeSendMessages(lineClient, replyToken, userId, [
        {
          type: 'text',
          text: aiReply,
        },
      ]);
      return;
    }

    // 若未設定 GEMINI_API_KEY，回傳預設說明卡片
    const fallbackHelp = FlexBuilder.buildHelpFlex(runtimeState.currentAccountName);
    await safeSendMessages(lineClient, replyToken, userId, [fallbackHelp]);
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

    await safeSendMessages(lineClient, replyToken, userId, [
      {
        type: 'text',
        text: replyText,
      },
    ]);
  }
}
