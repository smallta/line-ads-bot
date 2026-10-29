import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RULES_FILE = path.resolve(__dirname, '../../config/ad_rules.json');

export interface SafetyLimits {
  cooldown_hours: number;
  max_budget_cut_pct: number;
  min_cut_interval_days: number;
  max_consecutive_cuts: number;
  max_budget_increase_pct: number;
  max_weekly_increase_pct: number;
  max_daily_budget_transfer_pct: number;
  max_auto_pause_per_14d: number;
  never_pause_last_active_campaign: boolean;
  top_performing_protection_count: number;
  never_delete_always_pause: boolean;
}

export interface UnreliableDataGuards {
  new_ad_observation_days: number;
  min_weekly_conversions_for_scale: number;
  min_clicks_for_eval: number;
  target_cpa_spend_multiplier: number;
  sudden_conversion_drop_threshold: number;
  meta_attribution_lag_days: number;
  year_end_blackout_periods: Array<{ start: string; end: string; reason: string }>;
}

export interface CampaignTypeRule {
  name: string;
  regex: string;
  rules: Record<string, any>;
}

export interface AdRulesConfig {
  version: string;
  updated_at: string;
  description: string;
  safety_limits: SafetyLimits;
  unreliable_data_guards: UnreliableDataGuards;
  campaign_types: Record<string, CampaignTypeRule>;
  default_account_baselines: Record<string, any>;
}

class RuleLoader {
  private config: AdRulesConfig | null = null;

  public loadRules(): AdRulesConfig {
    if (this.config) return this.config;

    try {
      if (fs.existsSync(RULES_FILE)) {
        const raw = fs.readFileSync(RULES_FILE, 'utf-8');
        this.config = JSON.parse(raw);
        console.log(`📋 [RuleLoader] 成功載入廣告規則庫 v${this.config?.version} (${this.config?.updated_at})`);
        return this.config!;
      }
    } catch (err: any) {
      console.warn('⚠️ [RuleLoader] 讀取 ad_rules.json 失敗，將使用代碼預設安全規則:', err.message);
    }

    // Fallback 預設安全規則
    this.config = {
      version: '1.0.0-fallback',
      updated_at: new Date().toISOString(),
      description: 'Fallback Safety Rules',
      safety_limits: {
        cooldown_hours: 72,
        max_budget_cut_pct: 40,
        min_cut_interval_days: 14,
        max_consecutive_cuts: 3,
        max_budget_increase_pct: 20,
        max_weekly_increase_pct: 30,
        max_daily_budget_transfer_pct: 10,
        max_auto_pause_per_14d: 1,
        never_pause_last_active_campaign: true,
        top_performing_protection_count: 3,
        never_delete_always_pause: true,
      },
      unreliable_data_guards: {
        new_ad_observation_days: 14,
        min_weekly_conversions_for_scale: 10,
        min_clicks_for_eval: 25,
        target_cpa_spend_multiplier: 2.0,
        sudden_conversion_drop_threshold: 0.7,
        meta_attribution_lag_days: 7,
        year_end_blackout_periods: [],
      },
      campaign_types: {},
      default_account_baselines: {},
    };

    return this.config;
  }

  public getSafetyLimits(): SafetyLimits {
    return this.loadRules().safety_limits;
  }

  public getGuards(): UnreliableDataGuards {
    return this.loadRules().unreliable_data_guards;
  }

  /**
   * 根據行銷活動名稱自動辨識所屬之型態規則
   */
  public matchCampaignType(campaignName: string): { typeKey: string; typeRule: CampaignTypeRule } {
    const cfg = this.loadRules();
    for (const [key, typeRule] of Object.entries(cfg.campaign_types)) {
      if (typeRule.regex) {
        const re = new RegExp(typeRule.regex, 'i');
        if (re.test(campaignName)) {
          return { typeKey: key, typeRule };
        }
      }
    }
    // 預設為主力型態
    return {
      typeKey: 'mainstream',
      typeRule: cfg.campaign_types.mainstream || {
        name: 'Meta 主力跑量',
        regex: '.*',
        rules: {},
      },
    };
  }

  /**
   * 取得指定帳號的預設基準值 (若有)
   */
  public getAccountBaseline(accountId: string): any {
    const cfg = this.loadRules();
    return cfg.default_account_baselines?.[accountId];
  }
}

export const ruleLoader = new RuleLoader();
