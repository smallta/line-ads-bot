import { MetaService } from '../metaService.js';
import { globalStateStore, IAutomationStateStore } from './stateStore.js';
import {
  AutomationRule,
  RuleEvaluationResult,
  AuditLogRecord,
  RollbackPayload,
  AutomationScanReport,
} from './types.js';

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'rule_zero_conversion_bleed',
    name: '零轉換失血黑洞防禦',
    description: '當活動花費超過防誤殺門檻但轉換數為 0 時，自動調降 20% 預算以止血。',
    enabled: true,
    type: 'zero_conversion_bleed',
    action: 'reduce_budget_20',
    cooldownHours: 24, // 【Meta 廣告學習期防震盪標準：24 小時冷卻期】
    thresholds: {
      minSpend: 1000,  // 【可配置：低於此花費不觸發，待依各帳號預算規模校準】
    },
  },
  {
    id: 'rule_roas_crash',
    name: 'ROAS 嚴重跌破底線止血',
    description: '電商型活動 ROAS 跌破 1.0 損益平衡底線且花費達標時，自動調降 20% 預算。',
    enabled: true,
    type: 'roas_crash',
    action: 'reduce_budget_20',
    cooldownHours: 24,
    thresholds: {
      minSpend: 1000,  // 【可配置：防誤殺花費門檻】
      minRoas: 1.0,    // 【可配置：保本 ROAS 底線】
    },
  },
  {
    id: 'rule_severe_fatigue',
    name: '嚴重素材疲勞受眾飽和止血',
    description: '當素材頻率超過 3.0 且被判定為嚴重疲勞時，自動暫停以防止預算浪費與負面反感。',
    enabled: true,
    type: 'severe_fatigue',
    action: 'pause',
    cooldownHours: 24,
    thresholds: {
      minSpend: 500,            // 【可配置：素材層級花費門檻】
      frequencyThreshold: 3.0,  // 【可配置：受眾飽和頻率門檻】
    },
  },
];

export class AutomationRuleEngine {
  private rules: AutomationRule[];
  private stateStore: IAutomationStateStore;

  constructor(rules: AutomationRule[] = DEFAULT_AUTOMATION_RULES, stateStore: IAutomationStateStore = globalStateStore) {
    this.rules = rules;
    this.stateStore = stateStore;
  }

  /**
   * 檢查帳號是否具備真實寫入權限 (ads_management)
   */
  public async checkWritePermission(accountId: string): Promise<boolean> {
    try {
      const keychain = await MetaService.getKeychain();
      return keychain.some((k) => k.isWriteEnabled && k.accessibleAccounts.has(accountId));
    } catch {
      return false;
    }
  }

  /**
   * 執行全自動風控掃描
   * @param accountId 目標廣告帳號 ID
   * @param accountName 帳號名稱
   * @param dryRun 乾跑/模擬模式 (true: 僅演算與產生戰報，不真正向 Meta 發送寫入請求)
   */
  public async scanAndExecute(
    accountId: string,
    accountName: string,
    dryRun = false
  ): Promise<AutomationScanReport> {
    const isWritePermitted = await this.checkWritePermission(accountId);
    const now = Date.now();
    const timestampStr = new Date().toISOString();
    const scanId = `scan_${Date.now()}`;

    // 1. 同時獲取活躍中的活動列表與疲勞素材數據
    const [campaigns, fatiguedAds] = await Promise.all([
      MetaService.listCampaigns(accountId, 'today', 20).catch(() => []),
      MetaService.detectFatigue(accountId).catch(() => []),
    ]);

    const activeCampaigns = campaigns.filter((c) => c.status === 'ACTIVE' && c.spend > 0);
    const totalInspected = activeCampaigns.length + fatiguedAds.length;

    const results: RuleEvaluationResult[] = [];
    const logs: AuditLogRecord[] = [];

    let triggeredCount = 0;
    let executedCount = 0;
    let cooldownSuppressedCount = 0;
    let advisoryOnlyCount = 0;

    // 2. 評估行銷活動層級 (Campaign-level)
    for (const cmp of activeCampaigns) {
      for (const rule of this.rules.filter((r) => r.enabled)) {
        let isTriggered = false;
        let triggerReason = '';

        // 規則 A: 零轉換失血
        if (rule.type === 'zero_conversion_bleed') {
          if (cmp.spend >= rule.thresholds.minSpend && cmp.conversions === 0) {
            isTriggered = true;
            triggerReason = `本日已消耗 $${Math.round(cmp.spend).toLocaleString()}，轉換數為 0（已達防誤殺門檻 $${rule.thresholds.minSpend}）。`;
          }
        }

        // 規則 B: ROAS 跌破底線
        if (rule.type === 'roas_crash' && cmp.primaryMetric === 'roas') {
          if (
            cmp.spend >= rule.thresholds.minSpend &&
            cmp.roas > 0 &&
            cmp.roas < (rule.thresholds.minRoas || 1.0)
          ) {
            isTriggered = true;
            triggerReason = `本日已消耗 $${Math.round(cmp.spend).toLocaleString()}，ROAS 僅 ${cmp.roas.toFixed(2)}，低於損益平衡底線 (${rule.thresholds.minRoas || 1.0})。`;
          }
        }

        if (isTriggered) {
          triggeredCount++;
          const targetId = cmp.id;
          const targetName = cmp.name;

          // 檢查冷卻期 (Learning Phase Protection)
          const activeCooldown = await this.stateStore.getCooldown(targetId);
          if (activeCooldown) {
            cooldownSuppressedCount++;
            const remainingHours = Math.max(
              0.1,
              parseFloat(((activeCooldown.expiresAt - now) / (1000 * 3600)).toFixed(1))
            );
            results.push({
              targetId,
              targetName,
              targetType: 'campaign',
              accountId,
              accountName,
              triggeredRule: rule,
              reason: triggerReason,
              suggestedAction: rule.action,
              inCooldown: true,
              cooldownRemainingHours: remainingHours,
              isWritePermitted,
              executed: false,
              dryRun,
              actionDetail: `處於 ${remainingHours} 小時學習期冷卻保護中，抑制重複調整。`,
            });
            break; // 該活動已命中一條規則並受冷卻保護，跳往下一活動
          }

          // 未在冷卻期，評估執行
          const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          let executed = false;
          let actionDetail = '';
          let rollbackPayload: RollbackPayload | undefined;

          // 若為唯讀帳號，轉為建議模式
          if (!isWritePermitted) {
            advisoryOnlyCount++;
            actionDetail = '此帳號為唯讀授權（無 ads_management 權限），已轉為高風險建議警報。';
          } else if (dryRun) {
            actionDetail = `[模擬模式] 預計執行：調降 20% 日預算止血。`;
          } else {
            // 真實執行寫入
            try {
              if (rule.action === 'reduce_budget_20') {
                const reduceRes = await MetaService.reduceBudget(targetId, 0.2);
                executed = true;
                executedCount++;
                actionDetail = `已自動調降 20% 預算（${reduceRes.oldBudgetDisplay} ➔ ${reduceRes.newBudgetDisplay}，日省約 ${reduceRes.savedDisplay}）。`;

                // 解析原始日預算 (美分/分轉整數)
                const oldRaw = parseInt(reduceRes.oldBudgetDisplay.replace(/[$,]/g, ''), 10);
                rollbackPayload = {
                  targetId,
                  targetName,
                  targetType: 'campaign',
                  actionType: 'reduce_budget',
                  originalRawBudget: oldRaw,
                  budgetField: reduceRes.budgetType === 'daily' ? 'daily_budget' : 'lifetime_budget',
                  reducedByPercentage: 20,
                };
              } else if (rule.action === 'pause') {
                await MetaService.pauseCampaign(targetId, targetName);
                executed = true;
                executedCount++;
                actionDetail = '已發送 API 指令將活動設為 PAUSED 停止扣款。';
                rollbackPayload = {
                  targetId,
                  targetName,
                  targetType: 'campaign',
                  actionType: 'pause',
                  originalStatus: 'ACTIVE',
                };
              }

              // 進入冷卻期保護 (24 小時)
              await this.stateStore.setCooldown({
                targetId,
                targetName,
                ruleId: rule.id,
                ruleName: rule.name,
                actionTaken: actionDetail,
                triggeredAt: now,
                expiresAt: now + rule.cooldownHours * 3600 * 1000,
              });
            } catch (err: any) {
              actionDetail = `執行失敗: ${err.message}`;
            }
          }

          // 記錄 Audit Log
          const auditLog: AuditLogRecord = {
            id: logId,
            timestamp: timestampStr,
            accountId,
            accountName,
            targetId,
            targetName,
            targetType: 'campaign',
            ruleId: rule.id,
            ruleName: rule.name,
            reason: triggerReason,
            actionTaken: actionDetail,
            isDryRun: dryRun,
            isWritePermitted,
            rolledBack: false,
            rollbackPayload,
          };

          if (executed || dryRun || !isWritePermitted) {
            await this.stateStore.recordAuditLog(auditLog);
            logs.push(auditLog);
          }

          results.push({
            targetId,
            targetName,
            targetType: 'campaign',
            accountId,
            accountName,
            triggeredRule: rule,
            reason: triggerReason,
            suggestedAction: rule.action,
            inCooldown: false,
            isWritePermitted,
            executed,
            dryRun,
            actionDetail,
            logId,
            rollbackPayload,
          });

          break; // 單一活動命中最高優先級規則後，跳往下一活動
        }
      }
    }

    // 3. 評估素材層級 (Ad-level Fatigue)
    for (const ad of fatiguedAds) {
      const rule = this.rules.find((r) => r.type === 'severe_fatigue' && r.enabled);
      if (!rule) continue;

      if (ad.frequency >= (rule.thresholds.frequencyThreshold || 3.0) || ad.triggersMet >= 2) {
        triggeredCount++;
        const targetId = ad.adId;
        const targetName = ad.adName;

        // 檢查冷卻
        const activeCooldown = await this.stateStore.getCooldown(targetId);
        if (activeCooldown) {
          cooldownSuppressedCount++;
          const remainingHours = Math.max(
            0.1,
            parseFloat(((activeCooldown.expiresAt - now) / (1000 * 3600)).toFixed(1))
          );
          results.push({
            targetId,
            targetName,
            targetType: 'ad',
            accountId,
            accountName,
            triggeredRule: rule,
            reason: `頻率高達 ${ad.frequency.toFixed(2)}，受眾過度飽和（觸發 ${ad.triggersMet} 項疲勞指標，點擊率下滑 ${ad.ctrDropPct}%）。`,
            suggestedAction: rule.action,
            inCooldown: true,
            cooldownRemainingHours: remainingHours,
            isWritePermitted,
            executed: false,
            dryRun,
            actionDetail: `處於 ${remainingHours} 小時冷卻期，抑制重複處理。`,
          });
          continue;
        }

        const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        let executed = false;
        let actionDetail = '';
        let rollbackPayload: RollbackPayload | undefined;

        if (!isWritePermitted) {
          advisoryOnlyCount++;
          actionDetail = '唯讀帳號：已產生素材疲勞止血建議。';
        } else if (dryRun) {
          actionDetail = '[模擬模式] 預計執行：暫停疲勞素材。';
        } else {
          try {
            await MetaService.pauseAd(targetId, targetName);
            executed = true;
            executedCount++;
            actionDetail = '已發送 API 指令將疲勞素材設為 PAUSED 停止吸血。';
            rollbackPayload = {
              targetId,
              targetName,
              targetType: 'ad',
              actionType: 'pause',
              originalStatus: 'ACTIVE',
            };

            await this.stateStore.setCooldown({
              targetId,
              targetName,
              ruleId: rule.id,
              ruleName: rule.name,
              actionTaken: actionDetail,
              triggeredAt: now,
              expiresAt: now + rule.cooldownHours * 3600 * 1000,
            });
          } catch (err: any) {
            actionDetail = `執行失敗: ${err.message}`;
          }
        }

        const auditLog: AuditLogRecord = {
          id: logId,
          timestamp: timestampStr,
          accountId,
          accountName,
          targetId,
          targetName,
          targetType: 'ad',
          ruleId: rule.id,
          ruleName: rule.name,
          reason: `素材頻率 ${ad.frequency.toFixed(2)} 飽和（觸發 ${ad.triggersMet} 項疲勞指標，點擊率下滑 ${ad.ctrDropPct}%）。`,
          actionTaken: actionDetail,
          isDryRun: dryRun,
          isWritePermitted,
          rolledBack: false,
          rollbackPayload,
        };

        if (executed || dryRun || !isWritePermitted) {
          await this.stateStore.recordAuditLog(auditLog);
          logs.push(auditLog);
        }

        results.push({
          targetId,
          targetName,
          targetType: 'ad',
          accountId,
          accountName,
          triggeredRule: rule,
          reason: `頻率高達 ${ad.frequency.toFixed(2)}，受眾嚴重疲勞。`,
          suggestedAction: rule.action,
          inCooldown: false,
          isWritePermitted,
          executed,
          dryRun,
          actionDetail,
          logId,
          rollbackPayload,
        });
      }
    }

    return {
      id: scanId,
      accountId,
      accountName,
      timestamp: timestampStr,
      dryRun,
      totalInspected,
      triggeredCount,
      executedCount,
      cooldownSuppressedCount,
      advisoryOnlyCount,
      results,
      logs,
    };
  }
}
