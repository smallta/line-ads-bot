import { config } from './config.js';

export type ConversionGoalType = 'purchase' | 'messaging' | 'lead';

export interface OverviewMetrics {
  accountName: string;
  accountId: string;
  currency: string;
  statusLabel: string;
  datePreset: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  conversions: number;
  cpa: number;
  roas: number;
  conversionGoal: ConversionGoalType;
  metricLabel: string;
  costLabel: string;
  unitLabel: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  budgetDesc: string;
  spend: number;
  ctr: number;
  roas: number;
  conversions: number;
  cpa: number;
  primaryMetric: 'roas' | 'cpa' | 'messaging';
  conversionGoal: ConversionGoalType;
  metricLabel: string;
  costLabel: string;
  unitLabel: string;
}

export interface FatigueSummary {
  adId: string;
  adName: string;
  frequency: number;
  ctrRecent: number;
  ctrDropPct: number;
  cpaRecent: number;
  cpaIncreasePct: number;
  triggersMet: number;
  recommendation: string;
}

export interface WeeklyComparison {
  current: OverviewMetrics;
  prior: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    cpa: number;
    roas: number;
  };
  delta: {
    spendPct: number;
    roasDiff: number;
    conversionsDiff: number;
    cpaPct: number;
    ctrDiff: number;
  };
}

export interface PatrolItem {
  id: string;
  name: string;
  currency: string;
  status: 'healthy' | 'warning' | 'critical';
  spend7d: number;
  disapprovedCount: number;
  issuesCount: number;
  reason?: string;
}

export interface CreativeMatrixItem {
  id: string;
  name: string;
  spend: number;
  ctr: number;
  roas: number;
  cpa: number;
  conversions: number;
  quadrant: 'winning' | 'vampire' | 'potential' | 'fatigued';
}

export interface HealthAuditResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  accountName: string;
  accountId: string;
  currency: string;
  dimensions: {
    fatigueRisk: { score: number; maxScore: number; status: string; detail: string };
    budgetStructure: { score: number; maxScore: number; status: string; detail: string };
    economicsRoi: { score: number; maxScore: number; status: string; detail: string };
    clickIntent: { score: number; maxScore: number; status: string; detail: string };
  };
  passedChecks: string[];
  failedChecks: string[];
  topRecommendation: string;
}

export interface TokenInfo {
  token: string;
  isWriteEnabled: boolean;
  accessibleAccounts: Set<string>;
}

let tokenKeychain: TokenInfo[] | null = null;
let lastProbeTime = 0;
const PROBE_INTERVAL_MS = 20 * 60 * 1000;

export class MetaService {
  /**
   * 初始化與探測多 Token 鑰匙圈 (Multi-Token Keychain)
   */
  public static async getKeychain(force = false): Promise<TokenInfo[]> {
    const now = Date.now();
    if (!force && tokenKeychain && now - lastProbeTime < PROBE_INTERVAL_MS) {
      return tokenKeychain;
    }

    const rawTokens = (config.meta.accessTokens && config.meta.accessTokens.length > 0)
      ? config.meta.accessTokens
      : [config.meta.accessToken].filter(Boolean);

    const list: TokenInfo[] = [];
    for (const t of rawTokens) {
      const info: TokenInfo = {
        token: t,
        isWriteEnabled: false,
        accessibleAccounts: new Set(),
      };
      try {
        // 1. 查詢該 Token 是否具備 ads_management 寫入權限
        const permRes = await fetch(`https://graph.facebook.com/${config.meta.apiVersion}/me/permissions?access_token=${t}`);
        const permData = await permRes.json();
        if (permData.data) {
          info.isWriteEnabled = permData.data.some((p: any) => p.permission === 'ads_management' && p.status === 'granted');
        }

        // 2. 查詢該 Token 能存取的所有廣告帳號
        const accRes = await fetch(`https://graph.facebook.com/${config.meta.apiVersion}/me/adaccounts?fields=id,account_id&limit=100&access_token=${t}`);
        const accData = await accRes.json();
        if (accData.data) {
          for (const a of accData.data) {
            info.accessibleAccounts.add(a.id);
            info.accessibleAccounts.add(`act_${a.account_id}`);
            info.accessibleAccounts.add(String(a.account_id));
          }
        }
      } catch (e: any) {
        console.warn('⚠️ [MetaKeychain] 探測 Token 異常:', e.message);
      }
      list.push(info);
    }

    tokenKeychain = list;
    lastProbeTime = now;
    return list;
  }

  /**
   * 智慧多 Token 查詢路由（自動匹配帳號權限與平滑容錯）
   */
  public static async request<T>(
    endpoint: string,
    params: Record<string, string | number> = {},
    tokenOverride?: string
  ): Promise<T> {
    const apiVersion = config.meta.apiVersion;
    const keychain = await this.getKeychain();

    // 擷取 endpoint 中的 accountId (如 /act_173149... 或 /act_4000...)
    const actMatch = endpoint.match(/(act_\d+)/);
    const targetAccountId = actMatch ? actMatch[1] : null;

    let candidateTokens: string[] = [];
    if (tokenOverride) {
      candidateTokens = [tokenOverride];
    } else if (targetAccountId) {
      // 優先挑選已知具備該帳號存取權的 Token
      const matching = keychain.filter((k) => k.accessibleAccounts.has(targetAccountId));
      const others = keychain.filter((k) => !k.accessibleAccounts.has(targetAccountId));
      candidateTokens = [...matching.map((m) => m.token), ...others.map((o) => o.token)];
    } else {
      candidateTokens = keychain.map((k) => k.token);
    }

    if (candidateTokens.length === 0) {
      candidateTokens = [config.meta.accessToken];
    }

    let lastError: any = null;
    for (const token of candidateTokens) {
      if (!token) continue;
      try {
        const url = new URL(
          endpoint.startsWith('http')
            ? endpoint
            : `https://graph.facebook.com/${apiVersion}/${endpoint.replace(/^\//, '')}`
        );
        url.searchParams.set('access_token', token);
        for (const [key, val] of Object.entries(params)) {
          url.searchParams.set(key, String(val));
        }

        const res = await fetch(url.toString());
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || res.statusText);
        }
        return data as T;
      } catch (err: any) {
        lastError = err;
        const msg = String(err.message || '');
        // 若遇到權限不足或 OAuth 錯誤，自動嘗試鑰匙圈中的下一個 Token！
        if (msg.includes('#200') || msg.includes('OAuthException') || msg.includes('permission') || msg.includes('access')) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('所有 Token 皆無法存取此資源');
  }

  /**
   * 智慧多 Token 寫入路由（自動優先指派具備 ads_management 寫入權限之 Token）
   */
  public static async mutate<T>(
    endpoint: string,
    body: Record<string, any>,
    tokenOverride?: string
  ): Promise<T> {
    const apiVersion = config.meta.apiVersion;
    const keychain = await this.getKeychain();

    // 擷取 endpoint 中的 accountId
    const actMatch = endpoint.match(/(act_\d+)/);
    const targetAccountId = actMatch ? actMatch[1] : null;

    let candidateTokens: string[] = [];
    if (tokenOverride) {
      candidateTokens = [tokenOverride];
    } else {
      // 寫入動作必須優先挑選 isWriteEnabled: true 的 Token
      const writeTokens = keychain.filter((k) => k.isWriteEnabled);
      if (targetAccountId) {
        const matchWrite = writeTokens.filter((k) => k.accessibleAccounts.has(targetAccountId));
        const otherWrite = writeTokens.filter((k) => !k.accessibleAccounts.has(targetAccountId));
        candidateTokens = [...matchWrite.map((m) => m.token), ...otherWrite.map((o) => o.token)];
      } else {
        candidateTokens = writeTokens.map((w) => w.token);
      }
      // 保底候補
      const others = keychain.filter((k) => !k.isWriteEnabled).map((o) => o.token);
      candidateTokens = [...candidateTokens, ...others];
    }

    if (candidateTokens.length === 0) {
      candidateTokens = [config.meta.accessToken];
    }

    let lastError: any = null;
    for (const token of candidateTokens) {
      if (!token) continue;
      try {
        const url = new URL(
          endpoint.startsWith('http')
            ? endpoint
            : `https://graph.facebook.com/${apiVersion}/${endpoint.replace(/^\//, '')}`
        );
        url.searchParams.set('access_token', token);

        const formData = new URLSearchParams();
        for (const [key, val] of Object.entries(body)) {
          formData.append(key, String(val));
        }

        const res = await fetch(url.toString(), {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || res.statusText);
        }
        return data as T;
      } catch (err: any) {
        lastError = err;
        const msg = String(err.message || '');
        if (msg.includes('#200') || msg.includes('OAuthException') || msg.includes('permission') || msg.includes('ads_management')) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('所有 Token 皆無寫入權限或操作失敗');
  }

  /**
   * 暫停指定廣告素材 (Pause Ad)
   */
  public static async pauseAd(adId: string, adName?: string): Promise<{ success: boolean; name: string; id: string }> {
    const cleanId = adId.replace(/^(ad_|act_)/, '');
    await this.mutate(`/${cleanId}`, { status: 'PAUSED' });
    return { success: true, name: adName || cleanId, id: cleanId };
  }

  /**
   * 暫停指定行銷活動 (Pause Campaign)
   */
  public static async pauseCampaign(campaignId: string, campaignName?: string): Promise<{ success: boolean; name: string; id: string }> {
    const cleanId = campaignId.replace(/^(cmp_|act_)/, '');
    await this.mutate(`/${cleanId}`, { status: 'PAUSED' });
    return { success: true, name: campaignName || cleanId, id: cleanId };
  }

  /**
   * 暫停指定廣告組合 (Pause AdSet)
   */
  public static async pauseAdSet(adSetId: string, adSetName?: string): Promise<{ success: boolean; name: string; id: string }> {
    const cleanId = adSetId.replace(/^(adset_|act_)/, '');
    await this.mutate(`/${cleanId}`, { status: 'PAUSED' });
    return { success: true, name: adSetName || cleanId, id: cleanId };
  }

  /**
   * 縮減預算 (Reduce Budget, 預設 20%)
   * 支援 Campaign (CBO) 或 AdSet (ABO)
   */
  public static async reduceBudget(
    targetId: string,
    percentage: number = 0.2
  ): Promise<{
    success: boolean;
    name: string;
    id: string;
    budgetType: 'daily' | 'lifetime';
    oldBudgetDisplay: string;
    newBudgetDisplay: string;
    savedDisplay: string;
    percentage: number;
  }> {
    const cleanId = targetId.replace(/^(act_|cmp_|adset_)/, '');
    const details = await this.request<{
      id: string;
      name: string;
      daily_budget?: string;
      lifetime_budget?: string;
    }>(`/${cleanId}`, { fields: 'id,name,daily_budget,lifetime_budget' });

    let budgetField: 'daily_budget' | 'lifetime_budget' | null = null;
    let oldVal = 0;

    if (details.daily_budget && Number(details.daily_budget) > 0) {
      budgetField = 'daily_budget';
      oldVal = Number(details.daily_budget);
    } else if (details.lifetime_budget && Number(details.lifetime_budget) > 0) {
      budgetField = 'lifetime_budget';
      oldVal = Number(details.lifetime_budget);
    } else {
      throw new Error(`目標【${details.name || cleanId}】未設置可縮減之預算（可能採用組合層級預算或無上限）。`);
    }

    const newVal = Math.round(oldVal * (1 - percentage));
    if (newVal < 100) {
      throw new Error(`縮減後預算過低，已觸發最低門檻風控保護，無法進一步調降。`);
    }

    await this.mutate(`/${cleanId}`, { [budgetField]: newVal });

    const isSubunit = oldVal >= 100;
    const oldDollars = isSubunit ? oldVal / 100 : oldVal;
    const newDollars = isSubunit ? newVal / 100 : newVal;
    const savedDollars = oldDollars - newDollars;

    return {
      success: true,
      name: details.name || cleanId,
      id: cleanId,
      budgetType: budgetField === 'daily_budget' ? 'daily' : 'lifetime',
      oldBudgetDisplay: `$${Math.round(oldDollars).toLocaleString()}`,
      newBudgetDisplay: `$${Math.round(newDollars).toLocaleString()}`,
      savedDisplay: `$${Math.round(savedDollars).toLocaleString()}`,
      percentage: Math.round(percentage * 100),
    };
  }


  public static extractConversionDetails(
    actions?: Array<{ action_type: string; value: string }>,
    revenue = 0
  ): {
    conversions: number;
    conversionGoal: ConversionGoalType;
    metricLabel: string;
    costLabel: string;
    unitLabel: string;
  } {
    if (!actions || actions.length === 0) {
      return {
        conversions: 0,
        conversionGoal: 'lead',
        metricLabel: '轉換',
        costLabel: 'CPA',
        unitLabel: '筆',
      };
    }

    // 1. 電商購買 / 實體門市下單
    const purchaseAct = actions.find(
      (a) =>
        a.action_type === 'purchase' ||
        a.action_type === 'omni_purchase' ||
        a.action_type === 'web_in_store_purchase'
    );
    const purchaseCount = purchaseAct ? parseFloat(purchaseAct.value || '0') : 0;

    // 2. 互動訊息事件 (包含開始對話次數、傳訊連線數、新發起傳訊聯絡人)
    const msgStartedAct = actions.find(
      (a) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
    );
    const msgTotalAct = actions.find(
      (a) => a.action_type === 'onsite_conversion.total_messaging_connection'
    );
    const msgFirstReplyAct = actions.find(
      (a) => a.action_type === 'onsite_conversion.messaging_first_reply'
    );
    const messagingCount = parseFloat(
      msgStartedAct?.value || msgTotalAct?.value || msgFirstReplyAct?.value || '0'
    );

    // 3. 名單收集 / 預約諮詢 / 註冊 / 捐款
    const leadAct = actions.find(
      (a) =>
        a.action_type === 'lead' ||
        a.action_type === 'onsite_conversion.lead_grouped' ||
        a.action_type === 'complete_registration' ||
        a.action_type === 'omni_complete_registration' ||
        a.action_type === 'donate' ||
        a.action_type === 'contact' ||
        a.action_type === 'schedule' ||
        a.action_type === 'submit_application' ||
        a.action_type === 'subscribe'
    );
    const leadCount = leadAct ? parseFloat(leadAct.value || '0') : 0;

    // 🎯 智慧目標仲裁邏輯 (Objective Arbitration)：
    // A. 若有電商營收或購買且購買數明顯，判定為電商購買導向
    if (purchaseCount > 0 && (revenue > 0 || (purchaseCount >= messagingCount && purchaseCount >= leadCount))) {
      return {
        conversions: purchaseCount,
        conversionGoal: 'purchase',
        metricLabel: '購買',
        costLabel: '購買成本 CPA',
        unitLabel: '筆',
      };
    }

    // B. 若有發起訊息對話，且發起對話數高於一般名單（或一般名單為零），判定為「互動訊息」導向
    // （在醫美、諮詢、預約型廣告中，主軸為導流 LINE/Messenger 開始私訊對話）
    if (messagingCount > 0 && messagingCount >= leadCount) {
      return {
        conversions: messagingCount,
        conversionGoal: 'messaging',
        metricLabel: '發起訊息',
        costLabel: '單則訊息成本',
        unitLabel: '則',
      };
    }

    // C. 若名單數高於訊息數，或僅有名單事件，判定為名單導向
    if (leadCount > 0) {
      return {
        conversions: leadCount,
        conversionGoal: 'lead',
        metricLabel: '名單',
        costLabel: '名單成本 CPA',
        unitLabel: '筆',
      };
    }

    // D. 次要保底：若只有訊息（哪怕少於其他未列項目）
    if (messagingCount > 0) {
      return {
        conversions: messagingCount,
        conversionGoal: 'messaging',
        metricLabel: '發起訊息',
        costLabel: '單則訊息成本',
        unitLabel: '則',
      };
    }

    if (purchaseCount > 0) {
      return {
        conversions: purchaseCount,
        conversionGoal: 'purchase',
        metricLabel: '購買',
        costLabel: '購買成本 CPA',
        unitLabel: '筆',
      };
    }

    return {
      conversions: 0,
      conversionGoal: 'lead',
      metricLabel: '轉換',
      costLabel: 'CPA',
      unitLabel: '筆',
    };
  }

  /**
   * 智慧萃取核心轉換數
   */
  public static extractConversions(actions?: Array<{ action_type: string; value: string }>, revenue = 0): number {
    return this.extractConversionDetails(actions, revenue).conversions;
  }

  /**
   * 智慧萃取購買營收與計算 ROAS
   */
  public static extractRevenue(
    actionValues?: Array<{ action_type: string; value: string }>,
    purchaseRoas?: Array<{ action_type?: string; value: string }>,
    spend = 0
  ): { roas: number; revenue: number } {
    let roas = 0;
    let revenue = 0;

    if (purchaseRoas && purchaseRoas.length > 0) {
      roas = parseFloat(purchaseRoas[0].value || '0');
      revenue = roas * spend;
    } else if (actionValues && actionValues.length > 0) {
      const actVal = actionValues.find(
        (a) =>
          a.action_type === 'purchase' ||
          a.action_type === 'omni_purchase' ||
          a.action_type === 'web_in_store_purchase'
      );
      if (actVal) {
        revenue = parseFloat(actVal.value || '0');
        roas = spend > 0 ? revenue / spend : 0;
      }
    }

    return { roas, revenue };
  }

  public static async getAccountOverview(
    accountId: string,
    datePreset = 'last_7d'
  ): Promise<OverviewMetrics> {
    const accountInfo = await this.request<{
      id: string;
      name: string;
      account_status: number;
      currency: string;
    }>(`/${accountId}`, {
      fields: 'id,name,account_status,currency',
    });

    const insightsRes = await this.request<{
      data: Array<{
        spend?: string;
        impressions?: string;
        clicks?: string;
        ctr?: string;
        cpc?: string;
        cpm?: string;
        frequency?: string;
        actions?: Array<{ action_type: string; value: string }>;
        action_values?: Array<{ action_type: string; value: string }>;
        purchase_roas?: Array<{ action_type: string; value: string }>;
      }>;
    }>(`/${accountId}/insights`, {
      date_preset: datePreset,
      fields:
        'spend,impressions,clicks,ctr,cpc,cpm,frequency,actions,action_values,cost_per_action_type,purchase_roas',
    });

    const insight = insightsRes.data?.[0] || {};
    const spend = parseFloat(insight.spend || '0');
    const impressions = parseInt(insight.impressions || '0', 10);
    const clicks = parseInt(insight.clicks || '0', 10);
    const ctr = parseFloat(insight.ctr || '0');
    const cpc = parseFloat(insight.cpc || '0');
    const cpm = parseFloat(insight.cpm || '0');
    const frequency = parseFloat(insight.frequency || '0');

    const { roas, revenue } = this.extractRevenue(insight.action_values, insight.purchase_roas, spend);
    const convDetails = this.extractConversionDetails(insight.actions, revenue);
    const conversions = convDetails.conversions;
    const cpa = conversions > 0 ? spend / conversions : 0;

    return {
      accountName: accountInfo.name,
      accountId: accountInfo.id,
      currency: accountInfo.currency,
      statusLabel: accountInfo.account_status === 1 ? '正常投放中' : `狀態碼: ${accountInfo.account_status}`,
      datePreset,
      spend,
      impressions,
      clicks,
      ctr,
      cpc,
      cpm,
      frequency,
      conversions,
      cpa,
      roas,
      conversionGoal: convDetails.conversionGoal,
      metricLabel: convDetails.metricLabel,
      costLabel: convDetails.costLabel,
      unitLabel: convDetails.unitLabel,
    };
  }

  public static async listCampaigns(
    accountId: string,
    datePreset = 'last_7d',
    limit = 6
  ): Promise<CampaignSummary[]> {
    interface CampRes {
      data: Array<{
        id: string;
        name: string;
        effective_status: string;
        daily_budget?: string;
        lifetime_budget?: string;
        insights?: {
          data: Array<{
            spend?: string;
            ctr?: string;
            purchase_roas?: Array<{ value: string }>;
            actions?: Array<{ action_type: string; value: string }>;
            action_values?: Array<{ action_type: string; value: string }>;
          }>;
        };
      }>;
    }

    const res = await this.request<CampRes>(`/${accountId}/campaigns`, {
      limit,
      effective_status: JSON.stringify(['ACTIVE']),
      fields: `id,name,effective_status,daily_budget,lifetime_budget,insights.date_preset(${datePreset}){spend,ctr,purchase_roas,actions,action_values}`,
    });

    return (res.data || []).map((c) => {
      const insight = c.insights?.data?.[0];
      const spend = insight ? parseFloat(insight.spend || '0') : 0;
      const ctr = insight ? parseFloat(insight.ctr || '0') : 0;
      const { roas, revenue } = this.extractRevenue(insight?.action_values, insight?.purchase_roas, spend);
      const convDetails = this.extractConversionDetails(insight?.actions, revenue);
      const conversions = convDetails.conversions;
      const cpa = conversions > 0 ? spend / conversions : 0;

      let budgetDesc = 'ABO';
      if (c.daily_budget) {
        budgetDesc = `CBO $${(parseFloat(c.daily_budget) / 100).toFixed(0)}/日`;
      }

      let primaryMetric: 'roas' | 'cpa' | 'messaging' = 'cpa';
      if (roas > 0) {
        primaryMetric = 'roas';
      } else if (convDetails.conversionGoal === 'messaging') {
        primaryMetric = 'messaging';
      }

      return {
        id: c.id,
        name: c.name,
        status: c.effective_status,
        budgetDesc,
        spend,
        ctr,
        roas,
        conversions,
        cpa,
        primaryMetric,
        conversionGoal: convDetails.conversionGoal,
        metricLabel: convDetails.metricLabel,
        costLabel: convDetails.costLabel,
        unitLabel: convDetails.unitLabel,
      };
    });
  }

  public static async detectFatigue(accountId: string, minSpend = 30): Promise<FatigueSummary[]> {
    interface AdInsight {
      ad_id: string;
      spend: string;
      frequency: string;
      ctr: string;
      actions?: Array<{ action_type: string; value: string }>;
    }

    const [adsRes, recentRes, baseRes] = await Promise.all([
      this.request<{ data: Array<{ id: string; name: string }> }>(`/${accountId}/ads`, {
        limit: 30,
        effective_status: JSON.stringify(['ACTIVE']),
        fields: 'id,name',
      }),
      this.request<{ data: AdInsight[] }>(`/${accountId}/insights`, {
        level: 'ad',
        date_preset: 'last_3d',
        fields: 'ad_id,spend,frequency,ctr,actions',
        limit: 50,
      }),
      this.request<{ data: AdInsight[] }>(`/${accountId}/insights`, {
        level: 'ad',
        date_preset: 'last_7d',
        fields: 'ad_id,spend,frequency,ctr,actions',
        limit: 50,
      }),
    ]);

    const recentMap = new Map(recentRes.data?.map((r) => [r.ad_id, r]));
    const baseMap = new Map(baseRes.data?.map((b) => [b.ad_id, b]));

    const fatigued: FatigueSummary[] = [];

    for (const ad of adsRes.data || []) {
      const r = recentMap.get(ad.id);
      const b = baseMap.get(ad.id);
      if (!r) continue;

      const spendR = parseFloat(r.spend || '0');
      if (spendR < minSpend) continue; // 防呆

      const spendB = b ? parseFloat(b.spend || '0') : spendR;
      const freqR = parseFloat(r.frequency || '0');
      const ctrR = parseFloat(r.ctr || '0');
      const ctrB = b ? parseFloat(b.ctr || '0') : ctrR;

      const convR = this.extractConversions(r.actions);
      const convB = this.extractConversions(b?.actions);

      const cpaR = convR > 0 ? spendR / convR : spendR;
      const cpaB = convB > 0 ? spendB / convB : spendB;

      const freqTrigger = freqR > 4.0;
      const ctrDropPct = ctrB > 0 ? ((ctrB - ctrR) / ctrB) * 100 : 0;
      const ctrTrigger = ctrDropPct > 15.0;
      const cpaIncPct = cpaB > 0 ? ((cpaR - cpaB) / cpaB) * 100 : 0;
      const cpaTrigger = cpaIncPct > 20.0;

      let met = 0;
      if (freqTrigger) met++;
      if (ctrTrigger) met++;
      if (cpaTrigger) met++;

      if (met >= 2) {
        fatigued.push({
          adId: ad.id,
          adName: ad.name,
          frequency: freqR,
          ctrRecent: ctrR,
          ctrDropPct,
          cpaRecent: cpaR,
          cpaIncreasePct: cpaIncPct,
          triggersMet: met,
          recommendation: '建議調降預算 20% 或更換素材',
        });
      }
    }

    return fatigued;
  }

  public static async listAccessibleAccounts(): Promise<Array<{ id: string; name: string; currency: string; statusLabel: string }>> {
    const keychain = await this.getKeychain();
    const accountMap = new Map<string, { id: string; name: string; currency: string; statusLabel: string }>();

    for (const item of keychain) {
      try {
        const res = await this.request<{
          data: Array<{ id: string; name: string; currency: string; account_status: number }>;
        }>('/me/adaccounts?fields=id,name,currency,account_status&limit=100', {}, item.token);

        for (const acc of res.data || []) {
          if (!accountMap.has(acc.id)) {
            accountMap.set(acc.id, {
              id: acc.id,
              name: acc.name,
              currency: acc.currency,
              statusLabel: acc.account_status === 1 ? 'ACTIVE' : `STATUS_${acc.account_status}`,
            });
          }
        }
      } catch (e: any) {
        console.warn('⚠️ [listAccessibleAccounts] 查詢 Token 帳號略過:', e.message);
      }
    }

    return Array.from(accountMap.values());
  }

  /**
   * 抓取週報環比數據 (WoW: 當前 7 天 vs 前一個 7 天)
   */
  public static async getWeeklyComparison(accountId: string): Promise<WeeklyComparison> {
    const now = new Date();
    const d14_end = new Date(now.getTime() - 8 * 86400000).toISOString().split('T')[0];
    const d14_start = new Date(now.getTime() - 14 * 86400000).toISOString().split('T')[0];

    const currentPromise = this.getAccountOverview(accountId, 'last_7d');
    const priorPromise = this.request<{
      data: Array<{
        spend?: string;
        impressions?: string;
        clicks?: string;
        ctr?: string;
        actions?: Array<{ action_type: string; value: string }>;
        action_values?: Array<{ action_type: string; value: string }>;
        purchase_roas?: Array<{ action_type: string; value: string }>;
      }>;
    }>(`/${accountId}/insights`, {
      time_range: JSON.stringify({ since: d14_start, until: d14_end }),
      fields: 'spend,impressions,clicks,ctr,actions,action_values,purchase_roas',
    });

    const [cur, priorRes] = await Promise.all([currentPromise, priorPromise]);
    const pInsight = priorRes.data?.[0] || {};
    const pSpend = parseFloat(pInsight.spend || '0');
    const pImpressions = parseInt(pInsight.impressions || '0', 10);
    const pClicks = parseInt(pInsight.clicks || '0', 10);
    const pCtr = parseFloat(pInsight.ctr || '0');

    const pConversions = this.extractConversions(pInsight.actions);
    const pCpa = pConversions > 0 ? pSpend / pConversions : 0;
    const { roas: pRoas } = this.extractRevenue(pInsight.action_values, pInsight.purchase_roas, pSpend);

    const spendDeltaPct = pSpend > 0 ? ((cur.spend - pSpend) / pSpend) * 100 : 0;
    const roasDiff = cur.roas - pRoas;
    const conversionsDiff = cur.conversions - pConversions;
    const cpaPct = pCpa > 0 ? ((cur.cpa - pCpa) / pCpa) * 100 : 0;
    const ctrDiff = cur.ctr - pCtr;

    return {
      current: cur,
      prior: {
        spend: pSpend,
        impressions: pImpressions,
        clicks: pClicks,
        ctr: pCtr,
        conversions: pConversions,
        cpa: pCpa,
        roas: pRoas,
      },
      delta: {
        spendPct: spendDeltaPct,
        roasDiff,
        conversionsDiff,
        cpaPct,
        ctrDiff,
      },
    };
  }

  /**
   * 16 帳號全域紅綠燈晨檢 (Cross-Account Sentinel Patrol)
   */
  public static async patrolAccounts(
    accounts: Array<{ id: string; name: string; currency: string; shortName: string }>
  ): Promise<PatrolItem[]> {
    const results = await Promise.all(
      accounts.map(async (acc): Promise<PatrolItem> => {
        try {
          const adsPromise = this.request<{
            data: Array<{ id: string; name: string; effective_status: string }>;
          }>(`/${acc.id}/ads`, {
            effective_status: JSON.stringify(['DISAPPROVED', 'WITH_ISSUES']),
            fields: 'id,name,effective_status',
            limit: 20,
          });

          const insightPromise = this.request<{
            data: Array<{ spend?: string }>;
          }>(`/${acc.id}/insights`, {
            date_preset: 'last_7d',
            fields: 'spend',
          });

          const [adsRes, insightRes] = await Promise.all([adsPromise, insightPromise]);
          const disapproved = (adsRes.data || []).filter((a) => a.effective_status === 'DISAPPROVED');
          const withIssues = (adsRes.data || []).filter((a) => a.effective_status === 'WITH_ISSUES');
          const spend7d = parseFloat(insightRes.data?.[0]?.spend || '0');

          let status: 'healthy' | 'warning' | 'critical' = 'healthy';
          let reason = '運作平穩正常';

          if (disapproved.length > 0) {
            status = 'critical';
            reason = `${disapproved.length} 支廣告遭 Meta 官方拒登 (Policy 違規)`;
          } else if (withIssues.length > 0) {
            status = 'warning';
            reason = `${withIssues.length} 支廣告存在過期受眾或設定錯誤 (WITH_ISSUES)`;
          } else if (spend7d === 0) {
            status = 'warning';
            reason = '近 7 天花費為 $0 (專案休眠中)';
          }

          return {
            id: acc.id,
            name: acc.shortName || acc.name,
            currency: acc.currency,
            status,
            spend7d,
            disapprovedCount: disapproved.length,
            issuesCount: withIssues.length,
            reason,
          };
        } catch (e: any) {
          return {
            id: acc.id,
            name: acc.shortName || acc.name,
            currency: acc.currency,
            status: 'warning' as const,
            spend7d: 0,
            disapprovedCount: 0,
            issuesCount: 0,
            reason: `存取受限 (${e.message || 'API 查詢略過'})`,
          };
        }
      })
    );

    return results;
  }

  /**
   * 吸血鬼 vs 金牛素材四象限分析 (Creative Matrix，支援 ROAS 電商、互動訊息 Messaging、CPA 名單多軌制)
   */
  public static async getCreativeMatrix(accountId: string): Promise<{
    items: CreativeMatrixItem[];
    avgCtr: number;
    avgRoas: number;
    avgCpa: number;
    totalConversions: number;
    primaryMetric: 'roas' | 'cpa' | 'messaging';
    conversionGoal: ConversionGoalType;
  }> {
    const res = await this.request<{
      data: Array<{
        id: string;
        name: string;
        insights?: {
          data?: Array<{
            spend?: string;
            impressions?: string;
            clicks?: string;
            ctr?: string;
            purchase_roas?: Array<{ value: string }>;
            actions?: Array<{ action_type: string; value: string }>;
            action_values?: Array<{ action_type: string; value: string }>;
          }>;
        };
      }>;
    }>(`/${accountId}/ads`, {
      effective_status: JSON.stringify(['ACTIVE']),
      fields: 'id,name,insights.date_preset(last_7d){spend,impressions,clicks,ctr,purchase_roas,actions,action_values}',
      limit: 25,
    });

    const parsed: Array<{
      id: string;
      name: string;
      spend: number;
      ctr: number;
      roas: number;
      cpa: number;
      conversions: number;
      conversionGoal: ConversionGoalType;
    }> = [];

    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalRevenue = 0;
    let totalConversions = 0;

    for (const ad of res.data || []) {
      const insight = ad.insights?.data?.[0];
      if (!insight) continue;

      const spend = parseFloat(insight.spend || '0');
      if (spend < 5) continue; // 過濾花費雜訊

      const impressions = parseInt(insight.impressions || '0', 10);
      const clicks = parseInt(insight.clicks || '0', 10);
      const ctr = parseFloat(insight.ctr || '0');

      const { roas, revenue } = this.extractRevenue(insight.action_values, insight.purchase_roas, spend);
      const convDetails = this.extractConversionDetails(insight.actions, revenue);
      const conversions = convDetails.conversions;
      const cpa = conversions > 0 ? spend / conversions : 0;

      totalSpend += spend;
      totalClicks += clicks;
      totalImpressions += impressions;
      totalRevenue += revenue;
      totalConversions += conversions;

      parsed.push({
        id: ad.id,
        name: ad.name,
        spend,
        ctr,
        roas,
        cpa,
        conversions,
        conversionGoal: convDetails.conversionGoal,
      });
    }

    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 2.0;
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

    // 判斷該帳號/素材群的主要目標：電商 (ROAS) ｜ 互動訊息 (Messaging) ｜ 名單 (CPA)
    const isRoasMode = avgRoas > 0.05 && totalRevenue > 0;
    const messagingAdsCount = parsed.filter((p) => p.conversionGoal === 'messaging' && p.conversions > 0).length;
    const isMessagingMode = !isRoasMode && messagingAdsCount > 0;

    let primaryMetric: 'roas' | 'cpa' | 'messaging' = 'cpa';
    let conversionGoal: ConversionGoalType = 'lead';

    if (isRoasMode) {
      primaryMetric = 'roas';
      conversionGoal = 'purchase';
    } else if (isMessagingMode) {
      primaryMetric = 'messaging';
      conversionGoal = 'messaging';
    }

    const isCostDrivenMode = !isRoasMode; // 包含訊息與名單模式

    const items: CreativeMatrixItem[] = parsed.map((p) => {
      let quadrant: 'winning' | 'vampire' | 'potential' | 'fatigued' = 'fatigued';
      const isHighCtr = p.ctr >= avgCtr;

      if (isCostDrivenMode) {
        // 成本導向模式 (訊息或名單)：成本越低越好
        const isGoodCost = p.conversions > 0 && (avgCpa === 0 || p.cpa <= avgCpa);

        if (isHighCtr && isGoodCost) {
          quadrant = 'winning';    // 🏆 金牛素材 (高點擊 + 低成本)
        } else if (isHighCtr && !isGoodCost) {
          quadrant = 'vampire';    // 🧛 吸血鬼素材 (高點擊 + 高成本/零轉換)
        } else if (!isHighCtr && isGoodCost) {
          quadrant = 'potential';  // 💎 潛力金礦 (低點擊 + 低成本)
        } else {
          quadrant = 'fatigued';   // 🥀 疲勞淘汰 (低點擊 + 高成本/零轉換)
        }
      } else {
        // 電商營收模式：ROAS 越高越好
        const isHighRoas = p.roas >= avgRoas;

        if (isHighCtr && isHighRoas) {
          quadrant = 'winning';    // 🏆 金牛素材 (高點擊 + 高 ROAS)
        } else if (isHighCtr && !isHighRoas) {
          quadrant = 'vampire';    // 🧛 吸血鬼素材 (高點擊 + 低 ROAS)
        } else if (!isHighCtr && isHighRoas) {
          quadrant = 'potential';  // 💎 潛力金礦 (低點擊 + 高 ROAS)
        } else {
          quadrant = 'fatigued';   // 🥀 疲勞淘汰 (低點擊 + 低 ROAS)
        }
      }

      return {
        ...p,
        quadrant,
      };
    });

    return { items, avgCtr, avgRoas, avgCpa, totalConversions, primaryMetric, conversionGoal };
  }

  /**
   * 帳號綜合健康度大健檢 (Ads Health Audit & Score 0-100)
   * 參考 claude-ads 權重稽核模型，涵蓋：
   * 1. 素材疲勞與風控 (Fatigue & Risk, 25%)
   * 2. 學習期與預算架構 (Structure & Learning, 25%)
   * 3. 獲客經濟學與 ROI (Economics & ROI, 25%)
   * 4. 點擊品質與漏斗意圖 (Click Quality & Intent, 25%)
   */
  public static async generateHealthAudit(accountId: string): Promise<HealthAuditResult> {
    const cleanId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const [overview, fatigued, campaigns] = await Promise.all([
      this.getAccountOverview(cleanId, 'last_7d'),
      this.detectFatigue(cleanId),
      this.listCampaigns(cleanId, 'last_7d', 10),
    ]);

    const passedChecks: string[] = [];
    const failedChecks: string[] = [];

    // --- 維度 1：素材疲勞與風控 (Fatigue & Risk, 滿分 25) ---
    let fatigueScore = 25;
    let fatigueDetail = '';
    if (fatigued.length === 0) {
      passedChecks.push('素材健康無疲勞：活躍素材均未觸發三選二衰退條件');
      fatigueDetail = '0 支疲勞素材，續航力正常';
    } else {
      fatigueScore = Math.max(5, 25 - fatigued.length * 6);
      failedChecks.push(`發現 ${fatigued.length} 支素材出現疲勞衰退 (頻率過高或CTR狂跌)`);
      fatigueDetail = `${fatigued.length} 支素材需暫停或更換`;
    }

    // --- 維度 2：學習期與預算架構 (Structure & Learning, 滿分 25) ---
    let structureScore = 25;
    let structureDetail = '';
    const activeCampaigns = campaigns.filter((c) => c.spend > 0);
    const zeroConvCampaigns = activeCampaigns.filter((c) => c.conversions === 0 && c.spend > (overview.currency === 'USD' ? 50 : 1500));

    if (zeroConvCampaigns.length === 0) {
      passedChecks.push('預算效率優良：活躍行銷活動皆有產生有效轉換回傳');
      structureDetail = `${activeCampaigns.length} 個主要活動運轉順暢`;
    } else {
      structureScore = Math.max(8, 25 - zeroConvCampaigns.length * 7);
      failedChecks.push(`存在 ${zeroConvCampaigns.length} 個無轉換吸血活動（累積花費已超標）`);
      structureDetail = `有 ${zeroConvCampaigns.length} 個活動需縮減預算止血`;
    }

    // 檢查預算集中度與活動數量
    if (activeCampaigns.length > 8) {
      structureScore = Math.max(5, structureScore - 4);
      failedChecks.push('活動數量過度分散：容易導致學習期受限與出價互競');
    } else if (activeCampaigns.length > 0) {
      passedChecks.push('活動架構精簡集中：預算聚焦主力組合，利於演算法學習');
    }

    // --- 維度 3：獲客經濟學與 ROI (Economics & ROI, 滿分 25) ---
    let roiScore = 20;
    let roiDetail = '';
    const isEcom = overview.conversionGoal === 'purchase';

    if (isEcom) {
      if (overview.roas >= 2.5) {
        roiScore = 25;
        passedChecks.push(`投資報酬率卓越：ROAS 達 ${overview.roas.toFixed(2)}x (高於標竿 2.0x)`);
        roiDetail = `ROAS ${overview.roas.toFixed(2)}x 表現極佳`;
      } else if (overview.roas >= 1.8) {
        roiScore = 22;
        passedChecks.push(`投報率穩定健康：ROAS ${overview.roas.toFixed(2)}x`);
        roiDetail = `ROAS ${overview.roas.toFixed(2)}x 穩定運轉`;
      } else if (overview.roas >= 1.2) {
        roiScore = 16;
        failedChecks.push(`投報率處於保本邊緣：ROAS ${overview.roas.toFixed(2)}x (建議檢視毛利與客單價)`);
        roiDetail = `ROAS ${overview.roas.toFixed(2)}x 需提振客單價`;
      } else {
        roiScore = 8;
        failedChecks.push(`投報率虧損警戒：ROAS 僅 ${overview.roas.toFixed(2)}x (未能打平廣告成本)`);
        roiDetail = `ROAS ${overview.roas.toFixed(2)}x 嚴重虧損`;
      }
    } else {
      // 導訊 / 名單獲客模式
      if (overview.conversions > 15) {
        roiScore = 25;
        passedChecks.push(`有效名單獲客豐沛：近 7 天累積 ${overview.conversions} 筆${overview.unitLabel} (${overview.costLabel} $${overview.cpa.toFixed(0)})`);
        roiDetail = `累積 ${overview.conversions} 筆，單則成本 $${overview.cpa.toFixed(0)}`;
      } else if (overview.conversions > 0) {
        roiScore = 19;
        passedChecks.push(`維持穩定進單：近 7 天累積 ${overview.conversions} 筆${overview.unitLabel}`);
        roiDetail = `累積 ${overview.conversions} 筆，成本 $${overview.cpa.toFixed(0)}`;
      } else {
        roiScore = 6;
        failedChecks.push(`近 7 天無任何有效獲客：花費 $${overview.spend.toLocaleString()} 但轉換為 0`);
        roiDetail = `0 筆轉換，建議重設受眾或著陸頁`;
      }
    }

    // --- 維度 4：點擊品質與漏斗意圖 (Click Quality & Intent, 滿分 25) ---
    let clickScore = 20;
    let clickDetail = '';
    if (overview.ctr >= 2.2) {
      clickScore = 25;
      passedChecks.push(`素材點擊吸睛度極高：大盤 CTR 達 ${overview.ctr.toFixed(2)}%`);
      clickDetail = `CTR ${overview.ctr.toFixed(2)}% 吸睛力極佳`;
    } else if (overview.ctr >= 1.5) {
      clickScore = 22;
      passedChecks.push(`點擊率高於業界常態：大盤 CTR ${overview.ctr.toFixed(2)}%`);
      clickDetail = `CTR ${overview.ctr.toFixed(2)}% 表現良好`;
    } else if (overview.ctr >= 0.9) {
      clickScore = 16;
      passedChecks.push(`點擊率落在常態區間：大盤 CTR ${overview.ctr.toFixed(2)}%`);
      clickDetail = `CTR ${overview.ctr.toFixed(2)}% 尚可`;
    } else {
      clickScore = 8;
      failedChecks.push(`素材點擊意圖低迷：大盤 CTR 僅 ${overview.ctr.toFixed(2)}% (文案前 3 秒無法抓住受眾)`);
      clickDetail = `CTR ${overview.ctr.toFixed(2)}% 偏低需換新文案`;
    }

    if (overview.frequency > 3.8) {
      clickScore = Math.max(5, clickScore - 4);
      failedChecks.push(`受眾重複曝光過高：平均頻率達 ${overview.frequency.toFixed(1)} (受眾池飽和)`);
    }

    // 綜合總分與評級
    const totalScore = Math.min(100, Math.max(0, fatigueScore + structureScore + roiScore + clickScore));
    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'C';
    if (totalScore >= 90) grade = 'A';
    else if (totalScore >= 80) grade = 'B';
    else if (totalScore >= 70) grade = 'C';
    else if (totalScore >= 60) grade = 'D';
    else grade = 'F';

    // 第一優先行動 (Top Blocker Recommendation)
    let topRecommendation = '';
    if (fatigued.length > 0) {
      topRecommendation = `優先止血：建議立即使用 LINE 按鈕暫停 ${fatigued.length} 支疲勞素材，防止高頻轟炸拉高成本。`;
    } else if (zeroConvCampaigns.length > 0) {
      topRecommendation = `預算收縮：建議調降 ${zeroConvCampaigns[0].name} 日預算 20%，將資金挪往轉換穩定的組合。`;
    } else if (overview.ctr < 1.0) {
      topRecommendation = `素材破局：點擊率偏低，建議開闢新文案切角與短影音前 3 秒 Hook 測試。`;
    } else {
      topRecommendation = `乘勝追擊：帳號體質健康穩定，可針對 ROAS 領先之主力活動微調增加 15% 預算擴圈。`;
    }

    return {
      score: totalScore,
      grade,
      accountName: overview.accountName,
      accountId: cleanId,
      currency: overview.currency,
      dimensions: {
        fatigueRisk: { score: fatigueScore, maxScore: 25, status: fatigueScore >= 20 ? '良好' : '警戒', detail: fatigueDetail },
        budgetStructure: { score: structureScore, maxScore: 25, status: structureScore >= 20 ? '良好' : '待優化', detail: structureDetail },
        economicsRoi: { score: roiScore, maxScore: 25, status: roiScore >= 20 ? '健康' : '偏低', detail: roiDetail },
        clickIntent: { score: clickScore, maxScore: 25, status: clickScore >= 20 ? '優秀' : '待加強', detail: clickDetail },
      },
      passedChecks,
      failedChecks,
      topRecommendation,
    };
  }
}
