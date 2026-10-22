import { MetaService } from '../metaService.js';
import { AutomationRuleEngine } from './ruleEngine.js';
import { globalStateStore } from './stateStore.js';
import { AutomationScanReport, RollbackResult, AuditLogRecord } from './types.js';

export class AutomationService {
  private static engine = new AutomationRuleEngine();

  /**
   * 執行自動化風控掃描
   * @param accountId 目標廣告帳號 ID
   * @param accountName 帳號名稱
   * @param dryRun 乾跑/模擬模式 (true: 只做推演不真正寫入 Meta API)
   */
  public static async runScan(
    accountId: string,
    accountName: string,
    dryRun = false
  ): Promise<AutomationScanReport> {
    return this.engine.scanAndExecute(accountId, accountName, dryRun);
  }

  /**
   * 一鍵復原操作 (Rollback / Undo)
   * 復原先前被自動化調降之預算或重新開啟被暫停之素材
   * @param logId 審查日誌 ID
   */
  public static async rollbackAction(logId: string): Promise<RollbackResult> {
    const log = await globalStateStore.getAuditLogById(logId);
    if (!log) {
      return {
        success: false,
        logId,
        targetId: '',
        targetName: '',
        restoredAction: 'none',
        message: `找不到對應的審查日誌紀錄 (${logId})。`,
      };
    }

    if (log.rolledBack) {
      return {
        success: false,
        logId,
        targetId: log.targetId,
        targetName: log.targetName,
        restoredAction: 'none',
        message: `該項操作已於 ${log.rolledBackAt} 復原過，不可重複復原。`,
      };
    }

    if (log.isDryRun) {
      await globalStateStore.markRolledBack(logId);
      return {
        success: true,
        logId,
        targetId: log.targetId,
        targetName: log.targetName,
        restoredAction: 'mark_rolled_back',
        message: `此紀錄為模擬運行 (Dry-run)，已標記為撤銷。`,
      };
    }

    const payload = log.rollbackPayload;
    if (!payload) {
      return {
        success: false,
        logId,
        targetId: log.targetId,
        targetName: log.targetName,
        restoredAction: 'none',
        message: `該紀錄缺少復原參數 (Rollback Payload)，無法自動還原。`,
      };
    }

    try {
      if (payload.actionType === 'reduce_budget') {
        if (!payload.originalRawBudget) {
          throw new Error('缺少原始日預算金額資料');
        }
        const setRes = await MetaService.setBudget(
          payload.targetId,
          payload.originalRawBudget,
          payload.budgetField || 'daily_budget'
        );
        await globalStateStore.markRolledBack(logId);
        return {
          success: true,
          logId,
          targetId: payload.targetId,
          targetName: payload.targetName,
          restoredAction: 'restore_budget',
          message: `已成功將【${payload.targetName}】日預算調回原始水準 (${setRes.newBudgetDisplay})，並解除 24 小時冷卻鎖定！`,
        };
      } else if (payload.actionType === 'pause') {
        if (payload.targetType === 'ad') {
          await MetaService.resumeAd(payload.targetId, payload.targetName);
        } else {
          await MetaService.resumeCampaign(payload.targetId, payload.targetName);
        }
        await globalStateStore.markRolledBack(logId);
        return {
          success: true,
          logId,
          targetId: payload.targetId,
          targetName: payload.targetName,
          restoredAction: 'resume',
          message: `已成功重新啟用【${payload.targetName}】(設為 ACTIVE)，並解除冷卻鎖定！`,
        };
      }

      throw new Error(`未知的復原操作類型: ${payload.actionType}`);
    } catch (err: any) {
      return {
        success: false,
        logId,
        targetId: payload.targetId,
        targetName: payload.targetName,
        restoredAction: 'failed',
        message: `復原失敗：${err.message}`,
      };
    }
  }

  /**
   * 取得最近的自動化審查日誌
   */
  public static async getLogs(limit = 10): Promise<AuditLogRecord[]> {
    return globalStateStore.getAuditLogs(limit);
  }
}
