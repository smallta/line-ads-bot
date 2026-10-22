import { messagingApi } from '@line/bot-sdk';
import { config, runtimeState } from '../config.js';
import { AutomationService } from '../automation/automationService.js';
import { FlexBuilder } from '../formatters/flexBuilder.js';

let lastBleedGuardTimestamp = 0;
let isBleedGuardRunning = false;

export async function pushDailyBleedGuard(options: { dryRun?: boolean; force?: boolean } = {}) {
  const now = Date.now();
  const COOLDOWN_MS = 10 * 60 * 1000; // 10 分鐘防重複呼叫保護
  const isDryRun = options.dryRun ?? false;

  if (!options.force) {
    if (isBleedGuardRunning) {
      console.log('⏳ [DeDup Lock] 自動風控巡檢正在處理中，自動略過重複呼叫。');
      return;
    }
    if (now - lastBleedGuardTimestamp < COOLDOWN_MS) {
      const elapsedSec = Math.round((now - lastBleedGuardTimestamp) / 1000);
      console.log(`⏳ [DeDup Lock] 今日自動風控已於 ${elapsedSec} 秒前成功執行，自動略過排程。`);
      return;
    }
  }

  isBleedGuardRunning = true;

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

    console.log(`🛡️ [BleedGuard] 正在為【${runtimeState.currentAccountName}】執行每日自動風控巡檢 (dryRun: ${isDryRun})...`);

    const report = await AutomationService.runScan(
      runtimeState.currentAdAccountId,
      runtimeState.currentAccountName,
      isDryRun
    );

    const flex = FlexBuilder.buildAutomationScanFlex(report);
    const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: token });

    for (const adminId of adminIds) {
      try {
        await lineClient.pushMessage({
          to: adminId,
          messages: [flex],
        });
        console.log(`✅ [BleedGuard] 成功向管理員 [${adminId}] 推送每日自動風控巡檢戰報！`);
      } catch (pushErr: any) {
        console.error(`❌ [BleedGuard] 推送至管理員 [${adminId}] 失敗:`, pushErr.message);
      }
    }

    lastBleedGuardTimestamp = Date.now();
  } catch (err: any) {
    console.error('❌ [BleedGuard] 執行每日自動風控失敗:', err.message);
    throw err;
  } finally {
    isBleedGuardRunning = false;
  }
}
