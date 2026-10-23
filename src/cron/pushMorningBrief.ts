import { messagingApi } from '@line/bot-sdk';
import { config, runtimeState, CORE_MONITORED_ACCOUNTS } from '../config.js';
import { MetaService } from '../metaService.js';
import { FlexBuilder } from '../formatters/flexBuilder.js';
import { generateCleanedDiagnosticReport } from '../pipelineReport.js';
import { AIAgent } from '../aiAgent.js';
import { AccountManager } from '../accountManager.js';

let lastMorningBriefTimestamp = 0;
let isBriefRunning = false;

export async function pushMorningBrief(options: { force?: boolean; account?: string } = {}) {
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

    const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: token });

    // 依操盤手專注原則：每日晨報自動推播預設只推「當前單一主力帳號」（不連續轟炸多帳號）
    // 其他帳號隨時可在 LINE 輸入「看一起夢想」、「看悅姿醫美」隨選調閱
    const targetAccountInputs = options.account
      ? [options.account]
      : process.env.MULTI_ACCOUNT_PATROL === 'true'
        ? CORE_MONITORED_ACCOUNTS
        : [runtimeState.currentAdAccountId];

    console.log(`🚀 正在產出目標帳號 [${targetAccountInputs.join(', ')}] 的每日成效晨報...`);

    let pushedCount = 0;

    for (const accInput of targetAccountInputs) {
      try {
        const matchRes = await AccountManager.matchAndSwitchAccount(accInput);
        const targetId = matchRes.account ? matchRes.account.id : runtimeState.currentAdAccountId;
        const targetName = matchRes.account ? (matchRes.account.shortName || matchRes.account.name) : runtimeState.currentAccountName;

        console.log(`\n🔍 [巡檢中] 正在檢查【${targetName}】(${targetId}) 昨日花費...`);

        // 1. 先跑清洗報告以確認昨日是否有花費
        const cleanedPayload = await generateCleanedDiagnosticReport({
          account: targetId,
        });

        // 🌟 防轟炸鐵則：若昨日無花費 ($0)，自動靜默略過，不騷擾管理員
        if (cleanedPayload.today_metrics.ad_spend === 0) {
          console.log(`⏩ 【${targetName}】昨日花費為 $0（未投遞），自動略過推播。`);
          continue;
        }

        console.log(
          `🔥 【${targetName}】昨日有投遞（花費 $${cleanedPayload.today_metrics.ad_spend}），正在產出診斷與告警卡片...`
        );

        // 2. 抓取大盤與疲勞素材
        const [metrics, fatigued] = await Promise.all([
          MetaService.getAccountOverview(targetId, 'last_7d'),
          MetaService.detectFatigue(targetId),
        ]);

        const messages: messagingApi.Message[] = [
          FlexBuilder.buildOverviewFlex(metrics),
        ];

        if (fatigued.length > 0) {
          console.log(`⚠️ 【${targetName}】發現 ${fatigued.length} 支疲勞素材，附加警報卡片...`);
          messages.push(FlexBuilder.buildFatigueFlex(fatigued, targetName));
        }

        // 3. 附加「🚨 每日異常告警與基準比對」Flex 卡片
        const diagnosticFlex = FlexBuilder.buildCleanedDiagnosticFlex(
          cleanedPayload,
          targetName
        );
        messages.push(diagnosticFlex);

        // 4. 附加「🤖 AI 顧問根因拆解與今日 P0/P1 動作」純文字
        try {
          const aiDiagnosis = await AIAgent.generateMorningAiDiagnosis(
            cleanedPayload,
            targetName
          );
          if (aiDiagnosis) {
            messages.push({
              type: 'text',
              text: `🤖 【AI 顧問根因拆解與今日動作｜${cleanedPayload.report_date}】\n\n${aiDiagnosis}`,
            });
          }
        } catch (aiErr: any) {
          console.warn(`⚠️ 【${targetName}】AI 清洗日報診斷生成略過:`, aiErr.message);
        }

        // 5. 推播至管理員 LINE
        for (const adminId of adminIds) {
          await lineClient.pushMessage({
            to: adminId,
            messages,
          });
        }

        pushedCount++;
        console.log(`✅ 【${targetName}】晨報與診斷卡片已成功推播至 LINE！`);

        // 帳號間間隔 1.5 秒，確保 LINE API 頻率友善
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (accErr: any) {
        console.error(`❌ 【${accInput}】巡檢過程發生錯誤:`, accErr.message);
      }
    }

    if (pushedCount === 0) {
      console.log('ℹ️ 所有指定核心帳號昨日均無投遞花費 ($0)，今日無須發送推播。');
    }

    lastMorningBriefTimestamp = Date.now();
    console.log(`\n✅ 每日晨報核心帳號巡檢全部完成！共推播 ${pushedCount} 個有花費之帳號。`);
  } catch (err: any) {
    console.error('❌ 推播過程發生錯誤：', err.message);
    throw err;
  } finally {
    isBriefRunning = false;
  }
}

// 支援命令列獨立執行 (例如 npm run push-brief 或 node dist/cron/pushMorningBrief.js --account=生鮮美食)
if (process.argv[1]?.endsWith('pushMorningBrief.js') || process.argv[1]?.endsWith('pushMorningBrief.ts')) {
  const accArg = process.argv.slice(2).find((a) => a.startsWith('--account='))?.split('=')[1];
  (async () => {
    await pushMorningBrief({ force: true, account: accArg });
  })();
}
