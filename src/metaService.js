import { config } from './config.js';
export class MetaService {
    static async request(endpoint, params = {}) {
        const apiVersion = config.meta.apiVersion;
        const token = config.meta.accessToken;
        if (!token) {
            throw new Error('未設定 META_ACCESS_TOKEN');
        }
        const url = new URL(endpoint.startsWith('http')
            ? endpoint
            : `https://graph.facebook.com/${apiVersion}/${endpoint.replace(/^\//, '')}`);
        url.searchParams.set('access_token', token);
        for (const [key, val] of Object.entries(params)) {
            url.searchParams.set(key, String(val));
        }
        const res = await fetch(url.toString());
        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error(data.error?.message || res.statusText);
        }
        return data;
    }
    static async getAccountOverview(accountId, datePreset = 'last_7d') {
        const accountInfo = await this.request(`/${accountId}`, {
            fields: 'id,name,account_status,currency',
        });
        const insightsRes = await this.request(`/${accountId}/insights`, {
            date_preset: datePreset,
            fields: 'spend,impressions,clicks,ctr,cpc,cpm,frequency,actions,action_values,cost_per_action_type,purchase_roas',
        });
        const insight = insightsRes.data?.[0] || {};
        const spend = parseFloat(insight.spend || '0');
        const impressions = parseInt(insight.impressions || '0', 10);
        const clicks = parseInt(insight.clicks || '0', 10);
        const ctr = parseFloat(insight.ctr || '0');
        const cpc = parseFloat(insight.cpc || '0');
        const cpm = parseFloat(insight.cpm || '0');
        const frequency = parseFloat(insight.frequency || '0');
        let conversions = 0;
        if (insight.actions) {
            const act = insight.actions.find((a) => a.action_type === 'purchase' ||
                a.action_type === 'omni_purchase' ||
                a.action_type === 'lead' ||
                a.action_type === 'complete_registration');
            if (act)
                conversions = parseFloat(act.value || '0');
        }
        const cpa = conversions > 0 ? spend / conversions : 0;
        let roas = 0;
        if (insight.purchase_roas && insight.purchase_roas.length > 0) {
            roas = parseFloat(insight.purchase_roas[0].value || '0');
        }
        else if (insight.action_values && spend > 0) {
            const actVal = insight.action_values.find((a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
            if (actVal)
                roas = parseFloat(actVal.value || '0') / spend;
        }
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
    static async listCampaigns(accountId, datePreset = 'last_7d', limit = 6) {
        const res = await this.request(`/${accountId}/campaigns`, {
            limit,
            effective_status: JSON.stringify(['ACTIVE']),
            fields: `id,name,effective_status,daily_budget,lifetime_budget,insights.date_preset(${datePreset}){spend,ctr,purchase_roas}`,
        });
        return (res.data || []).map((c) => {
            const insight = c.insights?.data?.[0];
            const spend = insight ? parseFloat(insight.spend || '0') : 0;
            const ctr = insight ? parseFloat(insight.ctr || '0') : 0;
            const roas = insight?.purchase_roas && insight.purchase_roas.length > 0
                ? parseFloat(insight.purchase_roas[0].value || '0')
                : 0;
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
            };
        });
    }
    static async detectFatigue(accountId, minSpend = 30) {
        const [adsRes, recentRes, baseRes] = await Promise.all([
            this.request(`/${accountId}/ads`, {
                limit: 30,
                effective_status: JSON.stringify(['ACTIVE']),
                fields: 'id,name',
            }),
            this.request(`/${accountId}/insights`, {
                level: 'ad',
                date_preset: 'last_3d',
                fields: 'ad_id,spend,frequency,ctr,actions',
                limit: 50,
            }),
            this.request(`/${accountId}/insights`, {
                level: 'ad',
                date_preset: 'last_7d',
                fields: 'ad_id,spend,frequency,ctr,actions',
                limit: 50,
            }),
        ]);
        const recentMap = new Map(recentRes.data?.map((r) => [r.ad_id, r]));
        const baseMap = new Map(baseRes.data?.map((b) => [b.ad_id, b]));
        const fatigued = [];
        for (const ad of adsRes.data || []) {
            const r = recentMap.get(ad.id);
            const b = baseMap.get(ad.id);
            if (!r)
                continue;
            const spendR = parseFloat(r.spend || '0');
            if (spendR < minSpend)
                continue; // 防呆
            const spendB = b ? parseFloat(b.spend || '0') : spendR;
            const freqR = parseFloat(r.frequency || '0');
            const ctrR = parseFloat(r.ctr || '0');
            const ctrB = b ? parseFloat(b.ctr || '0') : ctrR;
            const convR = r.actions?.find((a) => a.action_type === 'purchase')?.value || '0';
            const convB = b?.actions?.find((a) => a.action_type === 'purchase')?.value || '0';
            const cpaR = parseFloat(convR) > 0 ? spendR / parseFloat(convR) : spendR;
            const cpaB = parseFloat(convB) > 0 ? spendB / parseFloat(convB) : spendB;
            const freqTrigger = freqR > 4.0;
            const ctrDropPct = ctrB > 0 ? ((ctrB - ctrR) / ctrB) * 100 : 0;
            const ctrTrigger = ctrDropPct > 15.0;
            const cpaIncPct = cpaB > 0 ? ((cpaR - cpaB) / cpaB) * 100 : 0;
            const cpaTrigger = cpaIncPct > 20.0;
            let met = 0;
            if (freqTrigger)
                met++;
            if (ctrTrigger)
                met++;
            if (cpaTrigger)
                met++;
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
}
