import { messagingApi } from '@line/bot-sdk';
import { config, runtimeState } from '../config.js';
import { MetaService } from '../metaService.js';
import { FlexBuilder } from '../formatters/flexBuilder.js';

export async function pushWeeklyReport() {
  const token = config.line.channelAccessToken;

  if (!token) {
    console.error('❌ 週報推播失敗：未設定 LINE_CHANNEL_ACCESS_TOKEN');
    return;
  }
  const adminIds = (config.adminUserId || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (adminIds.length === 0) {
    console.error('❌ 週報推播失敗：未設定 ADMIN_LINE_USER_ID（請在環境變數填入您的 LINE User ID）');
    return;
  }

  console.log(`📊 正在向管理員名單 [${adminIds.join(', ')}] 推送【${runtimeState.currentAccountName}】每週廣告成效週報...`);
  const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: token });

  try {
    // 1. 抓取大盤週數據 (以近 7 天綜合指標為主)
    const metrics = await MetaService.getAccountOverview(runtimeState.currentAdAccountId, 'last_7d');

    // 2. 抓取本週活躍活動列表 Top 5
    const campaigns = await MetaService.listCampaigns(runtimeState.currentAdAccountId, 'last_7d', 5);

    // 3. 檢測是否有疲勞素材
    const fatigued = await MetaService.detectFatigue(runtimeState.currentAdAccountId);

    // 4. 構建週報專用 Flex 卡片
    const weeklyFlex = FlexBuilder.buildWeeklyReportFlex(
      metrics,
      campaigns,
      fatigued,
      runtimeState.currentAccountName,
      '過去 7 天全盤數據'
    );

    for (const adminId of adminIds) {
      await lineClient.pushMessage({
        to: adminId,
        messages: [weeklyFlex],
      });
      console.log(`✅ 每週廣告成效週報已送達管理員 [${adminId}] LINE 聊天室！`);
    }

    console.log('✅ 每週廣告成效週報推播程序全部完成！');
  } catch (err: any) {
    console.error('❌ 週報推播過程發生錯誤：', err.message);
    throw err;
  }
}

// 支援命令列獨立執行 (例如 npm run push-weekly)
if (process.argv[1]?.endsWith('pushWeeklyReport.js') || process.argv[1]?.endsWith('pushWeeklyReport.ts')) {
  pushWeeklyReport();
}
