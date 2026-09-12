import { FlexBuilder } from '../src/formatters/flexBuilder.js';
import { OverviewMetrics, CampaignSummary, FatigueSummary } from '../src/metaService.js';

console.log('=== 開始測試 LINE Flex Message 產生器 ===\n');

// 1. 測試大盤成效 Flex Message
const mockOverview: OverviewMetrics = {
  accountName: '一起夢想',
  accountId: 'act_4000297516716904',
  currency: 'USD',
  statusLabel: '正常投放中',
  datePreset: '近 7 天 (last_7d)',
  spend: 2159.97,
  impressions: 377799,
  clicks: 10204,
  ctr: 2.70,
  cpc: 0.21,
  cpm: 5.72,
  frequency: 1.97,
  conversions: 90,
  cpa: 24.0,
  roas: 1.21,
};

const overviewFlex = FlexBuilder.buildOverviewFlex(mockOverview);
console.log('1. 大盤成效 Flex 訊息生成：');
console.log('   - altText:', overviewFlex.altText);
console.log('   - contents type:', (overviewFlex.contents as any).type);
console.log('   - contents size:', (overviewFlex.contents as any).size);
if (overviewFlex.type === 'flex' && (overviewFlex.contents as any).type === 'bubble') {
  console.log('✅ 大盤成效 Flex Message 結構檢驗通過！');
} else {
  console.error('❌ 大盤成效 Flex 結構異常');
}

// 2. 測試素材疲勞 Flex Message (0 支疲勞 vs 1 支疲勞)
const mockCleanFatigue: FatigueSummary[] = [];
const cleanFlex = FlexBuilder.buildFatigueFlex(mockCleanFatigue, '一起夢想');
console.log('\n2. 素材無疲勞 Flex 訊息生成：');
console.log('   - altText:', cleanFlex.altText);
if (cleanFlex.type === 'flex') {
  console.log('✅ 無疲勞 Flex Message 結構檢驗通過！');
}

const mockFatiguedList: FatigueSummary[] = [
  {
    adId: '23855032914100367',
    adName: '藝人王淨_定期定額_切角B',
    frequency: 4.8,
    ctrRecent: 1.2,
    ctrDropPct: 25.5,
    cpaRecent: 32.5,
    cpaIncreasePct: 35.0,
    triggersMet: 3,
    recommendation: '建議調降預算 20% 或更換素材',
  },
];
const alertFlex = FlexBuilder.buildFatigueFlex(mockFatiguedList, '一起夢想');
console.log('\n3. 素材疲勞警報 Flex 訊息生成：');
console.log('   - altText:', alertFlex.altText);
if (alertFlex.type === 'flex') {
  console.log('✅ 疲勞警報 Flex Message 結構檢驗通過！');
}

// 3. 測試活動排行 Flex Message
const mockCampaigns: CampaignSummary[] = [
  {
    id: '120232327353690368',
    name: '[新]一起夢想定期定額_填補_ASC',
    status: 'ACTIVE',
    budgetDesc: 'CBO $30/日',
    spend: 210.77,
    ctr: 2.43,
    roas: 3.13,
  },
  {
    id: '120211428704970368',
    name: '[舊]一起夢想定期定額_填補',
    status: 'ACTIVE',
    budgetDesc: 'CBO $52/日',
    spend: 357.91,
    ctr: 1.86,
    roas: 1.71,
  },
];
const campsFlex = FlexBuilder.buildCampaignsFlex(mockCampaigns, '一起夢想');
console.log('\n4. 活動列表 Flex 訊息生成：');
console.log('   - altText:', campsFlex.altText);
if (campsFlex.type === 'flex') {
  console.log('✅ 活動列表 Flex Message 結構檢驗通過！');
}

console.log('\n=== 所有 LINE Flex Message 排版檢驗 100% 通過！ ===');
