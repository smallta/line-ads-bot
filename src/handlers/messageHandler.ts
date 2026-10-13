import { messagingApi } from '@line/bot-sdk';
import { config, runtimeState, KNOWN_ACCOUNTS } from '../config.js';
import { MetaService } from '../metaService.js';
import { FlexBuilder } from '../formatters/flexBuilder.js';
import { pushMorningBrief } from '../cron/pushMorningBrief.js';
import { pushWeeklyReport } from '../cron/pushWeeklyReport.js';
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

    // 指令 1A: 今天成效 / 今日即時 / today
    if (/^(今天|今日|今天成效|今日成效|今天的成效|今天的數據|今日數據|today)$/i.test(trimmed)) {
      const metrics = await MetaService.getAccountOverview(runtimeState.currentAdAccountId, 'today');
      const flex = FlexBuilder.buildOverviewFlex(metrics);
      await safeSendMessages(lineClient, replyToken, userId, [flex]);
      return;
    }

    // 指令 1B: 昨天成效 / 昨日結算 / yesterday
    if (/^(昨天|昨日|昨天成效|昨日成效|昨天的成效|昨天的數據|昨日數據|yesterday)$/i.test(trimmed)) {
      const metrics = await MetaService.getAccountOverview(runtimeState.currentAdAccountId, 'yesterday');
      const flex = FlexBuilder.buildOverviewFlex(metrics);
      await safeSendMessages(lineClient, replyToken, userId, [flex]);
      return;
    }

    // 指令 1C: 看成效 / 大盤 / 本週 / 近7天 (預設近 7 天)
    if (/^看成效|^大盤|^成效|^本週成效|^本週|^近7天|^近七天|^report/i.test(trimmed)) {
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
      await pushMorningBrief({ force: true });
      return;
    }

    // 指令 1.6: 手動測試或即時推播晚報 (今日戰報)
    if (/^(晚報|今日晚報|推播晚報|發送晚報|今日戰報|evening|evening\s*brief)$/i.test(trimmed)) {
      await safeSendMessages(lineClient, replyToken, userId, [
        { type: 'text', text: '🌙 正在為您即時生成並推播今日成效日落戰報卡片...' },
      ]);
      const { pushEveningBrief } = await import('../cron/pushEveningBrief.js');
      await pushEveningBrief({ force: true });
      return;
    }

    // 指令 1.8: 週報 / 本週週報 / 看週報 / weekly (含 WoW 環比與資本配置指引)
    if (/^(週報|本週週報|看週報|查週報|每週報告|每週週報|weekly|weekly\s*report)$/i.test(trimmed)) {
      const [weeklyComp, campaigns, fatigued] = await Promise.all([
        MetaService.getWeeklyComparison(runtimeState.currentAdAccountId),
        MetaService.listCampaigns(runtimeState.currentAdAccountId, 'last_7d', 5),
        MetaService.detectFatigue(runtimeState.currentAdAccountId),
      ]);
      const weeklyFlex = FlexBuilder.buildWeeklyReportFlex(
        weeklyComp.current,
        campaigns,
        fatigued,
        runtimeState.currentAccountName,
        '過去 7 天綜合數據',
        weeklyComp.delta
      );
      await safeSendMessages(lineClient, replyToken, userId, [weeklyFlex]);
      return;
    }

    // 指令 1.9: 手動測試或即時推播週報
    if (/^(推播週報|發送週報)$/i.test(trimmed)) {
      await safeSendMessages(lineClient, replyToken, userId, [
        { type: 'text', text: '📊 正在為您即時生成並推播每週廣告成效週報卡片...' },
      ]);
      await pushWeeklyReport({ force: true });
      return;
    }

    // 指令 1.95: 16 帳號全域紅綠燈晨檢 (Cross-Account Sentinel)
    if (/^(巡邏|全域巡邏|帳號巡邏|全域體檢|帳號體檢|檢查所有帳號|檢查帳號|紅綠燈|patrol|sentinel)$/i.test(trimmed)) {
      const accounts = await AccountManager.getAccessibleAccounts();
      const patrolItems = await MetaService.patrolAccounts(accounts);
      const patrolFlex = FlexBuilder.buildPatrolFlex(patrolItems);
      await safeSendMessages(lineClient, replyToken, userId, [patrolFlex]);
      return;
    }

    // 指令 1.98: 吸血鬼 vs 金牛素材四象限 (Creative Matrix)
    if (/^(素材象限|素材矩陣|四象限|素材診斷|吸血鬼|金牛|吸血鬼素材|金牛素材|matrix|creative\s*matrix)$/i.test(trimmed)) {
      const matrixData = await MetaService.getCreativeMatrix(runtimeState.currentAdAccountId);
      const matrixFlex = FlexBuilder.buildCreativeMatrixFlex(matrixData, runtimeState.currentAccountName);
      await safeSendMessages(lineClient, replyToken, userId, [matrixFlex]);
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

    // 指令 4: 切換帳號 / 換帳號 / 帳號選單（支援 1.、1、換帳號、帳號、有哪些帳號等）
    if (
      /^(1\.|1$|1\s|1、|1-|\(?1\)?)/i.test(trimmed) ||
      /^(請|幫我|我要)?(切換|換帳號|換\s*帳號|更換帳號|切換帳號|帳號切換|帳號清單|帳號列表|有哪些帳號|看帳號|查帳號|所有帳號|選帳號|換品牌|切換品牌|換到|換成|切換到|切換成|轉到|帳號$)/i.test(
        trimmed
      )
    ) {
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

    // 指令 4.5: 輸入 2 或 2.（引導自然語言切換）
    if (/^(2\.|2$|2\s|2、|2-|\(?2\)?)/i.test(trimmed)) {
      await safeSendMessages(lineClient, replyToken, userId, [
        {
          type: 'text',
          text: `🗣️ 【方式二：自然語言快速切換】\n\n您可以直接在對話框輸入想查看的專案名稱：\n👉「換成微型社福」\n👉「切換到蔚然頌缽」\n👉「我想看生活用品」\n👉「看 DR.WU」\n\n特助會自動為您切換，並直接送上 7 天最新成效戰情！\n\n（💡 亦可點選下方快捷膠囊一鍵切換）：`,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '切換 微型社福', text: '切換 微型社福' } },
              { type: 'action', action: { type: 'message', label: '切換 蔚然頌缽', text: '切換 蔚然頌缽' } },
              { type: 'action', action: { type: 'message', label: '切換 生活用品', text: '切換 生活用品' } },
              { type: 'action', action: { type: 'message', label: '切換 DR.WU', text: '切換 DR.WU' } },
              { type: 'action', action: { type: 'message', label: '🏢 查看所有 13 個帳號', text: '換帳號' } },
            ],
          },
        },
      ]);
      return;
    }

    // 指令 4.6: 暫停廣告 / 暫停活動 (如: 暫停廣告 23851... 或 暫停活動 23851...)
    const pauseMatch = trimmed.match(/^暫停(廣告|素材|活動|行銷活動)?\s*([a-zA-Z0-9_]+)$/i);
    if (pauseMatch) {
      const type = pauseMatch[1] === '活動' || pauseMatch[1] === '行銷活動' ? 'campaign' : 'ad';
      const targetId = pauseMatch[2];
      if (type === 'campaign') {
        const res = await MetaService.pauseCampaign(targetId);
        const flex = FlexBuilder.buildOperationResultFlex({
          title: '活動暫停止血',
          actionType: 'pause',
          targetName: res.name,
          targetId: `cmp_${res.id}`,
          detail1: '已發送 API 指令將活動設為 PAUSED',
          detail2: '該活動下所有組合與素材已停止曝光扣款',
        });
        await safeSendMessages(lineClient, replyToken, userId, [flex]);
      } else {
        const res = await MetaService.pauseAd(targetId);
        const flex = FlexBuilder.buildOperationResultFlex({
          title: '廣告暫停止血',
          actionType: 'pause',
          targetName: res.name,
          targetId: `ad_${res.id}`,
          detail1: '已發送 API 指令將素材設為 PAUSED',
          detail2: 'Meta 廣告後台已停止該素材扣款',
        });
        await safeSendMessages(lineClient, replyToken, userId, [flex]);
      }
      return;
    }

    // 指令 4.7: 縮減預算 / 縮預算 (如: 縮預算 23851... 或 縮減預算 23851... 20%)
    const reduceMatch = trimmed.match(/^(縮減預算|縮預算|降預算|減預算)\s*([a-zA-Z0-9_]+)(?:\s*(\d+)%?)?$/i);
    if (reduceMatch) {
      const targetId = reduceMatch[2];
      const pctNum = reduceMatch[3] ? parseInt(reduceMatch[3], 10) : 20;
      const pct = pctNum / 100;
      const res = await MetaService.reduceBudget(targetId, pct);
      const flex = FlexBuilder.buildOperationResultFlex({
        title: `預算調降 ${res.percentage}%`,
        actionType: 'reduce_budget',
        targetName: res.name,
        targetId: `target_${res.id}`,
        detail1: `日預算由 ${res.oldBudgetDisplay} ➔ ${res.newBudgetDisplay}`,
        detail2: `成功縮減空間約 ${res.savedDisplay} / 天，降低風控虧損`,
      });
      await safeSendMessages(lineClient, replyToken, userId, [flex]);
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

/**
 * 處理 LINE Postback 互動按鈕點擊事件 (一鍵暫停 / 一鍵縮預算)
 */
export async function handlePostbackEvent(
  data: string,
  replyToken: string,
  lineClient: messagingApi.MessagingApiClient,
  userId?: string
): Promise<void> {
  try {
    const allowedAdmins = (config.adminUserId || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const isAuthorized = allowedAdmins.length === 0 || (userId && allowedAdmins.includes(userId));

    if (!isAuthorized) {
      console.warn(`🚨 [資安攔截] 阻擋來自未授權用戶 [${userId || '未知'}] 的 Postback 操作: "${data}"`);
      await safeSendMessages(lineClient, replyToken, userId, [
        {
          type: 'text',
          text: `🔒 權限受限：僅限授權管理員執行廣告暫停或預算調整操作。`,
        },
      ]);
      return;
    }

    if (userId) {
      lineClient.showLoadingAnimation({ chatId: userId, loadingSeconds: 20 }).catch(() => {});
    }

    const params = new URLSearchParams(data);
    const action = params.get('action');
    const id = params.get('id');
    const rawName = params.get('name');
    const name = rawName ? decodeURIComponent(rawName) : id || '';

    if (action === 'pause_ad' && id) {
      console.log(`🛑 [Postback Action] 執行暫停廣告: ${id} (${name})`);
      const result = await MetaService.pauseAd(id, name);
      const flex = FlexBuilder.buildOperationResultFlex({
        title: '素材暫停止血',
        actionType: 'pause',
        targetName: result.name,
        targetId: `ad_${result.id}`,
        detail1: '已發送 API 指令將廣告設為 PAUSED',
        detail2: 'Meta 廣告後台已停止該素材扣款與曝光',
      });
      await safeSendMessages(lineClient, replyToken, userId, [flex]);
      return;
    }

    if (action === 'pause_campaign' && id) {
      console.log(`🛑 [Postback Action] 執行暫停活動: ${id} (${name})`);
      const result = await MetaService.pauseCampaign(id, name);
      const flex = FlexBuilder.buildOperationResultFlex({
        title: '活動暫停止血',
        actionType: 'pause',
        targetName: result.name,
        targetId: `cmp_${result.id}`,
        detail1: '已發送 API 指令將整個行銷活動設為 PAUSED',
        detail2: '該活動下所有組合與素材已全面停止曝光',
      });
      await safeSendMessages(lineClient, replyToken, userId, [flex]);
      return;
    }

    if (action === 'reduce_budget' && id) {
      const percentStr = params.get('percent') || '20';
      const percent = parseFloat(percentStr) / 100;
      console.log(`📉 [Postback Action] 執行調降預算: ${id} (${name}), 幅度: ${percentStr}%`);
      const result = await MetaService.reduceBudget(id, percent);
      const flex = FlexBuilder.buildOperationResultFlex({
        title: `預算調降 ${result.percentage}%`,
        actionType: 'reduce_budget',
        targetName: result.name,
        targetId: `target_${result.id}`,
        detail1: `日預算由 ${result.oldBudgetDisplay} ➔ ${result.newBudgetDisplay}`,
        detail2: `成功縮減空間約 ${result.savedDisplay} / 天，降低風控虧損`,
      });
      await safeSendMessages(lineClient, replyToken, userId, [flex]);
      return;
    }

    await safeSendMessages(lineClient, replyToken, userId, [
      { type: 'text', text: `⚠️ 未知的操作指令：${data}` },
    ]);
  } catch (err: any) {
    console.error('❌ 執行 Postback 操作失敗:', err);
    let errorMsg = err.message || '';
    if (errorMsg.includes('permission') || errorMsg.includes('OAuthException') || errorMsg.includes('ads_management')) {
      errorMsg = `權限不足：目前的 Meta Access Token 缺少「ads_management（寫入/更新廣告）」權限。\n\n請在 Meta for Developers 將該 Token 增加 ads_management 權限後重新填入環境變數。`;
    }
    await safeSendMessages(lineClient, replyToken, userId, [
      {
        type: 'text',
        text: `❌ 操作失敗：\n${errorMsg}`,
      },
    ]);
  }
}

