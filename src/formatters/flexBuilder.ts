import { messagingApi } from '@line/bot-sdk';
import { OverviewMetrics, CampaignSummary, FatigueSummary, PatrolItem, CreativeMatrixItem, WeeklyComparison, ConversionGoalType } from '../metaService.js';

export class FlexBuilder {
  /**
   * 1. 建立大盤成效儀表板 Flex Message
   */
  public static buildOverviewFlex(metrics: OverviewMetrics): messagingApi.FlexMessage {
    const isMessagingAccount = metrics.conversionGoal === 'messaging';
    const isLeadAccount = !isMessagingAccount && (metrics.roas <= 0.05 && (metrics.conversions > 0 || metrics.spend > 0));
    const roasColor = metrics.roas >= 2.0 ? '#059669' : metrics.roas >= 1.0 ? '#2563EB' : '#DC2626';

    const bubble: any = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'META ADS 診斷報告',
                size: 'xs',
                color: '#38BDF8',
                weight: 'bold',
              },
              {
                type: 'text',
                text: metrics.datePreset,
                size: 'xs',
                color: '#94A3B8',
                align: 'end',
              },
            ],
          },
          {
            type: 'text',
            text: metrics.accountName,
            size: 'xl',
            color: '#FFFFFF',
            weight: 'bold',
            wrap: true,
            margin: 'sm',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          // 總花費大字展示
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#F8FAFC',
            cornerRadius: '12px',
            paddingAll: '12px',
            contents: [
              {
                type: 'text',
                text: `區間總花費 (${metrics.currency})`,
                size: 'xs',
                color: '#64748B',
              },
              {
                type: 'text',
                text: `$${metrics.spend.toLocaleString()}`,
                size: 'xxl',
                color: '#0F172A',
                weight: 'bold',
                margin: 'xs',
              },
            ],
          },
          // 核心 4 格指標 (2x2 Grid) - 根據互動訊息、名單模式或電商模式自動排列核心指標
          isMessagingAccount
            ? {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: '#F1F5F9',
                    cornerRadius: '8px',
                    paddingAll: '10px',
                    flex: 1,
                    contents: [
                      { type: 'text', text: '單則訊息成本', size: 'xxs', color: '#64748B' },
                      {
                        type: 'text',
                        text: metrics.cpa > 0 ? `$${metrics.cpa.toFixed(1)}` : '—',
                        size: 'lg',
                        weight: 'bold',
                        color: metrics.cpa > 0 ? '#059669' : '#0F172A',
                      },
                    ],
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: '#F1F5F9',
                    cornerRadius: '8px',
                    paddingAll: '10px',
                    flex: 1,
                    contents: [
                      { type: 'text', text: '開始對話數', size: 'xxs', color: '#64748B' },
                      {
                        type: 'text',
                        text: `${metrics.conversions} 則`,
                        size: 'lg',
                        weight: 'bold',
                        color: '#2563EB',
                      },
                    ],
                  },
                ],
              }
            : isLeadAccount
            ? {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: '#F1F5F9',
                    cornerRadius: '8px',
                    paddingAll: '10px',
                    flex: 1,
                    contents: [
                      { type: 'text', text: '獲客成本 CPA', size: 'xxs', color: '#64748B' },
                      {
                        type: 'text',
                        text: metrics.cpa > 0 ? `$${metrics.cpa.toFixed(1)}` : '—',
                        size: 'lg',
                        weight: 'bold',
                        color: metrics.cpa > 0 ? '#059669' : '#0F172A',
                      },
                    ],
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: '#F1F5F9',
                    cornerRadius: '8px',
                    paddingAll: '10px',
                    flex: 1,
                    contents: [
                      { type: 'text', text: '核心轉換數', size: 'xxs', color: '#64748B' },
                      {
                        type: 'text',
                        text: `${metrics.conversions} 筆`,
                        size: 'lg',
                        weight: 'bold',
                        color: '#2563EB',
                      },
                    ],
                  },
                ],
              }
            : {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: '#F1F5F9',
                    cornerRadius: '8px',
                    paddingAll: '10px',
                    flex: 1,
                    contents: [
                      { type: 'text', text: '投資報酬率 ROAS', size: 'xxs', color: '#64748B' },
                      {
                        type: 'text',
                        text: metrics.roas > 0 ? `${metrics.roas.toFixed(2)}x` : '—',
                        size: 'lg',
                        weight: 'bold',
                        color: roasColor,
                      },
                    ],
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: '#F1F5F9',
                    cornerRadius: '8px',
                    paddingAll: '10px',
                    flex: 1,
                    contents: [
                      { type: 'text', text: '獲客成本 CPA', size: 'xxs', color: '#64748B' },
                      {
                        type: 'text',
                        text: metrics.cpa > 0 ? `$${metrics.cpa.toFixed(1)}` : '—',
                        size: 'lg',
                        weight: 'bold',
                        color: '#0F172A',
                      },
                    ],
                  },
                ],
              },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#F1F5F9',
                cornerRadius: '8px',
                paddingAll: '10px',
                flex: 1,
                contents: [
                  { type: 'text', text: '點擊率 CTR', size: 'xxs', color: '#64748B' },
                  {
                    type: 'text',
                    text: `${metrics.ctr.toFixed(2)}%`,
                    size: 'lg',
                    weight: 'bold',
                    color: '#0F172A',
                  },
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#F1F5F9',
                cornerRadius: '8px',
                paddingAll: '10px',
                flex: 1,
                contents: (isMessagingAccount || isLeadAccount)
                  ? [
                      { type: 'text', text: '平均千次 CPM', size: 'xxs', color: '#64748B' },
                      {
                        type: 'text',
                        text: `$${metrics.cpm.toFixed(1)}`,
                        size: 'lg',
                        weight: 'bold',
                        color: '#0F172A',
                      },
                    ]
                  : [
                      { type: 'text', text: '核心轉換數', size: 'xxs', color: '#64748B' },
                      {
                        type: 'text',
                        text: `${metrics.conversions} 筆`,
                        size: 'lg',
                        weight: 'bold',
                        color: '#059669',
                      },
                    ],
              },
            ],
          },
          // 次要流量統計
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: `曝光: ${metrics.impressions.toLocaleString()}`,
                size: 'xs',
                color: '#94A3B8',
                flex: 1,
              },
              {
                type: 'text',
                text: `點擊: ${metrics.clicks.toLocaleString()}`,
                size: 'xs',
                color: '#94A3B8',
                flex: 1,
              },
              {
                type: 'text',
                text: `頻率: ${metrics.frequency.toFixed(2)}`,
                size: 'xs',
                color: '#94A3B8',
                align: 'end',
                flex: 1,
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '查活動', text: '查活動' },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '查疲勞', text: '查疲勞' },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '換帳號', text: '切換' },
          },
        ],
      },
    };

    const altText = isMessagingAccount
      ? `【${metrics.accountName}】成效快報：花費 $${metrics.spend.toLocaleString()}，發起 ${metrics.conversions} 則訊息 (單則 $${metrics.cpa.toFixed(0)})`
      : isLeadAccount
      ? `【${metrics.accountName}】成效快報：花費 $${metrics.spend.toLocaleString()}，累積 ${metrics.conversions} 筆轉換 (CPA $${metrics.cpa.toFixed(0)})`
      : `【${metrics.accountName}】成效快報：花費 $${metrics.spend.toLocaleString()}，ROAS ${metrics.roas.toFixed(2)}x (CPA $${metrics.cpa.toFixed(0)})`;

    return {
      type: 'flex',
      altText,
      contents: bubble as any,
    } as any as messagingApi.FlexMessage;
  }

  /**
   * 2. 建立素材疲勞檢測卡片 Flex Message
   */
  public static buildFatigueFlex(fatigued: FatigueSummary[], accountName: string): messagingApi.FlexMessage {
    const isClean = fatigued.length === 0;

    const bubble: any = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: isClean ? '#065F46' : '#991B1B',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: isClean ? '✅ 素材健康檢測報告' : '⚠️ 素材疲勞警報 (三選二觸發)',
            size: 'sm',
            color: '#FFFFFF',
            weight: 'bold',
          },
          {
            type: 'text',
            text: accountName,
            size: 'md',
            color: '#E2E8F0',
            wrap: true,
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: isClean
          ? [
              {
                type: 'text',
                text: '🎉 所有活躍素材狀態良好！',
                size: 'md',
                weight: 'bold',
                color: '#065F46',
              },
              {
                type: 'text',
                text: '目前沒有任何素材同時滿足「頻率>4.0、CTR降>15%、CPA漲>20%」的疲勞條件，續航力正常。',
                size: 'xs',
                color: '#64748B',
                wrap: true,
                margin: 'sm',
              },
            ]
          : [
              {
                type: 'text',
                text: `發現 ${fatigued.length} 支素材出現顯著疲勞徵兆：`,
                size: 'xs',
                color: '#64748B',
                wrap: true,
                margin: 'xs',
              },
              ...fatigued.slice(0, 4).map((f) => ({
                type: 'box' as const,
                layout: 'vertical' as const,
                backgroundColor: '#FEF2F2',
                cornerRadius: '8px',
                paddingAll: '10px',
                margin: 'xs' as const,
                contents: [
                  {
                    type: 'text' as const,
                    text: f.adName,
                    size: 'sm' as const,
                    weight: 'bold' as const,
                    color: '#991B1B',
                    wrap: true,
                  },
                  {
                    type: 'text' as const,
                    text: `頻率: ${f.frequency.toFixed(1)} ｜ CTR 降: ${f.ctrDropPct.toFixed(0)}% ｜ CPA 漲: ${f.cpaIncreasePct.toFixed(0)}%`,
                    size: 'xxs' as const,
                    color: '#7F1D1D',
                    wrap: true,
                    margin: 'xs' as const,
                  },
                  {
                    type: 'text' as const,
                    text: f.recommendation,
                    size: 'xxs' as const,
                    color: '#DC2626',
                    weight: 'bold' as const,
                    wrap: true,
                    margin: 'xs' as const,
                  },
                ],
              })),
            ],
      },
    };

    return {
      type: 'flex',
      altText: isClean ? `【${accountName}】素材健康，無疲勞！` : `【${accountName}】疲勞警報：${fatigued.length} 支素材需調整`,
      contents: bubble as any,
    } as any as messagingApi.FlexMessage;
  }

  /**
   * 3. 建立活動列表 (Campaigns) Flex Message
   */
  public static buildCampaignsFlex(campaigns: CampaignSummary[], accountName: string): messagingApi.FlexMessage {
    const bubble: any = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1E293B',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '🎯 活躍行銷活動排行 (Top 6)', size: 'xs', color: '#38BDF8', weight: 'bold' },
          { type: 'text', text: accountName, size: 'lg', color: '#FFFFFF', weight: 'bold', margin: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '12px',
        contents: campaigns.slice(0, 6).map((c, i) => {
          const isMessaging = c.primaryMetric === 'messaging' || c.conversionGoal === 'messaging';
          const hasRoas = c.primaryMetric === 'roas' || c.roas > 0;
          const isWinner = isMessaging
            ? c.conversions > 0
            : hasRoas
            ? c.roas >= 2.0
            : c.conversions > 0;

          let badgeText = '無轉換';
          let badgeColor = '#64748B';

          if (isMessaging) {
            badgeText = c.conversions > 0 ? `單則 $${c.cpa.toFixed(0)}` : '0 則訊息';
            badgeColor = c.conversions > 0 ? '#059669' : '#64748B';
          } else if (hasRoas) {
            badgeText = `ROAS ${c.roas.toFixed(2)}x`;
            badgeColor = c.roas >= 2.0 ? '#059669' : c.roas >= 1.0 ? '#2563EB' : '#DC2626';
          } else {
            badgeText = c.conversions > 0 ? `CPA $${c.cpa.toFixed(0)}` : '無轉換';
            badgeColor = c.conversions > 0 ? '#059669' : '#64748B';
          }

          return {
            type: 'box',
            layout: 'vertical',
            backgroundColor: isWinner ? '#ECFDF5' : '#F8FAFC',
            borderWidth: isWinner ? '1px' : '0px',
            borderColor: '#10B981',
            cornerRadius: '8px',
            paddingAll: '10px',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: `${i + 1}. ${c.name}`,
                    size: 'xs',
                    weight: 'bold',
                    color: '#0F172A',
                    flex: 4,
                    wrap: true,
                  },
                  {
                    type: 'text',
                    text: badgeText,
                    size: 'xs',
                    weight: 'bold',
                    color: badgeColor,
                    align: 'end',
                    flex: 2,
                    wrap: true,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'xs',
                contents: [
                  { type: 'text', text: `花費: $${c.spend.toLocaleString()}`, size: 'xxs', color: '#64748B', flex: 2, wrap: true },
                  { type: 'text', text: `CTR: ${c.ctr.toFixed(2)}%`, size: 'xxs', color: '#64748B', flex: 2, wrap: true },
                  {
                    type: 'text',
                    text: isMessaging
                      ? (c.conversions > 0 ? `${c.conversions} 則訊息對話` : '0 則訊息')
                      : hasRoas
                      ? (c.conversions > 0 ? `CPA $${c.cpa.toFixed(0)} (${c.conversions}筆)` : '0筆轉換')
                      : (c.conversions > 0 ? `${c.conversions} 筆轉換` : '0筆轉換'),
                    size: 'xxs',
                    color: '#0F172A',
                    weight: 'bold',
                    align: 'end',
                    flex: 3,
                    wrap: true,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'xs',
                contents: [
                  { type: 'text', text: `預算模式: ${c.budgetDesc}`, size: 'xxs', color: '#94A3B8', flex: 1, wrap: true },
                ],
              },
            ],
          };
        }),
      },
    };

    const hasAnyMessaging = campaigns.some((c) => c.primaryMetric === 'messaging' || c.conversionGoal === 'messaging');
    const altText = hasAnyMessaging
      ? `【${accountName}】活躍活動列表 (互動訊息主軸)`
      : `【${accountName}】活躍活動列表`;

    return {
      type: 'flex',
      altText,
      contents: bubble as any,
    } as any as messagingApi.FlexMessage;
  }

  /**
   * 4. 建立說明指南 Flex Message
   */
  public static buildHelpFlex(currentAccount: string): messagingApi.FlexMessage {
    const bubble: any = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '🤖 LINE 廣告特助使用手冊', size: 'sm', color: '#38BDF8', weight: 'bold' },
          { type: 'text', text: `目前帳號：${currentAccount}`, size: 'xs', color: '#94A3B8', margin: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '直接在聊天室發送以下關鍵字，即時調閱 Meta 數據：',
            size: 'xs',
            color: '#64748B',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              { type: 'text', text: '📊 輸入「看週報」➔ WoW 環比趨勢與資本配置指引', size: 'xs', color: '#0F172A', weight: 'bold' },
              { type: 'text', text: '🛡️ 輸入「巡邏」➔ 16 帳號全域紅綠燈晨檢 (違規/休眠)', size: 'xs', color: '#0F172A', weight: 'bold' },
              { type: 'text', text: '🧛 輸入「素材象限」➔ 吸血鬼 vs 金牛素材四象限診斷', size: 'xs', color: '#0F172A', weight: 'bold' },
              { type: 'text', text: '📈 輸入「看成效」➔ 調閱近7天花費與 ROAS 大盤', size: 'xs', color: '#0F172A' },
              { type: 'text', text: '⚡ 輸入「查疲勞」➔ 執行素材疲勞檢測', size: 'xs', color: '#0F172A' },
              { type: 'text', text: '🔄 輸入「換帳號」➔ 一鍵切換 16 個廣告帳號', size: 'xs', color: '#0F172A' },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '📊 看週報', text: '看週報' },
          },
          {
            type: 'button',
            style: 'primary',
            color: '#2563EB',
            height: 'sm',
            action: { type: 'message', label: '📈 看成效', text: '看成效' },
          },
        ],
      },
    };

    return {
      type: 'flex',
      altText: 'LINE 廣告特助使用指令說明',
      contents: bubble as any,
    } as any as messagingApi.FlexMessage;
  }

  /**
   * 5. 建立可切換廣告帳號清單 Flex Message（點擊按鈕一鍵切換）
   */
  public static buildAccountListFlex(
    accounts: Array<{ id: string; name: string; currency: string; shortName: string }>,
    currentAccountId: string
  ): messagingApi.FlexMessage {
    const rows = accounts.slice(0, 10).map((acc) => {
      const isCurrent = acc.id === currentAccountId;
      return {
        type: 'box',
        layout: 'horizontal',
        alignItems: 'center',
        paddingAll: '8px',
        backgroundColor: isCurrent ? '#EFF6FF' : '#FFFFFF',
        cornerRadius: 'md',
        margin: 'xs',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            flex: 5,
            contents: [
              {
                type: 'text',
                text: `${isCurrent ? '📌 ' : ''}${acc.shortName}`,
                weight: isCurrent ? 'bold' : 'regular',
                size: 'sm',
                color: isCurrent ? '#2563EB' : '#0F172A',
                wrap: true,
              },
              {
                type: 'text',
                text: `${acc.name} (${acc.currency})`,
                size: 'xxs',
                color: '#94A3B8',
                wrap: true,
              },
            ],
          },
          {
            type: 'button',
            style: isCurrent ? 'secondary' : 'primary',
            color: isCurrent ? '#E2E8F0' : '#2563EB',
            height: 'sm',
            flex: 1,
            action: {
              type: 'message',
              label: isCurrent ? '當前' : '切換',
              text: `切換 ${acc.shortName}`,
            },
          },
        ],
      };
    });

    const bubble: any = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '🏢 可切換的 Meta 廣告帳號',
            weight: 'bold',
            size: 'md',
            color: '#38BDF8',
          },
          {
            type: 'text',
            text: `共找到 ${accounts.length} 個已授權帳號，點擊按鈕直接切換：`,
            size: 'xs',
            color: '#94A3B8',
            wrap: true,
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'none',
        paddingAll: '8px',
        contents: rows,
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        paddingAll: '10px',
        contents: [
          {
            type: 'text',
            text: '💡 亦可直接輸入「切換 帳號名稱」或帳號 ID 進行切換',
            size: 'xxs',
            color: '#94A3B8',
            align: 'center',
          },
        ],
      },
    };

    return {
      type: 'flex',
      altText: '可切換的 Meta 廣告帳號清單',
      contents: bubble,
    } as any as messagingApi.FlexMessage;
  }

  /**
   * 6. 建立每週廣告成效週報 (Weekly Report) Flex Message
   */
  /**
   * 6. 建立每週廣告成效週報 (Weekly Report) Flex Message (含 WoW 環比與資本配置指引)
   */
  public static buildWeeklyReportFlex(
    metrics: OverviewMetrics,
    campaigns: CampaignSummary[],
    fatigued: FatigueSummary[],
    accountName: string,
    datePresetLabel = '過去 7 天全盤數據',
    delta?: WeeklyComparison['delta']
  ): messagingApi.FlexMessage {
    const isMessagingAccount = metrics.conversionGoal === 'messaging';
    const isLeadAccount = !isMessagingAccount && (metrics.roas <= 0.05 && (metrics.conversions > 0 || metrics.spend > 0));
    const roasColor = metrics.roas >= 2.0 ? '#059669' : metrics.roas >= 1.0 ? '#2563EB' : '#DC2626';
    const topCampaigns = campaigns.slice(0, 3);
    const hasFatigue = fatigued.length > 0;

    const convUnit = isMessagingAccount ? '則' : '筆';
    const convLabel = isMessagingAccount ? '訊息' : '轉換';

    // WoW 環比數據展示輔助文字
    const spendWoW = delta
      ? `${delta.spendPct >= 0 ? '🔺 +' : '🔻 '}${Math.abs(delta.spendPct).toFixed(1)}% vs上週`
      : undefined;
    const roasWoW = delta
      ? `${delta.roasDiff >= 0 ? '🔺 +' : '🔻 '}${Math.abs(delta.roasDiff).toFixed(2)} vs上週`
      : undefined;
    const convWoW = delta
      ? `${delta.conversionsDiff >= 0 ? '🔺 +' : '🔻 '}${Math.abs(delta.conversionsDiff)} ${convUnit}`
      : undefined;
    const cpaWoW = delta
      ? `${delta.cpaPct <= 0 ? '🟢 降 ' : '🔴 升 '}${Math.abs(delta.cpaPct).toFixed(1)}%`
      : undefined;

    // 💡 資本配置指引邏輯 (Budget Allocation Guidance)
    let adviceTitle = '💡 資本配置指引';
    let adviceText = '維持目前投放節奏，密切監控轉換成本。';
    let adviceColor = '#1E293B';
    let adviceBg = '#F8FAFC';

    if (isMessagingAccount) {
      if (metrics.conversions > 0 && delta && delta.cpaPct <= -10) {
        adviceTitle = '🚀 資本配置：攻守兼備 (建議加碼)';
        adviceText = `平均單則訊息成本較上週大幅降低 ${Math.abs(delta.cpaPct).toFixed(1)}%（現為 $${metrics.cpa.toFixed(0)}/則），進線熱度與獲客效率顯著提升！建議向 Top 1 核心活動加碼 10~15% 擴大進線量。`;
        adviceColor = '#065F46';
        adviceBg = '#ECFDF5';
      } else if (metrics.conversions > 0 && delta && delta.cpaPct > 20) {
        adviceTitle = '🛑 資本配置：防禦排查 (成本飆升)';
        adviceText = `單則訊息成本較上週飆升 ${delta.cpaPct.toFixed(1)}%（現為 $${metrics.cpa.toFixed(0)}/則），進線成本過高。建議輸入「素材象限」排查高點低轉之吸血鬼素材，收攏預算或優化私訊問候語。`;
        adviceColor = '#991B1B';
        adviceBg = '#FEF2F2';
      } else if (metrics.spend > 0 && metrics.conversions === 0) {
        adviceTitle = '🛑 資本配置：止血防禦 (零進線警報)';
        adviceText = '本週已累積花費但尚無任何訊息對話發起，請立即排查粉專/IG私訊按鈕、自動問候語或 Meta 廣告連線狀態！';
        adviceColor = '#991B1B';
        adviceBg = '#FEF2F2';
      } else {
        adviceTitle = '⚖️ 資本配置：穩定進線 (維持節奏)';
        adviceText = `平均單則訊息成本落在 $${metrics.cpa.toFixed(0)}，本週累積發起 ${metrics.conversions} 則訊息對話，節奏平穩。建議維持現有日預算投放。`;
        adviceColor = '#1E40AF';
        adviceBg = '#EFF6FF';
      }
    } else if (isLeadAccount) {
      if (metrics.conversions > 0 && delta && delta.cpaPct <= -10) {
        adviceTitle = '🚀 資本配置：攻守兼備 (建議加碼)';
        adviceText = `平均獲客 CPA 較上週大幅降低 ${Math.abs(delta.cpaPct).toFixed(1)}%（現為 $${metrics.cpa.toFixed(0)}），名單獲取效率顯著提升！建議向 Top 1 核心活動加碼 10~15% 擴大進單。`;
        adviceColor = '#065F46';
        adviceBg = '#ECFDF5';
      } else if (metrics.conversions > 0 && delta && delta.cpaPct > 20) {
        adviceTitle = '🛑 資本配置：防禦排查 (成本飆升)';
        adviceText = `獲客 CPA 較上週飆升 ${delta.cpaPct.toFixed(1)}%（現為 $${metrics.cpa.toFixed(0)}），獲客成本過高。建議輸入「素材象限」排查高點低轉吸血鬼素材，收攏預算。`;
        adviceColor = '#991B1B';
        adviceBg = '#FEF2F2';
      } else if (metrics.spend > 0 && metrics.conversions === 0) {
        adviceTitle = '🛑 資本配置：止血防禦 (零轉換警報)';
        adviceText = '本週已累積花費但尚無核心名單轉換，請立即排查落地頁跳轉或表單像素事件！';
        adviceColor = '#991B1B';
        adviceBg = '#FEF2F2';
      } else {
        adviceTitle = '⚖️ 資本配置：穩定獲客 (維持節奏)';
        adviceText = `平均 CPA 落在 $${metrics.cpa.toFixed(0)}，本週轉換 ${metrics.conversions} 筆，節奏平穩。建議維持現有日預算投放。`;
        adviceColor = '#1E40AF';
        adviceBg = '#EFF6FF';
      }
    } else {
      if (metrics.roas >= 2.0 && (!delta || delta.roasDiff >= 0)) {
        adviceTitle = '🚀 資本配置：攻守兼備 (建議加碼)';
        adviceText = '大盤 ROAS 穩健成長且突破 2.0x！建議將預算往 Top 1 核心活動小幅加碼 10~15% 擴大戰果。';
        adviceColor = '#065F46';
        adviceBg = '#ECFDF5';
      } else if (metrics.roas >= 2.0 && delta && delta.roasDiff < 0) {
        adviceTitle = '⚠️ 資本配置：防守觀望 (維持規模)';
        adviceText = `ROAS 雖仍在 ${metrics.roas.toFixed(2)}x 獲利水位，但較上週衰退，建議維持目前預算規模並檢驗受眾飽和度。`;
        adviceColor = '#92400E';
        adviceBg = '#FFFBEB';
      } else if (metrics.roas < 1.0) {
        adviceTitle = '🛑 資本配置：止血防禦 (收攏預算)';
        adviceText = '整體投報率低於 1.0x 損平線，建議關閉末端低效素材，將預算回防至 ROAS 最高之基本盤活動。';
        adviceColor = '#991B1B';
        adviceBg = '#FEF2F2';
      } else {
        adviceTitle = '⚖️ 資本配置：微調優化 (汰換素材)';
        adviceText = '成效維持在損平邊界，建議輸入「素材象限」排查高點低轉之吸血鬼素材，釋放無效預算。';
        adviceColor = '#1E40AF';
        adviceBg = '#EFF6FF';
      }
    }

    const bubble: any = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1E1B4B',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '📊 META 廣告成效週報',
                size: 'xs',
                color: '#A5B4FC',
                weight: 'bold',
              },
              {
                type: 'text',
                text: 'WEEKLY AUDIT',
                size: 'xxs',
                color: '#818CF8',
                align: 'end',
                weight: 'bold',
              },
            ],
          },
          {
            type: 'text',
            text: `【${accountName}】`,
            size: 'xl',
            color: '#FFFFFF',
            weight: 'bold',
            wrap: true,
            margin: 'xs',
          },
          {
            type: 'text',
            text: `區間：${datePresetLabel} ｜ 幣別：${metrics.currency}`,
            size: 'xxs',
            color: '#C7D2FE',
            wrap: true,
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '14px',
        contents: [
          // 總預算與核心展示區 (含 WoW 環比) - 自動判斷大盤 ROAS 或平均 CPA
          {
            type: 'box',
            layout: 'horizontal',
            backgroundColor: '#F8FAFC',
            cornerRadius: '10px',
            paddingAll: '12px',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 3,
                contents: [
                  { type: 'text', text: '本週總花費', size: 'xxs', color: '#64748B' },
                  {
                    type: 'text',
                    text: `$${metrics.spend.toLocaleString()}`,
                    size: 'xl',
                    weight: 'bold',
                    color: '#0F172A',
                    margin: 'xs',
                  },
                  ...(spendWoW
                    ? [
                        {
                          type: 'text',
                          text: spendWoW,
                          size: 'xxs',
                          color: delta!.spendPct >= 0 ? '#2563EB' : '#64748B',
                          weight: 'bold',
                          margin: 'xs',
                        },
                      ]
                    : []),
                ],
              },
              isMessagingAccount
                ? {
                    type: 'box',
                    layout: 'vertical',
                    flex: 2,
                    alignItems: 'flex-end',
                    contents: [
                      { type: 'text', text: '平均單則成本', size: 'xxs', color: '#64748B' },
                      {
                        type: 'text',
                        text: metrics.cpa > 0 ? `$${metrics.cpa.toFixed(0)}` : '—',
                        size: 'xl',
                        weight: 'bold',
                        color: metrics.cpa > 0 ? '#059669' : '#0F172A',
                        margin: 'xs',
                      },
                      ...(cpaWoW
                        ? [
                            {
                              type: 'text',
                              text: cpaWoW,
                              size: 'xxs',
                              color: delta!.cpaPct <= 0 ? '#059669' : '#DC2626',
                              weight: 'bold',
                              margin: 'xs',
                            },
                          ]
                        : []),
                    ],
                  }
                : isLeadAccount
                ? {
                    type: 'box',
                    layout: 'vertical',
                    flex: 2,
                    alignItems: 'flex-end',
                    contents: [
                      { type: 'text', text: '平均 CPA', size: 'xxs', color: '#64748B' },
                      {
                        type: 'text',
                        text: metrics.cpa > 0 ? `$${metrics.cpa.toFixed(0)}` : '—',
                        size: 'xl',
                        weight: 'bold',
                        color: metrics.cpa > 0 ? '#059669' : '#0F172A',
                        margin: 'xs',
                      },
                      ...(cpaWoW
                        ? [
                            {
                              type: 'text',
                              text: cpaWoW,
                              size: 'xxs',
                              color: delta!.cpaPct <= 0 ? '#059669' : '#DC2626',
                              weight: 'bold',
                              margin: 'xs',
                            },
                          ]
                        : []),
                    ],
                  }
                : {
                    type: 'box',
                    layout: 'vertical',
                    flex: 2,
                    alignItems: 'flex-end',
                    contents: [
                      { type: 'text', text: '大盤 ROAS', size: 'xxs', color: '#64748B' },
                      {
                        type: 'text',
                        text: `${metrics.roas.toFixed(2)}x`,
                        size: 'xl',
                        weight: 'bold',
                        color: roasColor,
                        margin: 'xs',
                      },
                      ...(roasWoW
                        ? [
                            {
                              type: 'text',
                              text: roasWoW,
                              size: 'xxs',
                              color: delta!.roasDiff >= 0 ? '#059669' : '#DC2626',
                              weight: 'bold',
                              margin: 'xs',
                            },
                          ]
                        : []),
                    ],
                  },
            ],
          },
          // 4 大次要關鍵指標 (2x2 Grid)
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                backgroundColor: '#F1F5F9',
                paddingAll: '8px',
                cornerRadius: '8px',
                contents: [
                  { type: 'text', text: isMessagingAccount ? '發起訊息對話' : '核心轉換', size: 'xxs', color: '#64748B' },
                  { type: 'text', text: `${metrics.conversions} ${convUnit}`, size: 'sm', weight: 'bold', color: '#0F172A' },
                  {
                    type: 'text',
                    text: isMessagingAccount
                      ? `單則 $${metrics.cpa.toFixed(1)}${cpaWoW ? ` (${cpaWoW})` : ''}`
                      : `CPA $${metrics.cpa.toFixed(1)}${cpaWoW ? ` (${cpaWoW})` : ''}`,
                    size: 'xxs',
                    color: '#475569',
                    wrap: true,
                  },
                  ...(convWoW
                    ? [
                        {
                          type: 'text',
                          text: `${convLabel} ${convWoW}`,
                          size: 'xxs',
                          color: delta!.conversionsDiff >= 0 ? '#059669' : '#DC2626',
                        },
                      ]
                    : []),
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                backgroundColor: '#F1F5F9',
                paddingAll: '8px',
                cornerRadius: '8px',
                contents: [
                  { type: 'text', text: '曝光與點擊', size: 'xxs', color: '#64748B' },
                  { type: 'text', text: `${metrics.clicks.toLocaleString()} 點擊`, size: 'sm', weight: 'bold', color: '#0F172A' },
                  { type: 'text', text: `CTR ${metrics.ctr.toFixed(2)}% | $${metrics.cpc.toFixed(1)}`, size: 'xxs', color: '#475569' },
                ],
              },
            ],
          },
          // 💡 資本配置指引區塊
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: adviceBg,
            paddingAll: '10px',
            cornerRadius: '8px',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: adviceTitle,
                size: 'xs',
                weight: 'bold',
                color: adviceColor,
              },
              {
                type: 'text',
                text: adviceText,
                size: 'xxs',
                color: adviceColor,
                wrap: true,
                margin: 'xs',
              },
            ],
          },
          // 🏆 獲利 Top 3 活動小榜 (兼顧 ROAS、CPA 與互動訊息)
          {
            type: 'box',
            layout: 'vertical',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: '🏆 本週重點行銷活動 (Top 3)',
                size: 'xs',
                weight: 'bold',
                color: '#334155',
                margin: 'xs',
              },
              ...topCampaigns.map((c, i) => {
                const isMessaging = c.primaryMetric === 'messaging' || c.conversionGoal === 'messaging';
                const hasRoas = c.primaryMetric === 'roas' || c.roas > 0;
                let badgeText = '無轉換';
                let badgeColor = '#64748B';

                if (isMessaging) {
                  badgeText = c.conversions > 0 ? `單則 $${c.cpa.toFixed(0)}` : '0 則訊息';
                  badgeColor = c.conversions > 0 ? '#059669' : '#64748B';
                } else if (hasRoas) {
                  badgeText = `ROAS ${c.roas.toFixed(2)}x`;
                  badgeColor = c.roas >= 2.0 ? '#059669' : '#2563EB';
                } else {
                  badgeText = c.conversions > 0 ? `CPA $${c.cpa.toFixed(0)}` : '無轉換';
                  badgeColor = c.conversions > 0 ? '#059669' : '#64748B';
                }

                const convText = isMessaging
                  ? (c.conversions > 0 ? `${c.conversions} 則訊息` : '0 則訊息')
                  : hasRoas
                  ? (c.conversions > 0 ? `CPA $${c.cpa.toFixed(0)} (${c.conversions}筆)` : '0筆轉換')
                  : (c.conversions > 0 ? `${c.conversions} 筆轉換` : '0筆轉換');

                return {
                  type: 'box',
                  layout: 'vertical',
                  paddingAll: '8px',
                  backgroundColor: i === 0 ? '#EFF6FF' : '#F8FAFC',
                  cornerRadius: '6px',
                  margin: 'xs',
                  contents: [
                    {
                      type: 'box',
                      layout: 'horizontal',
                      alignItems: 'center',
                      contents: [
                        {
                          type: 'text',
                          text: `${i + 1}. ${c.name}`,
                          size: 'xs',
                          weight: i === 0 ? 'bold' : 'regular',
                          color: '#1E293B',
                          flex: 4,
                          wrap: true,
                        },
                        {
                          type: 'text',
                          text: badgeText,
                          size: 'xs',
                          weight: 'bold',
                          color: badgeColor,
                          flex: 2,
                          align: 'end',
                          wrap: true,
                        },
                      ],
                    },
                    {
                      type: 'box',
                      layout: 'horizontal',
                      margin: 'xs',
                      contents: [
                        { type: 'text', text: `花費: $${c.spend.toLocaleString()}`, size: 'xxs', color: '#64748B', flex: 2, wrap: true },
                        { type: 'text', text: `CTR: ${c.ctr.toFixed(2)}%`, size: 'xxs', color: '#64748B', flex: 2, wrap: true },
                        {
                          type: 'text',
                          text: convText,
                          size: 'xxs',
                          color: '#0F172A',
                          weight: 'bold',
                          align: 'end',
                          flex: 3,
                          wrap: true,
                        },
                      ],
                    },
                  ],
                };
              }),
            ],
          },
          // ⚠️ 素材健康度檢測結果
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            backgroundColor: hasFatigue ? '#FEF2F2' : '#F0FDF4',
            paddingAll: '10px',
            cornerRadius: '8px',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: hasFatigue
                  ? `⚠️ 疲勞警報：${fatigued.length} 支素材頻率過高或成效衰退`
                  : '✅ 素材健康：全素材運行正常，無嚴重疲勞訊號',
                size: 'xs',
                weight: 'bold',
                color: hasFatigue ? '#991B1B' : '#166534',
                wrap: true,
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        paddingAll: '10px',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '🎯 查活動', text: '查活動' },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '⚡ 查疲勞', text: '查疲勞' },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '🧛 素材象限', text: '素材象限' },
          },
          {
            type: 'button',
            style: 'primary',
            color: '#4F46E5',
            height: 'sm',
            action: { type: 'message', label: '🏢 換帳號', text: '換帳號' },
          },
        ],
      },
    };

    const altText = isMessagingAccount
      ? `📊【${accountName}】Meta 廣告成效週報 (單則 $${metrics.cpa.toFixed(0)}，發起 ${metrics.conversions} 則訊息)`
      : isLeadAccount
      ? `📊【${accountName}】Meta 廣告成效週報 (CPA $${metrics.cpa.toFixed(0)}，轉換 ${metrics.conversions} 筆)`
      : `📊【${accountName}】Meta 廣告成效週報 (ROAS ${metrics.roas.toFixed(2)}x)`;

    return {
      type: 'flex',
      altText,
      contents: bubble,
    } as any as messagingApi.FlexMessage;
  }

  /**
   * 7. 建立 16 帳號全域紅綠燈晨檢 Flex Message (Cross-Account Sentinel)
   */
  public static buildPatrolFlex(patrolItems: PatrolItem[]): messagingApi.FlexMessage {
    const criticalCount = patrolItems.filter((i) => i.status === 'critical').length;
    const warningCount = patrolItems.filter((i) => i.status === 'warning').length;
    const healthyCount = patrolItems.filter((i) => i.status === 'healthy').length;

    const bannerBg = criticalCount > 0 ? '#7F1D1D' : warningCount > 0 ? '#1E293B' : '#064E3B';
    const bannerStatusText =
      criticalCount > 0
        ? `🚨 發現 ${criticalCount} 個帳號異常`
        : warningCount > 0
        ? `⚠️ ${warningCount} 個帳號需留意`
        : '✅ 全域 16 帳號運作平穩';

    const rows = patrolItems.map((item) => {
      const statusIcon = item.status === 'critical' ? '🔴' : item.status === 'warning' ? '🟡' : '🟢';
      const statusColor = item.status === 'critical' ? '#DC2626' : item.status === 'warning' ? '#D97706' : '#059669';

      return {
        type: 'box',
        layout: 'horizontal',
        alignItems: 'center',
        paddingAll: '8px',
        backgroundColor: item.status === 'critical' ? '#FEF2F2' : '#FFFFFF',
        cornerRadius: 'md',
        margin: 'xs',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            flex: 5,
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                alignItems: 'center',
                spacing: 'xs',
                contents: [
                  { type: 'text', text: statusIcon, size: 'xs', flex: 0 },
                  { type: 'text', text: item.name, weight: 'bold', size: 'sm', color: '#0F172A', flex: 1, wrap: true },
                ],
              },
              {
                type: 'text',
                text:
                  item.reason ||
                  (item.spend7d > 0
                    ? `7天花費 $${item.spend7d.toLocaleString()} (${item.currency})`
                    : '近7天無花費'),
                size: 'xxs',
                color: statusColor,
                wrap: true,
                margin: 'xs',
              },
            ],
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            flex: 1,
            action: {
              type: 'message',
              label: '切換',
              text: `切換 ${item.name}`,
            },
          },
        ],
      };
    });

    const bubble: any = {
      type: 'bubble',
      size: 'giga',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: bannerBg,
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '🛡️ 16 帳號全域紅綠燈巡邏', size: 'xs', color: '#CBD5E1', weight: 'bold' },
              { type: 'text', text: 'SENTINEL PATROL', size: 'xxs', color: '#94A3B8', align: 'end' },
            ],
          },
          {
            type: 'text',
            text: bannerStatusText,
            size: 'lg',
            color: '#FFFFFF',
            weight: 'bold',
            wrap: true,
            margin: 'xs',
          },
          {
            type: 'text',
            text: `🔴 違規/拒登: ${criticalCount} ｜ 🟡 注意/休眠: ${warningCount} ｜ 🟢 正常投放: ${healthyCount}`,
            size: 'xxs',
            color: '#E2E8F0',
            wrap: true,
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'none',
        paddingAll: '8px',
        contents: rows,
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        paddingAll: '10px',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '🔄 重新巡邏', text: '巡邏' },
          },
          {
            type: 'button',
            style: 'primary',
            color: '#2563EB',
            height: 'sm',
            action: { type: 'message', label: '📊 當前週報', text: '看週報' },
          },
        ],
      },
    };

    return {
      type: 'flex',
      altText: `🛡️ 16 帳號全域紅綠燈晨檢報告 (${bannerStatusText})`,
      contents: bubble,
    } as any as messagingApi.FlexMessage;
  }

  /**
   * 8. 建立吸血鬼 vs 金牛素材四象限分析 (Creative Matrix) Flex Message (支援 ROAS 與 CPA 雙軌)
   */
  public static buildCreativeMatrixFlex(
    matrixData: {
      items: CreativeMatrixItem[];
      avgCtr: number;
      avgRoas: number;
      avgCpa?: number;
      totalConversions?: number;
      primaryMetric?: 'roas' | 'cpa' | 'messaging';
      conversionGoal?: ConversionGoalType;
    },
    accountName: string
  ): messagingApi.FlexMessage {
    const { items, avgCtr, avgRoas, avgCpa = 0, totalConversions = 0, primaryMetric, conversionGoal } = matrixData;
    const isMessagingMode = primaryMetric === 'messaging' || conversionGoal === 'messaging';
    const isRoasMode = primaryMetric === 'roas' || (!isMessagingMode && avgRoas > 0.05 && totalConversions === 0);
    const isCpaMode = !isRoasMode && !isMessagingMode;

    const winning = items.filter((i) => i.quadrant === 'winning');
    const vampire = items.filter((i) => i.quadrant === 'vampire');
    const potential = items.filter((i) => i.quadrant === 'potential');
    const fatigued = items.filter((i) => i.quadrant === 'fatigued');

    const renderQuadSection = (
      title: string,
      tag: string,
      tagColor: string,
      bgColor: string,
      quadItems: CreativeMatrixItem[],
      guidance: string
    ) => {
      const topItems = quadItems.slice(0, 2);
      return {
        type: 'box',
        layout: 'vertical',
        backgroundColor: bgColor,
        cornerRadius: '8px',
        paddingAll: '10px',
        margin: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            alignItems: 'center',
            contents: [
              { type: 'text', text: title, size: 'xs', weight: 'bold', color: '#0F172A', flex: 4, wrap: true },
              {
                type: 'box',
                layout: 'horizontal',
                backgroundColor: tagColor,
                cornerRadius: '4px',
                paddingStart: '6px',
                paddingEnd: '6px',
                paddingTop: '2px',
                paddingBottom: '2px',
                contents: [{ type: 'text', text: `${quadItems.length} 支`, size: 'xxs', color: '#FFFFFF', weight: 'bold' }],
              },
            ],
          },
          {
            type: 'text',
            text: guidance,
            size: 'xxs',
            color: '#475569',
            wrap: true,
            margin: 'xs',
          },
          ...(topItems.length > 0
            ? topItems.map((item) => {
                const metricCol2Text = isMessagingMode
                  ? item.conversions > 0
                    ? `單則: $${item.cpa.toFixed(0)}`
                    : '單則: — (0則)'
                  : isCpaMode
                  ? item.conversions > 0
                    ? `CPA: $${item.cpa.toFixed(0)}`
                    : 'CPA: — (0筆)'
                  : `ROAS: ${item.roas.toFixed(2)}x`;
                const metricCol2Color = (isMessagingMode || isCpaMode)
                  ? item.conversions > 0 && (avgCpa === 0 || item.cpa <= avgCpa)
                    ? '#059669'
                    : '#DC2626'
                  : item.roas >= avgRoas
                  ? '#059669'
                  : '#DC2626';

                return {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#FFFFFF',
                  cornerRadius: '6px',
                  paddingAll: '8px',
                  margin: 'xs',
                  contents: [
                    {
                      type: 'text',
                      text: `🎯 ${item.name}`,
                      size: 'xs',
                      weight: 'bold',
                      color: '#1E293B',
                      wrap: true,
                    },
                    {
                      type: 'box',
                      layout: 'horizontal',
                      margin: 'xs',
                      contents: [
                        {
                          type: 'text',
                          text: `CTR: ${item.ctr.toFixed(2)}%`,
                          size: 'xxs',
                          color: item.ctr >= avgCtr ? '#059669' : '#64748B',
                          weight: item.ctr >= avgCtr ? 'bold' : 'regular',
                          flex: 1,
                          wrap: true,
                        },
                        {
                          type: 'text',
                          text: metricCol2Text,
                          size: 'xxs',
                          color: metricCol2Color,
                          weight: 'bold',
                          flex: 1,
                          wrap: true,
                        },
                        {
                          type: 'text',
                          text: `花費: $${item.spend.toFixed(0)}`,
                          size: 'xxs',
                          color: '#64748B',
                          align: 'end',
                          flex: 1,
                          wrap: true,
                        },
                      ],
                    },
                    ...(item.conversions > 0
                      ? [
                          {
                            type: 'box',
                            layout: 'horizontal',
                            margin: 'xs',
                            contents: [
                              {
                                type: 'text',
                                text: isMessagingMode
                                  ? `累積發起 ${item.conversions} 則訊息對話`
                                  : isCpaMode
                                  ? `累積獲得 ${item.conversions} 筆名單/轉換`
                                  : `獲客 CPA $${item.cpa.toFixed(0)} (${item.conversions}筆轉換)`,
                                size: 'xxs',
                                color: '#059669',
                                weight: 'bold',
                                wrap: true,
                              },
                            ],
                          },
                        ]
                      : []),
                  ],
                };
              })
            : [{ type: 'text', text: '（無符合此象限之活躍素材）', size: 'xxs', color: '#94A3B8', margin: 'xs', wrap: true }]),
        ],
      };
    };

    const benchmarkSubtitle = isMessagingMode
      ? `基準線：平均 CTR ${avgCtr.toFixed(2)}% ｜ 平均單則成本 $${avgCpa.toFixed(0)} (近7天)`
      : isCpaMode
      ? `基準線：平均 CTR ${avgCtr.toFixed(2)}% ｜ 平均 CPA $${avgCpa.toFixed(0)} (近7天)`
      : `基準線：平均 CTR ${avgCtr.toFixed(2)}% ｜ 平均 ROAS ${avgRoas.toFixed(2)}x (近7天)`;

    const headerTitle = isMessagingMode
      ? '🎯 互動訊息素材四象限診斷'
      : isCpaMode
      ? '🎯 名單獲客素材四象限診斷'
      : '🎯 吸血鬼 vs 金牛素材四象限診斷';

    const bubble: any = {
      type: 'bubble',
      size: 'giga',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#312E81',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: headerTitle,
                size: 'xs',
                color: '#C7D2FE',
                weight: 'bold',
              },
              { type: 'text', text: 'CREATIVE MATRIX', size: 'xxs', color: '#818CF8', align: 'end' },
            ],
          },
          {
            type: 'text',
            text: `【${accountName}】`,
            size: 'xl',
            color: '#FFFFFF',
            weight: 'bold',
            wrap: true,
            margin: 'xs',
          },
          {
            type: 'text',
            text: benchmarkSubtitle,
            size: 'xxs',
            color: '#E0E7FF',
            wrap: true,
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'none',
        paddingAll: '10px',
        contents: isMessagingMode
          ? [
              renderQuadSection(
                '🏆 金牛私訊素材 (High CTR & Low 訊息成本)',
                '金牛',
                '#059669',
                '#ECFDF5',
                winning,
                '💡 點擊強且私訊成本超低！高意圖諮詢流量，建議加大預算擴圈或製作衍伸素材。'
              ),
              renderQuadSection(
                '🧛 吸血鬼素材 (High CTR & High 訊息成本 / 零私訊)',
                '吸血鬼',
                '#DC2626',
                '#FEF2F2',
                vampire,
                '🛑 意圖錯位！點擊率高但點進去不發訊息或成本昂貴，屬於空燒預算怪獸，應檢查問候語或暫停！'
              ),
              renderQuadSection(
                '💎 潛力金礦 (Low CTR & Low 訊息成本)',
                '潛力',
                '#2563EB',
                '#EFF6FF',
                potential,
                '💡 私訊成本極佳但吸睛度偏低。受眾精準，建議更換前3秒 Hook 或加強縮圖文案吸引力！'
              ),
              renderQuadSection(
                '🥀 疲勞淘汰 (Low CTR & High 訊息成本 / 零私訊)',
                '疲勞',
                '#64748B',
                '#F8FAFC',
                fatigued,
                '✂️ 點擊與私訊對話雙低，持續空燒預算。建議暫停投放以釋放預算額度。'
              ),
            ]
          : isCpaMode
          ? [
              renderQuadSection(
                '🏆 金牛名單素材 (High CTR & Low CPA)',
                '金牛',
                '#059669',
                '#ECFDF5',
                winning,
                '💡 點擊強且獲客成本超低！高意圖精準流量，建議加大預算擴圈或製作衍伸。'
              ),
              renderQuadSection(
                '🧛 吸血鬼名單素材 (High CTR & High CPA)',
                '吸血鬼',
                '#DC2626',
                '#FEF2F2',
                vampire,
                '🛑 意圖錯位！高點擊但表單填寫昂貴或零留名單，屬於吃錢怪獸，應檢查表單跳轉或暫停！'
              ),
              renderQuadSection(
                '💎 潛力金礦 (Low CTR & Low CPA)',
                '潛力',
                '#2563EB',
                '#EFF6FF',
                potential,
                '💡 獲客成本極佳但吸睛度偏低。受眾精準，建議更換前3秒 Hook 或加強文案縮圖吸引力！'
              ),
              renderQuadSection(
                '🥀 疲勞淘汰 (Low CTR & High CPA)',
                '疲勞',
                '#64748B',
                '#F8FAFC',
                fatigued,
                '✂️ 點擊與轉化雙低，持續空燒預算。建議暫停投放以釋放預算額度。'
              ),
            ]
          : [
              renderQuadSection(
                '🏆 金牛素材 (High CTR & High ROAS)',
                '金牛',
                '#059669',
                '#ECFDF5',
                winning,
                '💡 點擊強且超賺錢！建議加大預算擴圈或製作類似素材衍伸。'
              ),
              renderQuadSection(
                '🧛 吸血鬼素材 (High CTR & Low ROAS)',
                '吸血鬼',
                '#DC2626',
                '#FEF2F2',
                vampire,
                '🛑 數據表象與意圖錯位！高點擊卻進站不買，屬於吃錢怪獸，應檢查落地頁或降權！'
              ),
              renderQuadSection(
                '💎 潛力金礦 (Low CTR & High ROAS)',
                '潛力',
                '#2563EB',
                '#EFF6FF',
                potential,
                '💡 受眾精準轉單極佳，但吸睛度偏低。建議更換前3秒 Hook 或加強縮圖吸引力！'
              ),
              renderQuadSection(
                '🥀 疲勞淘汰 (Low CTR & Low ROAS)',
                '疲勞',
                '#64748B',
                '#F8FAFC',
                fatigued,
                '✂️ 點擊與轉化雙低，持續空燒預算。建議暫停投放以釋放預算額度。'
              ),
            ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        paddingAll: '10px',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '⚡ 查疲勞', text: '查疲勞' },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: { type: 'message', label: '📊 看週報', text: '看週報' },
          },
          {
            type: 'button',
            style: 'primary',
            color: '#4F46E5',
            height: 'sm',
            action: { type: 'message', label: '🛡️ 全域巡邏', text: '巡邏' },
          },
        ],
      },
    };

    const altText = isMessagingMode
      ? `🎯【${accountName}】互動訊息素材四象限診斷：發現 ${vampire.length} 支吸血鬼素材、${winning.length} 支金牛私訊素材`
      : isCpaMode
      ? `🎯【${accountName}】名單素材四象限診斷：發現 ${vampire.length} 支吸血鬼素材、${winning.length} 支金牛名單素材`
      : `🎯【${accountName}】素材四象限診斷：發現 ${vampire.length} 支吸血鬼素材、${winning.length} 支金牛素材`;

    return {
      type: 'flex',
      altText,
      contents: bubble,
    } as any as messagingApi.FlexMessage;
  }
}
