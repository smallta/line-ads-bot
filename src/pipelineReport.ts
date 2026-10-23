import { config, KNOWN_ACCOUNTS } from './config.js';
import { MetaService } from './metaService.js';

export interface DiagnosticReportPayload {
  report_date: string;
  target_roas: number;
  today_metrics: {
    ad_spend: number;
    revenue: number;
    roas: number;
    cpc: number;
    ctr: number;
    purchases: number;
    cpa: number;
    aov: number;
    cart_adds: number;
    checkout_initiated: number;
    messaging_conversations?: number;
    cost_per_messaging?: number;
    leads?: number;
  };
  baseline_7d_avg: {
    roas: number;
    cpc: number;
    ctr: number;
    cpa: number;
    aov: number;
    cost_per_messaging?: number;
  };
  campaign_breakdown: Array<{
    campaign_id: string;
    name: string;
    spend: number;
    roas: number;
    frequency: number;
    ctr: number;
    messaging_conversations?: number;
    cost_per_messaging?: number;
    note: string;
  }>;
}

function safeNum(val: unknown): number {
  const n = Number(val ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function round2(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Number((Math.round((val + Number.EPSILON) * 100) / 100).toFixed(2));
}

function safeDiv(num: number, den: number, mult = 1): number {
  if (den <= 0 || num <= 0) return 0;
  return round2((num / den) * mult);
}

function extractAction(
  items: Array<{ action_type: string; value: string | number }> | undefined,
  types: string[]
): number {
  if (!Array.isArray(items)) return 0;
  for (const t of types) {
    const found = items.find((i) => i.action_type === t);
    if (found !== undefined) return safeNum(found.value);
  }
  return 0;
}

function resolveAccount(input?: string): string {
  if (!input || !input.trim()) return config.meta.defaultAdAccountId;
  const clean = input.trim();
  const sanitize = (s: string) => s.toLowerCase().replace(/[\s._\-()【】]/g, '');
  const target = sanitize(clean);
  for (const [alias, info] of Object.entries(KNOWN_ACCOUNTS)) {
    if (sanitize(alias) === target || sanitize(info.name) === target || sanitize(alias).includes(target)) {
      return info.id;
    }
  }
  const digits = clean.replace(/[^0-9]/g, '');
  return digits.length >= 6 ? `act_${digits}` : config.meta.defaultAdAccountId;
}

/**
 * 供 Render 雲端環境與晨報推播調用的標準化雙軌清洗報表產生器
 * 支援：1. 醫美/私訊導向 (messaging_conversations, cost_per_messaging)
 *       2. 公益/名單導向 (purchases/leads, cpa)
 *       3. 電商/購買導向 (roas, aov, cart_adds, checkout_initiated)
 */
export async function generateCleanedDiagnosticReport(options: {
  date?: string;
  account?: string;
  targetRoas?: number;
}): Promise<DiagnosticReportPayload> {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const reportDate =
    options.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date) ? options.date : fmt(yesterday);
  const targetRoas = round2(safeNum(options.targetRoas) || 3.5);
  const accountId = resolveAccount(options.account);

  const [y, m, d] = reportDate.split('-').map(Number);
  const baseStart = fmt(new Date(y, m - 1, d - 7));
  const baseEnd = fmt(new Date(y, m - 1, d - 1));

  const fields =
    'campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,frequency,actions,action_values';

  const [accTodayRes, accBaseRes, campTodayRes, campBaseRes] = await Promise.all([
    MetaService.request<{ data: any[] }>(`/${accountId}/insights`, {
      level: 'account',
      fields,
      time_range: JSON.stringify({ since: reportDate, until: reportDate }),
    }),
    MetaService.request<{ data: any[] }>(`/${accountId}/insights`, {
      level: 'account',
      fields,
      time_range: JSON.stringify({ since: baseStart, until: baseEnd }),
      time_increment: 1,
    }),
    MetaService.request<{ data: any[] }>(`/${accountId}/insights`, {
      level: 'campaign',
      fields,
      time_range: JSON.stringify({ since: reportDate, until: reportDate }),
      limit: 500,
    }),
    MetaService.request<{ data: any[] }>(`/${accountId}/insights`, {
      level: 'campaign',
      fields,
      time_range: JSON.stringify({ since: baseStart, until: baseEnd }),
      limit: 500,
    }),
  ]);

  const calcRow = (row: any) => {
    if (!row) {
      return {
        ad_spend: 0,
        revenue: 0,
        roas: 0,
        cpc: 0,
        ctr: 0,
        purchases: 0,
        cpa: 0,
        aov: 0,
        cart_adds: 0,
        checkout_initiated: 0,
        messaging_conversations: 0,
        cost_per_messaging: 0,
        leads: 0,
      };
    }
    const spend = round2(safeNum(row.spend));
    const impressions = safeNum(row.impressions);
    const clicks = safeNum(row.clicks);
    const purchases = Math.round(
      extractAction(row.actions, ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'])
    );
    const cartAdds = Math.round(
      extractAction(row.actions, ['add_to_cart', 'omni_add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart'])
    );
    const checkouts = Math.round(
      extractAction(row.actions, [
        'initiate_checkout',
        'omni_initiated_checkout',
        'offsite_conversion.fb_pixel_initiate_checkout',
      ])
    );
    const messaging = Math.round(
      extractAction(row.actions, [
        'onsite_conversion.messaging_conversation_started_7d',
        'onsite_conversion.total_messaging_connection',
      ])
    );
    const leads = Math.round(
      extractAction(row.actions, ['lead', 'onsite_conversion.lead_grouped'])
    );
    const revenue = round2(
      extractAction(row.action_values, ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'])
    );

    const primaryConversions = purchases > 0 ? purchases : messaging > 0 ? messaging : leads;

    return {
      ad_spend: spend,
      revenue,
      roas: safeDiv(revenue, spend),
      cpc: safeDiv(spend, clicks),
      ctr: safeDiv(clicks, impressions, 100),
      purchases,
      cpa: safeDiv(spend, primaryConversions),
      aov: safeDiv(revenue, purchases),
      cart_adds: cartAdds,
      checkout_initiated: checkouts,
      messaging_conversations: messaging,
      cost_per_messaging: safeDiv(spend, messaging),
      leads,
    };
  };

  const todayMetrics = calcRow(accTodayRes.data?.[0]);
  const baseRows = (accBaseRes.data || []).filter((r: any) => r.date_start !== reportDate);
  const baseList = baseRows.map(calcRow);
  const cnt = baseList.length;

  const baseline_7d_avg =
    cnt === 0
      ? { roas: 0, cpc: 0, ctr: 0, cpa: 0, aov: 0, cost_per_messaging: 0 }
      : {
          roas: safeDiv(baseList.reduce((s, r) => s + r.roas, 0), cnt),
          cpc: safeDiv(baseList.reduce((s, r) => s + r.cpc, 0), cnt),
          ctr: safeDiv(baseList.reduce((s, r) => s + r.ctr, 0), cnt),
          cpa: safeDiv(baseList.reduce((s, r) => s + r.cpa, 0), cnt),
          aov: safeDiv(baseList.reduce((s, r) => s + r.aov, 0), cnt),
          cost_per_messaging: safeDiv(
            baseList.reduce((s, r) => s + (r.cost_per_messaging || 0), 0),
            cnt
          ),
        };

  const baseCampMap = new Map<string, any>();
  for (const r of campBaseRes.data || []) {
    if (r.campaign_id) baseCampMap.set(r.campaign_id, r);
  }

  const campaign_breakdown = (campTodayRes.data || []).map((row: any) => {
    const m = calcRow(row);
    const freq = round2(safeNum(row.frequency));
    const notes: string[] = [];

    if (freq > 2.5) {
      notes.push(`頻次過高(${freq}>2.5)，受眾可能疲勞`);
    }
    const baseCamp = row.campaign_id ? calcRow(baseCampMap.get(row.campaign_id)) : null;
    const refRoas = baseCamp && baseCamp.roas > 0 ? baseCamp.roas : baseline_7d_avg.roas;

    if (m.ad_spend > 0) {
      if (refRoas > 0 && m.roas < refRoas * 0.7) {
        const dropPct = round2(((refRoas - m.roas) / refRoas) * 100);
        notes.push(`ROAS異常跌落(當日${m.roas} vs 7日基準${refRoas}，跌幅${dropPct}%)`);
      } else if (m.roas < targetRoas) {
        const hasMessagingOrLead =
          m.messaging_conversations > 0 ||
          m.leads > 0 ||
          (Array.isArray(row.actions) &&
            row.actions.some((a: any) =>
              [
                'onsite_conversion.messaging_conversation_started_7d',
                'onsite_conversion.total_messaging_connection',
                'lead',
                'post_engagement',
              ].includes(a.action_type)
            ));
        if (m.roas === 0 && refRoas === 0 && hasMessagingOrLead) {
          const msgInfo =
            m.messaging_conversations > 0
              ? `，當日私訊${m.messaging_conversations}則(單則$${m.cost_per_messaging})`
              : '';
          notes.push(
            `互動/私訊導向活動(無電商ROAS${msgInfo}，CTR ${m.ctr}% / CPC $${m.cpc})`
          );
        } else {
          notes.push(`ROAS未達標(當日${m.roas} < 目標${targetRoas})`);
        }
      }
    }

    return {
      campaign_id: row.campaign_id || 'unknown',
      name: row.campaign_name || 'Unnamed Campaign',
      spend: m.ad_spend,
      roas: m.roas,
      frequency: freq,
      ctr: m.ctr,
      messaging_conversations: m.messaging_conversations,
      cost_per_messaging: m.cost_per_messaging,
      note: notes.length > 0 ? notes.join('；') : '正常',
    };
  });

  return {
    report_date: reportDate,
    target_roas: targetRoas,
    today_metrics: todayMetrics,
    baseline_7d_avg,
    campaign_breakdown,
  };
}
