import { messagingApi } from '@line/bot-sdk';
import { config, runtimeState } from '../config.js';
import { MetaService } from '../metaService.js';
import { FlexBuilder } from '../formatters/flexBuilder.js';
import { generateCleanedDiagnosticReport } from '../pipelineReport.js';
import { AIAgent } from '../aiAgent.js';
import { AccountManager } from '../accountManager.js';

let lastMorningBriefTimestamp = 0;
let isBriefRunning = false;

export async function pushMorningBrief(options: { force?: boolean } = {}) {
  const now = Date.now();
  const COOLDOWN_MS = 30 * 60 * 1000; // 30 分鐘防重複推播冷卻

  if (!options.force) {
    if (isBriefRunning) {
      console.log('⏳ [DeDup Lock] 晨報推播正在處理中，自動略過並發請求。');
      return;
    }
    if (now - lastMorningBriefTimestamp < COOLDOWN_MS) {
      const elapsedSec = Math.round((now - lastMorningBriefTimestamp) / 1000);
      console.log(`⏳ [DeDup Lock] 今日晨報已於 ${elapsedSec} 秒前成功推送，自動略過重複排程請求。`);
      return;
    }
  }

  isBriefRunning = true;

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
      console.error('❌ 推播失敗：未設定 ADMIN_LINE_USER_ID（請在環境變數填入您的 LINE User ID）');
      return;
    }

    console.log(`🚀 正在向管理員名單 [${adminIds.join(', ')}] 推送每日廣告成效晨報...`);
    const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: token });

    // 1. 抓取大盤數據
    const metrics = await MetaService.getAccountOverview(runtimeState.currentAdAccountId, 'last_7d');
    const overviewFlex = FlexBuilder.buildOverviewFlex(metrics);

    // 2. 檢測是否有疲勞素材
    const fatigued = await MetaService.detectFatigue(runtimeState.currentAdAccountId);

    const messages: messagingApi.Message[] = [overviewFlex];
    if (fatigued.length > 0) {
      console.log(`⚠️ 發現 ${fatigued.length} 支疲勞素材，附加警報卡片...`);
      const fatigueFlex = FlexBuilder.buildFatigueFlex(fatigued, runtimeState.currentAccountName);
      messages.push(fatigueFlex);
    }

    // 3. 執行標準化清洗日報 (昨日 vs 7日基準線) 並由 Gemini 產出顧問診斷摘要
    try {
      const cleanedPayload = await generateCleanedDiagnosticReport({
        account: runtimeState.currentAdAccountId,
      });
      const aiDiagnosis = await AIAgent.generateMorningAiDiagnosis(
        cleanedPayload,
        runtimeState.currentAccountName
      );
      if (aiDiagnosis) {
        messages.push({
          type: 'text',
          text: `🤖 【AI 跨維度日報診斷｜${cleanedPayload.report_date}】\n${aiDiagnosis}`,
        });
      }
    } catch (aiErr: any) {
      console.warn('⚠️ [MorningBrief] AI 清洗日報診斷生成略過:', aiErr.message);
    }

    for (const adminId of adminIds) {
      await lineClient.pushMessage({
        to: adminId,
        messages,
      });
      console.log(`✅ 已送達管理員 [${adminId}] LINE 聊天室。`);
    }

    lastMorningBriefTimestamp = Date.now();
    console.log('✅ 晨報推播程序全部完成！');
  } catch (err: any) {
    console.error('❌ 推播過程發生錯誤：', err.message);
    throw err;
  } finally {
    isBriefRunning = false;
  }
}

// 支援命令列獨立執行 (例如 npm run push-brief 或 node dist/cron/pushMorningBrief.js --account=悅姿醫美)
if (process.argv[1]?.endsWith('pushMorningBrief.js') || process.argv[1]?.endsWith('pushMorningBrief.ts')) {
  const accArg = process.argv.slice(2).find((a) => a.startsWith('--account='))?.split('=')[1];
  (async () => {
    if (accArg) {
      await AccountManager.matchAndSwitchAccount(accArg);
    }
    await pushMorningBrief({ force: true });
  })();
}
