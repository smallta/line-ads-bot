import { config, KNOWN_ACCOUNTS, getAccountIndustry, IndustryType } from './config.js';
import { MetaService } from './metaService.js';

export interface DiagnosticReportPayload {
  report_date: string;
  industry: IndustryType;
  target_roas: number;
  today_metrics: {
    ad_spend: number;
    revenue: number;
    roas: number;
    cpm: number;
    cpc: number;
    clicks: number;
    ctr: number;
    cvr: number;
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
    cpm: number;
    cpc: number;
    ctr: number;
    cvr: number;
    cpa: number;
    aov: number;
    cost_per_messaging?: number;
  };
  campaign_breakdown: Array<{
    campaign_id: string;
    name: string;
    spend: number;
    roas: number;
    cpm: number;
    cpc: number;
    clicks: number;
    ctr: number;
    cvr: number;
    cpa: number;
    frequency: number;
    messaging_conversations?: number;
    cost_per_messaging?: number;
    leads?: number;
    baseline_7d?: {
      roas: number;
      cpm: number;
      cpc: number;
      ctr: number;
      cvr: number;
      cpa: number;
    };
    budget_info?: {
      daily_budget?: number;
      lifetime_budget?: number;
      budget_remaining?: number;
      stop_time?: string;
      days_remaining?: number;
      time_elapsed_pct?: number;
      budget_spent_pct?: number;
    };
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
    if (
      sanitize(alias) === target ||
      sanitize(info.name) === target ||
      sanitize(alias).includes(target)
    ) {
      return info.id;
    }
  }
  const digits = clean.replace(/[^0-9]/g, '');
  return digits.length >= 6 ? `act_${digits}` : config.meta.defaultAdAccountId;
}

/**
 * 供 Render 雲端與晨報推播調用的深度診斷清洗報表產生器
 * 完整涵蓋：CPM / CPC / CTR / CVR 漏斗歸因、1.5x CPA 嚴重浪費、CPC 飆升歸因、以及日預算/總走期預算消化進度
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

  const [accTodayRes, accBaseRes, campTodayRes, campBaseRes, campMetaRes] = await Promise.all([
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
    MetaService.request<{ data: any[] }>(`/${accountId}/campaigns`, {
      fields:
        'id,name,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,adsets{daily_budget,lifetime_budget,budget_remaining,start_time,stop_time}',
      limit: 200,
    }).catch(() => ({ data: [] })),
  ]);

  const calcRow = (row: any) => {
    if (!row) {
      return {
        ad_spend: 0,
        revenue: 0,
        roas: 0,
        cpm: 0,
        cpc: 0,
        clicks: 0,
        ctr: 0,
        cvr: 0,
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
    const clicks = Math.round(safeNum(row.clicks));
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
      cpm: safeDiv(spend, impressions, 1000),
      cpc: safeDiv(spend, clicks),
      clicks,
      ctr: safeDiv(clicks, impressions, 100),
      cvr: safeDiv(primaryConversions, clicks, 100),
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
      ? { roas: 0, cpm: 0, cpc: 0, ctr: 0, cvr: 0, cpa: 0, aov: 0, cost_per_messaging: 0 }
      : {
          roas: safeDiv(baseList.reduce((s, r) => s + r.roas, 0), cnt),
          cpm: safeDiv(baseList.reduce((s, r) => s + r.cpm, 0), cnt),
          cpc: safeDiv(baseList.reduce((s, r) => s + r.cpc, 0), cnt),
          ctr: safeDiv(baseList.reduce((s, r) => s + r.ctr, 0), cnt),
          cvr: safeDiv(baseList.reduce((s, r) => s + r.cvr, 0), cnt),
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

  const campMetaMap = new Map<string, any>();
  for (const c of campMetaRes.data || []) {
    if (c.id) campMetaMap.set(c.id, c);
  }

  const industry = getAccountIndustry(accountId);

  const campaign_breakdown = (campTodayRes.data || []).map((row: any) => {
    const m = calcRow(row);
    const freq = round2(safeNum(row.frequency));
    const notes: string[] = [];

    const baseCamp = row.campaign_id ? calcRow(baseCampMap.get(row.campaign_id)) : null;
    const refRoas = baseCamp && baseCamp.roas > 0 ? baseCamp.roas : baseline_7d_avg.roas;
    const refCpa = baseCamp && baseCamp.cpa > 0 ? baseCamp.cpa : baseline_7d_avg.cpa;
    const refCvr = baseCamp && baseCamp.cvr > 0 ? baseCamp.cvr : baseline_7d_avg.cvr;
    const refCtr = baseCamp && baseCamp.ctr > 0 ? baseCamp.ctr : baseline_7d_avg.ctr;
    const refCpm = baseCamp && baseCamp.cpm > 0 ? baseCamp.cpm : baseline_7d_avg.cpm;
    const refCpc = baseCamp && baseCamp.cpc > 0 ? baseCamp.cpc : baseline_7d_avg.cpc;

    const primaryConversions =
      m.purchases > 0 ? m.purchases : m.messaging_conversations > 0 ? m.messaging_conversations : m.leads;

    const campName = row.campaign_name || '';

    // ==========================================
    // 核心判定基準 (Level 3 Engine)
    // ==========================================

    // 1. 統計顯著性閘門（全產業通用・防誤殺）
    // 若單日花費 < 2x 目標 CPA，或單日連結點擊數 < 25 次：一律標記為【觀察中（小樣本波動）】，嚴禁觸發 P0 緊急停用或成效疲軟警報。
    const targetCpaThreshold = refCpa > 0 ? refCpa * 2 : 500;
    const isSmallSample = m.ad_spend > 0 && (m.ad_spend < targetCpaThreshold || m.clicks < 25);

    if (isSmallSample) {
      notes.push(
        `【觀察中（小樣本波動）】單日花費$${m.ad_spend}<$${Math.round(targetCpaThreshold)}或點擊${m.clicks}<25次，嚴禁觸發P0停用或疲軟警報`
      );
    } else if (m.ad_spend > 0) {
      // 通過統計閘門後才判定：嚴重浪費或成效疲軟
      if (primaryConversions === 0 && refCpa > 0 && m.ad_spend >= refCpa * 1.5) {
        notes.push(`【P0 警報：嚴重浪費】花費$${m.ad_spend}已超過1.5倍基準CPA($${refCpa})但0轉化`);
      } else if (refRoas > 0 && m.roas < refRoas * 0.8) {
        const dropPct = round2(((refRoas - m.roas) / refRoas) * 100);
        notes.push(`【成效疲軟】ROAS(${m.roas})較7日基準(${refRoas})下跌${dropPct}% (>20%)`);
      } else if (refRoas === 0 && refCpa > 0 && m.cpa > refCpa * 1.2) {
        const risePct = round2(((m.cpa - refCpa) / refCpa) * 100);
        notes.push(`【成效疲軟】CPA($${m.cpa})較7日基準($${refCpa})飆升${risePct}% (>20%)`);
      }
    }

    // 2. 產業專屬心智與歸因模組 (Industry Matrix)
    if (industry === 'medical_aesthetics') {
      const isHighTicket = /精靈針|電波|音波|童顏|拉提|抗老|微整|鳳凰|索夫波|艾麗斯|舒顏卒|Sculptra|AestheFill/i.test(campName);
      const isEntryProduct = /熊貓針|除皺|肉毒|雷射|光療|皮秒|體態|淨膚|水飛梭/i.test(campName);

      if (isHighTicket) {
        notes.push(
          `【高單抗老項目】啟動7~14天決策滯後性(Attribution Lag)，禁止以單日CPA判死；若高CTR+低諮詢優先排查Messenger歡迎詞與破冰選單`
        );
      } else if (isEntryProduct) {
        if (refCtr > 0 && m.ctr < refCtr * 0.7 && refCpc > 0 && m.cpc > refCpc * 1.3) {
          notes.push(`【素材實質疲勞】Link CTR較7日峰值下滑>30%且CPC上漲>30%，建議更換前3秒視覺Hook切角`);
        }
      }
    } else if (industry === 'ecom_fastfashion') {
      notes.push(`【快銷電商】實施24小時即時ROAS止血機制`);
      if (m.clicks >= 25 && m.cart_adds / m.clicks > 0.08 && m.purchases === 0) {
        notes.push(`【高加購低結帳】加購率>8%但結帳率低，優先排查運費門檻或付款體驗障礙`);
      }
    } else if (industry === 'online_courses') {
      if (refCtr > 0 && m.ctr < refCtr * 0.7) {
        notes.push(`【線上課程】點擊率顯著下滑，判定為素材失效，募資晚期重點佈局再行銷名單`);
      }
    } else if (industry === 'b2b_services') {
      notes.push(`【B2B/名單服務】允許單名單高CPA($1,500+)；高CPC優先排查受眾包過窄互踩競價(Auction Overlap)`);
    }

    // 3. 流量漏斗通用歸因
    if (
      m.ctr > 1.5 &&
      m.clicks >= 15 &&
      ((refCvr > 0 && m.cvr < refCvr * 0.7) || (refCvr === 0 && m.cvr < 10))
    ) {
      notes.push(
        `【高CTR+低CVR陷阱】CTR高達${m.ctr}%但CVR僅${m.cvr}%，優先排查Messenger破冰問題門檻過高或落地頁障礙`
      );
    }

    // 4. CPC 突然飆升 > 30% 歸因
    if (refCpc > 0 && m.cpc > refCpc * 1.3) {
      const cpcRise = round2(((m.cpc - refCpc) / refCpc) * 100);
      if (refCpm > 0 && m.cpm > refCpm * 1.15) {
        notes.push(
          `【CPC飆升+${cpcRise}%】主因為外部競價擠壓(CPM由$${refCpm}飆至$${m.cpm})`
        );
      } else {
        notes.push(
          `【CPC飆升+${cpcRise}%】CPM穩定($${m.cpm})，主因為素材CTR下滑(由${refCtr}%降至${m.ctr}%)`
        );
      }
    }

    // 規則 6: 解析預算與走期消化進度 (Budget Pacing)
    const metaCamp = row.campaign_id ? campMetaMap.get(row.campaign_id) : undefined;
    let budgetInfo:
      | {
          daily_budget?: number;
          lifetime_budget?: number;
          budget_remaining?: number;
          stop_time?: string;
          days_remaining?: number;
          time_elapsed_pct?: number;
          budget_spent_pct?: number;
        }
      | undefined;

    if (metaCamp) {
      const firstAdset = metaCamp.adsets?.data?.[0];
      const rawDaily = safeNum(metaCamp.daily_budget) || safeNum(firstAdset?.daily_budget);
      const rawLifetime = safeNum(metaCamp.lifetime_budget) || safeNum(firstAdset?.lifetime_budget);
      const rawRemaining =
        safeNum(metaCamp.budget_remaining) || safeNum(firstAdset?.budget_remaining);
      const startTimeStr = metaCamp.start_time || firstAdset?.start_time;
      const stopTimeStr = metaCamp.stop_time || firstAdset?.stop_time;

      const dailyBudget = rawDaily >= 100 ? round2(rawDaily / 100) : rawDaily;
      const lifetimeBudget = rawLifetime >= 100 ? round2(rawLifetime / 100) : rawLifetime;
      const budgetRemaining = rawRemaining >= 100 ? round2(rawRemaining / 100) : rawRemaining;

      budgetInfo = {};
      if (dailyBudget > 0) {
        budgetInfo.daily_budget = dailyBudget;
        if (m.clicks > 0 && m.clicks < 25 && dailyBudget <= 400) {
          notes.push(
            `【日預算受限】日預算僅$${dailyBudget}(單日點擊${m.clicks}次<25次統計顯著量)，易導致演算法學習失真`
          );
        }
      }
      if (lifetimeBudget > 0) {
        budgetInfo.lifetime_budget = lifetimeBudget;
        budgetInfo.budget_remaining = budgetRemaining;
        const spentPct = round2(((lifetimeBudget - budgetRemaining) / lifetimeBudget) * 100);
        budgetInfo.budget_spent_pct = spentPct;

        if (startTimeStr && stopTimeStr) {
          const startMs = new Date(startTimeStr).getTime();
          const stopMs = new Date(stopTimeStr).getTime();
          const nowMs = Date.now();
          budgetInfo.stop_time = stopTimeStr.split('T')[0];
          const daysRem = Math.max(0, round2((stopMs - nowMs) / 86400000));
          budgetInfo.days_remaining = daysRem;

          if (stopMs > startMs) {
            const elapsedPct = Math.min(100, Math.max(0, round2(((nowMs - startMs) / (stopMs - startMs)) * 100)));
            budgetInfo.time_elapsed_pct = elapsedPct;
            if (elapsedPct >= 70 && spentPct < 40) {
              notes.push(
                `【出價或競價受限，預算無法消化】走期已過${elapsedPct}%但總預算($${lifetimeBudget})僅消耗${spentPct}%`
              );
            } else if (elapsedPct - spentPct >= 20) {
              notes.push(
                `【預算消化落後】總預算$${lifetimeBudget}(剩${daysRem}天)，走期已過${elapsedPct}%但預算僅消耗${spentPct}%`
              );
            }
          }
        }
      }
    }

    return {
      campaign_id: row.campaign_id || 'unknown',
      name: row.campaign_name || 'Unnamed Campaign',
      spend: m.ad_spend,
      roas: m.roas,
      cpm: m.cpm,
      cpc: m.cpc,
      clicks: m.clicks,
      ctr: m.ctr,
      cvr: m.cvr,
      cpa: m.cpa,
      frequency: freq,
      messaging_conversations: m.messaging_conversations,
      cost_per_messaging: m.cost_per_messaging,
      leads: m.leads,
      baseline_7d: baseCamp
        ? {
            roas: baseCamp.roas,
            cpm: baseCamp.cpm,
            cpc: baseCamp.cpc,
            ctr: baseCamp.ctr,
            cvr: baseCamp.cvr,
            cpa: baseCamp.cpa,
          }
        : undefined,
      budget_info: budgetInfo && Object.keys(budgetInfo).length > 0 ? budgetInfo : undefined,
      note: notes.length > 0 ? notes.join('；') : '正常',
    };
  });

  return {
    report_date: reportDate,
    industry,
    target_roas: targetRoas,
    today_metrics: todayMetrics,
    baseline_7d_avg,
    campaign_breakdown,
  };
}
