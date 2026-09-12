import { messagingApi } from '@line/bot-sdk';
import { OverviewMetrics, CampaignSummary, FatigueSummary } from '../metaService.js';

export class FlexBuilder {
  /**
   * 1. 建立大盤成效儀表板 Flex Message
   */
  public static buildOverviewFlex(metrics: OverviewMetrics): messagingApi.FlexMessage {
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
          // 核心 4 格指標 (2x2 Grid)
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
                contents: [
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

    return {
      type: 'flex',
      altText: `【${metrics.accountName}】成效快報：花費 $${metrics.spend.toLocaleString()}，ROAS ${metrics.roas.toFixed(2)}x`,
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
                    margin: 'xs' as const,
                  },
                  {
                    type: 'text' as const,
                    text: f.recommendation,
                    size: 'xxs' as const,
                    color: '#DC2626',
                    weight: 'bold' as const,
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
          const isWinner = c.roas >= 2.0;
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
                    text: c.roas > 0 ? `${c.roas.toFixed(2)}x` : '—',
                    size: 'sm',
                    weight: 'bold',
                    color: isWinner ? '#059669' : '#64748B',
                    align: 'end',
                    flex: 1,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'xs',
                contents: [
                  { type: 'text', text: c.budgetDesc, size: 'xxs', color: '#64748B', flex: 2 },
                  { type: 'text', text: `花費: $${c.spend.toFixed(0)}`, size: 'xxs', color: '#64748B', flex: 2 },
                  { type: 'text', text: `CTR: ${c.ctr.toFixed(1)}%`, size: 'xxs', color: '#64748B', align: 'end', flex: 2 },
                ],
              },
            ],
          };
        }),
      },
    };

    return {
      type: 'flex',
      altText: `【${accountName}】活躍活動列表`,
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
              { type: 'text', text: '📊 輸入「看成效」或「大盤」➔ 調閱近7天花費與ROAS', size: 'xs', color: '#0F172A' },
              { type: 'text', text: '⚡ 輸入「查疲勞」➔ 執行三選二素材疲勞檢測', size: 'xs', color: '#0F172A' },
              { type: 'text', text: '🎯 輸入「查活動」➔ 列出當前活躍活動與投報率', size: 'xs', color: '#0F172A' },
              { type: 'text', text: '🔄 輸入「切換 一起夢想」或「切換 DR.WU」➔ 切換監控目標', size: 'xs', color: '#0F172A' },
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
            style: 'primary',
            color: '#2563EB',
            height: 'sm',
            action: { type: 'message', label: '立即看成效', text: '看成效' },
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
}
