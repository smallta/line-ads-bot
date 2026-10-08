import { messagingApi } from '@line/bot-sdk';
import { config, runtimeState } from '../config.js';
import { MetaService } from '../metaService.js';
import { FlexBuilder } from '../formatters/flexBuilder.js';

let lastWeeklyReportTimestamp = 0;
let isWeeklyRunning = false;

export async function pushWeeklyReport(options: { force?: boolean } = {}) {
  const now = Date.now();
  const COOLDOWN_MS = 60 * 60 * 1000; // 60 分鐘防重複推播冷卻

  if (!options.force) {
    if (isWeeklyRunning) {
      console.log('⏳ [DeDup Lock] 週報推播正在處理中，自動略過並發請求。');
      return;
    }
    if (now - lastWeeklyReportTimestamp < COOLDOWN_MS) {
      const elapsedSec = Math.round((now - lastWeeklyReportTimestamp) / 1000);
      console.log(`⏳ [DeDup Lock] 本週週報已於 ${elapsedSec} 秒前成功推送，自動略過重複排程請求。`);
      return;
    }
  }

  isWeeklyRunning = true;

  try {
    const token = config.line.channelAccessToken;

    if (!token) {
      console.error('❌ 週報推播失敗：未設定 LINE_CHANNEL_ACCESS_TOKEN');
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
      console.error('❌ 週報推播失敗：未設定 ADMIN_LINE_USER_ID（請在環境變數填入您的 LINE User ID）');
      return;
    }

    console.log(`📊 正在向管理員名單 [${adminIds.join(', ')}] 推送【${runtimeState.currentAccountName}】每週廣告成效週報...`);
    const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: token });

    // 1. 抓取大盤週數據 (包含 WoW 環比)
    const [weeklyComp, campaigns, fatigued] = await Promise.all([
      MetaService.getWeeklyComparison(runtimeState.currentAdAccountId),
      MetaService.listCampaigns(runtimeState.currentAdAccountId, 'last_7d', 5),
      MetaService.detectFatigue(runtimeState.currentAdAccountId),
    ]);

    // 2. 構建週報專用 Flex 卡片 (含 WoW 環比與資本配置指引)
    const weeklyFlex = FlexBuilder.buildWeeklyReportFlex(
      weeklyComp.current,
      campaigns,
      fatigued,
      runtimeState.currentAccountName,
      '過去 7 天綜合數據',
      weeklyComp.delta
    );

    for (const adminId of adminIds) {
      await lineClient.pushMessage({
        to: adminId,
        messages: [weeklyFlex],
      });
      console.log(`✅ 每週廣告成效週報已送達管理員 [${adminId}] LINE 聊天室！`);
    }

    lastWeeklyReportTimestamp = Date.now();
    console.log('✅ 每週廣告成效週報推播程序全部完成！');
  } catch (err: any) {
    console.error('❌ 週報推播過程發生錯誤：', err.message);
    throw err;
  } finally {
    isWeeklyRunning = false;
  }
}

// 支援命令列獨立執行 (例如 npm run push-weekly)
if (process.argv[1]?.endsWith('pushWeeklyReport.js') || process.argv[1]?.endsWith('pushWeeklyReport.ts')) {
  pushWeeklyReport();
}
