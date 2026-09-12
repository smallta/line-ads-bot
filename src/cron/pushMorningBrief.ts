import { messagingApi } from '@line/bot-sdk';
import { config, runtimeState } from '../config.js';
import { MetaService } from '../metaService.js';
import { FlexBuilder } from '../formatters/flexBuilder.js';

export async function pushMorningBrief() {
  const adminId = config.adminUserId;
  const token = config.line.channelAccessToken;

  if (!token) {
    console.error('❌ 推播失敗：未設定 LINE_CHANNEL_ACCESS_TOKEN');
    return;
  }
  if (!adminId) {
    console.error('❌ 推播失敗：未設定 ADMIN_LINE_USER_ID（請在 .env 中填入您的 LINE User ID）');
    return;
  }

  console.log(`🚀 正在向管理員 [${adminId}] 推送每日廣告成效晨報...`);
  const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: token });

  try {
    // 1. 抓取大盤數據
    const metrics = await MetaService.getAccountOverview(runtimeState.currentAdAccountId, 'last_7d');
    const overviewFlex = FlexBuilder.buildOverviewFlex(metrics);

    // 2. 檢測是否有疲勞素材
    const fatigued = await MetaService.detectFatigue(runtimeState.currentAdAccountId);

    const messages = [overviewFlex];
    if (fatigued.length > 0) {
      console.log(`⚠️ 發現 ${fatigued.length} 支疲勞素材，附加警報卡片...`);
      const fatigueFlex = FlexBuilder.buildFatigueFlex(fatigued, runtimeState.currentAccountName);
      messages.push(fatigueFlex);
    }

    await lineClient.pushMessage({
      to: adminId,
      messages,
    });

    console.log('✅ 晨報推播成功！已送達管理員 LINE 聊天室。');
  } catch (err: any) {
    console.error('❌ 推播過程發生錯誤：', err.message);
  }
}

// 支援命令列獨立執行 (例如 npm run push-brief)
if (process.argv[1]?.endsWith('pushMorningBrief.js') || process.argv[1]?.endsWith('pushMorningBrief.ts')) {
  pushMorningBrief();
}
