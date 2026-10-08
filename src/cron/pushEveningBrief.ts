import { messagingApi } from '@line/bot-sdk';
import { config, runtimeState } from '../config.js';
import { MetaService } from '../metaService.js';
import { FlexBuilder } from '../formatters/flexBuilder.js';

let lastEveningBriefTimestamp = 0;
let isEveningRunning = false;

export async function pushEveningBrief(options: { force?: boolean } = {}) {
  const now = Date.now();
  const COOLDOWN_MS = 30 * 60 * 1000; // 30 分鐘防重複推播冷卻

  if (!options.force) {
    if (isEveningRunning) {
      console.log('⏳ [DeDup Lock] 今日成效晚報推播正在處理中，自動略過並發請求。');
      return;
    }
    if (now - lastEveningBriefTimestamp < COOLDOWN_MS) {
      const elapsedSec = Math.round((now - lastEveningBriefTimestamp) / 1000);
      console.log(`⏳ [DeDup Lock] 今日晚報已於 ${elapsedSec} 秒前成功推送，自動略過重複排程請求。`);
      return;
    }
  }

  isEveningRunning = true;

  try {
    const token = config.line.channelAccessToken;

    if (!token) {
      console.error('❌ 推播失敗：未設定 LINE_CHANNEL_ACCESS_TOKEN');
      return;
    }
    const adminIds = Array.from(
      new Set(
        (config.adminUserId || '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      )
    );

    if (adminIds.length === 0) {
      console.error('❌ 推播失敗：未設定 ADMIN_LINE_USER_ID');
      return;
    }

    console.log(`🌙 正在向管理員名單 [${adminIds.join(', ')}] 推送【${runtimeState.currentAccountName}】今日成效日落晚報...`);
    const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: token });

    // 1. 抓取今日即時大盤數據與活動排行
    const [todayMetrics, todayCampaigns] = await Promise.all([
      MetaService.getAccountOverview(runtimeState.currentAdAccountId, 'today'),
      MetaService.listCampaigns(runtimeState.currentAdAccountId, 'today', 5),
    ]);

    const overviewFlex = FlexBuilder.buildOverviewFlex(todayMetrics);
    const messages: messagingApi.FlexMessage[] = [overviewFlex];

    // 若今日有跑廣告活動，附加當日活動排行榜
    const activeTodayCampaigns = todayCampaigns.filter((c) => c.spend > 0 || c.conversions > 0);
    if (activeTodayCampaigns.length > 0) {
      const campaignsFlex = FlexBuilder.buildCampaignsFlex(activeTodayCampaigns, runtimeState.currentAccountName);
      messages.push(campaignsFlex);
    }

    for (const adminId of adminIds) {
      await lineClient.pushMessage({
        to: adminId,
        messages: messages as any,
      });
      console.log(`✅ 今日成效晚報已送達管理員 [${adminId}] LINE 聊天室。`);
    }

    lastEveningBriefTimestamp = Date.now();
    console.log('✅ 今日成效晚報推播程序全部完成！');
  } catch (err: any) {
    console.error('❌ 今日成效晚報推播過程發生錯誤：', err.message);
    throw err;
  } finally {
    isEveningRunning = false;
  }
}

// 支援命令列獨立執行 (例如 npm run push-evening)
if (process.argv[1]?.endsWith('pushEveningBrief.js') || process.argv[1]?.endsWith('pushEveningBrief.ts')) {
  pushEveningBrief();
}
