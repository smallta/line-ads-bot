/**
 * 廣告全自動化風控與冷卻防呆引擎 - 型別定義
 */

export type RuleType =
  | 'zero_conversion_bleed' // 零轉換失血黑洞
  | 'cpa_spike'             // 獲客成本暴衝
  | 'roas_crash'            // 投報跌破底線
  | 'severe_fatigue';       // 嚴重素材疲勞受眾飽和

export type AutomationActionType =
  | 'reduce_budget_20'      // 調降 20% 預算 (安全調幅，保護學習期)
  | 'pause'                 // 暫停廣告/活動
  | 'alert_only';           // 僅發送警報 (唯讀帳號或觀察期)

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: RuleType;
  action: AutomationActionType;
  cooldownHours: number;    // 【Meta 廣告學習期防震盪標準：預設 24 小時】
  thresholds: {
    minSpend: number;               // 【防誤殺花費門檻：低於此消耗不觸發，待依帳號校準】
    maxCpaMultiplier?: number;      // 【CPA 暴衝倍數：高於帳號基準倍數，預設 1.5】
    minRoas?: number;               // 【ROAS 損益底線：跌破此值視為虧損，預設 1.0】
    frequencyThreshold?: number;    // 【受眾飽和頻率門檻：預設 3.0】
    ctrDropPercent?: number;        // 【點擊率崩跌幅度：預設 30%】
  };
}

export interface CooldownRecord {
  targetId: string;
  targetName: string;
  ruleId: string;
  ruleName: string;
  actionTaken: string;
  triggeredAt: number;     // Unix timestamp (ms)
  expiresAt: number;       // Unix timestamp (ms)
}

export interface RollbackPayload {
  targetId: string;
  targetName: string;
  targetType: 'campaign' | 'adset' | 'ad';
  actionType: 'reduce_budget' | 'pause';
  originalStatus?: 'ACTIVE' | 'PAUSED';
  originalRawBudget?: number;
  budgetField?: 'daily_budget' | 'lifetime_budget';
  reducedByPercentage?: number;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  accountId: string;
  accountName: string;
  targetId: string;
  targetName: string;
  targetType: 'campaign' | 'adset' | 'ad';
  ruleId: string;
  ruleName: string;
  reason: string;
  actionTaken: string;
  isDryRun: boolean;
  isWritePermitted: boolean;
  rolledBack: boolean;
  rolledBackAt?: string;
  rollbackPayload?: RollbackPayload;
}

export interface RuleEvaluationResult {
  targetId: string;
  targetName: string;
  targetType: 'campaign' | 'adset' | 'ad';
  accountId: string;
  accountName: string;
  triggeredRule?: AutomationRule;
  reason: string;
  suggestedAction: AutomationActionType;
  inCooldown: boolean;
  cooldownRemainingHours?: number;
  isWritePermitted: boolean;
  executed: boolean;
  dryRun: boolean;
  actionDetail?: string;
  logId?: string;
  rollbackPayload?: RollbackPayload;
}

export interface AutomationScanReport {
  id: string;
  accountId: string;
  accountName: string;
  timestamp: string;
  dryRun: boolean;
  totalInspected: number;
  triggeredCount: number;
  executedCount: number;
  cooldownSuppressedCount: number;
  advisoryOnlyCount: number;
  results: RuleEvaluationResult[];
  logs: AuditLogRecord[];
}

export interface RollbackResult {
  success: boolean;
  logId: string;
  targetId: string;
  targetName: string;
  restoredAction: string;
  message: string;
}
