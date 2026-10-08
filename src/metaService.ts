import { config } from './config.js';

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
  primaryMetric: 'roas' | 'cpa';
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

export class MetaService {
  public static async request<T>(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<T> {
    const apiVersion = config.meta.apiVersion;
    const token = config.meta.accessToken;
    if (!token) {
      throw new Error('未設定 META_ACCESS_TOKEN');
    }

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
  }

  /**
   * 智慧萃取核心轉換數 (包含電商購買、名單留下、會員註冊、非營利捐款、預約等)
   */
  public static extractConversions(actions?: Array<{ action_type: string; value: string }>): number {
    if (!actions || actions.length === 0) return 0;

    // 1. 電商購買 / 實體門市下單
    const purchaseAct = actions.find(
      (a) =>
        a.action_type === 'purchase' ||
        a.action_type === 'omni_purchase' ||
        a.action_type === 'web_in_store_purchase'
    );
    if (purchaseAct) return parseFloat(purchaseAct.value || '0');

    // 2. 名單收集 / 預約諮詢 / 註冊 / 捐款
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
    if (leadAct) return parseFloat(leadAct.value || '0');

    return 0;
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

    const conversions = this.extractConversions(insight.actions);
    const cpa = conversions > 0 ? spend / conversions : 0;
    const { roas } = this.extractRevenue(insight.action_values, insight.purchase_roas, spend);

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
      const conversions = this.extractConversions(insight?.actions);
      const cpa = conversions > 0 ? spend / conversions : 0;
      const { roas } = this.extractRevenue(insight?.action_values, insight?.purchase_roas, spend);

      let budgetDesc = 'ABO';
      if (c.daily_budget) {
        budgetDesc = `CBO $${(parseFloat(c.daily_budget) / 100).toFixed(0)}/日`;
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
        primaryMetric: roas > 0 ? 'roas' : 'cpa',
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
    const res = await this.request<{
      data: Array<{ id: string; name: string; currency: string; account_status: number }>;
    }>('/me/adaccounts?fields=id,name,currency,account_status&limit=50');

    return (res.data || []).map((acc) => ({
      id: acc.id,
      name: acc.name,
      currency: acc.currency,
      statusLabel: acc.account_status === 1 ? 'ACTIVE' : `STATUS_${acc.account_status}`,
    }));
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
   * 吸血鬼 vs 金牛素材四象限分析 (Creative Matrix，支援 ROAS 電商模式與 CPA 名單模式雙軌制)
   */
  public static async getCreativeMatrix(accountId: string): Promise<{
    items: CreativeMatrixItem[];
    avgCtr: number;
    avgRoas: number;
    avgCpa: number;
    totalConversions: number;
    primaryMetric: 'roas' | 'cpa';
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

      const conversions = this.extractConversions(insight.actions);
      const cpa = conversions > 0 ? spend / conversions : 0;
      const { roas, revenue } = this.extractRevenue(insight.action_values, insight.purchase_roas, spend);

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
      });
    }

    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 2.0;
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

    // 判斷該帳號/素材群是名單獲客型 (CPA Mode) 還是電商轉單型 (ROAS Mode)
    const isCpaMode = avgRoas <= 0.05 && (totalConversions > 0 || totalSpend > 0);
    const primaryMetric: 'roas' | 'cpa' = isCpaMode ? 'cpa' : 'roas';

    const items: CreativeMatrixItem[] = parsed.map((p) => {
      let quadrant: 'winning' | 'vampire' | 'potential' | 'fatigued' = 'fatigued';
      const isHighCtr = p.ctr >= avgCtr;

      if (isCpaMode) {
        // 名單獲客模式：CPA 越低越好 (獲客成本低於大盤平均且有轉換)
        const isGoodCpa = p.conversions > 0 && (avgCpa === 0 || p.cpa <= avgCpa);

        if (isHighCtr && isGoodCpa) {
          quadrant = 'winning';    // 🏆 金牛名單素材 (高點擊 + 低獲客成本)
        } else if (isHighCtr && !isGoodCpa) {
          quadrant = 'vampire';    // 🧛 吸血鬼素材 (高點擊 + 高獲客成本/零轉換)
        } else if (!isHighCtr && isGoodCpa) {
          quadrant = 'potential';  // 💎 潛力金礦 (低點擊 + 低獲客成本)
        } else {
          quadrant = 'fatigued';   // 🥀 疲勞淘汰 (低點擊 + 高獲客成本/零轉換)
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

    return { items, avgCtr, avgRoas, avgCpa, totalConversions, primaryMetric };
  }
}
