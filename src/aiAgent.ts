import { config, runtimeState, KNOWN_ACCOUNTS } from './config.js';
import { MetaService } from './metaService.js';

// Gemini 函數調用 (Function Calling) 宣告
const TOOL_DECLARATIONS = [
  {
    name: 'get_account_overview',
    description: '調閱指定 Meta 廣告帳號的整體成效大盤（花費、曝光數、點擊數、CTR、CPC、CPM、頻率、轉換數、CPA、ROAS 等）。',
    parameters: {
      type: 'OBJECT',
      properties: {
        accountNameOrId: {
          type: 'STRING',
          description: '廣告帳號名稱（如 一起夢想、DR.WU、科懋、微型社福）或 ID（如 act_4000297516716904）。若未指定則使用當前監控帳號。',
        },
        datePreset: {
          type: 'STRING',
          description: '時間區間，可選：today（今天）、yesterday（昨天）、last_3d（近3天）、last_7d（近7天）、last_14d（近14天）、last_30d（近30天）。預設為 last_7d。',
        },
      },
    },
  },
  {
    name: 'list_campaigns',
    description: '列出指定廣告帳號的各行銷活動（Campaigns）成效排行與預算配置（包含名稱、狀態、CBO/ABO、日預算、花費、點擊率、ROAS 等）。',
    parameters: {
      type: 'OBJECT',
      properties: {
        accountNameOrId: {
          type: 'STRING',
          description: '廣告帳號名稱或 ID。若未指定則使用當前監控帳號。',
        },
        datePreset: {
          type: 'STRING',
          description: '時間區間，預設 last_7d。可選 today, yesterday, last_3d, last_7d, last_14d, last_30d。',
        },
        limit: {
          type: 'INTEGER',
          description: '調閱活動數量上限，預設 6。',
        },
      },
    },
  },
  {
    name: 'detect_fatigue_ads',
    description: '執行「素材疲勞三選二診斷」，找出頻率過高（Freq > 4.0）且點擊率暴跌或取得成本狂飆的吸血疲勞素材。',
    parameters: {
      type: 'OBJECT',
      properties: {
        accountNameOrId: {
          type: 'STRING',
          description: '廣告帳號名稱或 ID。若未指定則使用當前監控帳號。',
        },
      },
    },
  },
  {
    name: 'list_accessible_ad_accounts',
    description: '查詢目前 Token 授權可存取的所有 Meta 廣告帳號清單與歷史總花費、幣別、狀態。',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'switch_ad_account',
    description: '切換當前對話預設監控的廣告帳號。',
    parameters: {
      type: 'OBJECT',
      properties: {
        targetAccount: {
          type: 'STRING',
          description: '目標帳號名稱（如 DR.WU、一起夢想、科懋）或 ID（如 act_6666271896827259）。',
        },
      },
      required: ['targetAccount'],
    },
  },
];

// 解析帳號名稱或 ID
function resolveAccountId(input?: string): { id: string; name: string } {
  if (!input) {
    return { id: runtimeState.currentAdAccountId, name: runtimeState.currentAccountName };
  }
  const clean = input.trim();
  for (const [name, info] of Object.entries(KNOWN_ACCOUNTS)) {
    if (clean.toLowerCase() === name.toLowerCase() || clean.includes(name)) {
      return { id: info.id, name: info.name };
    }
  }
  if (clean.startsWith('act_') || /^\d+$/.test(clean)) {
    const id = clean.startsWith('act_') ? clean : `act_${clean}`;
    return { id, name: id };
  }
  return { id: runtimeState.currentAdAccountId, name: runtimeState.currentAccountName };
}

// 執行 Tool Function
async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  console.log(`🛠️ [AI Tool Call] 正在執行工具: ${name}, 參數:`, JSON.stringify(args));
  try {
    switch (name) {
      case 'get_account_overview': {
        const { id, name: accName } = resolveAccountId(args.accountNameOrId);
        const preset = args.datePreset || 'last_7d';
        const data = await MetaService.getAccountOverview(id, preset);
        return { targetAccount: accName, accountId: id, metrics: data };
      }

      case 'list_campaigns': {
        const { id, name: accName } = resolveAccountId(args.accountNameOrId);
        const preset = args.datePreset || 'last_7d';
        const limit = args.limit || 6;
        const campaigns = await MetaService.listCampaigns(id, preset, limit);
        return { targetAccount: accName, accountId: id, campaigns };
      }

      case 'detect_fatigue_ads': {
        const { id, name: accName } = resolveAccountId(args.accountNameOrId);
        const fatigued = await MetaService.detectFatigue(id);
        return { targetAccount: accName, accountId: id, fatiguedAds: fatigued, totalFatigued: fatigued.length };
      }

      case 'list_accessible_ad_accounts': {
        const accounts = await MetaService.listAccessibleAccounts();
        return { accessibleAccounts: accounts };
      }

      case 'switch_ad_account': {
        const target = args.targetAccount;
        const matchedKey = Object.keys(KNOWN_ACCOUNTS).find(
          (k) => k.toLowerCase() === target.toLowerCase() || target.includes(k)
        );
        if (matchedKey) {
          runtimeState.currentAdAccountId = KNOWN_ACCOUNTS[matchedKey].id;
          runtimeState.currentAccountName = KNOWN_ACCOUNTS[matchedKey].name;
          return { success: true, currentAccountName: runtimeState.currentAccountName, currentAdAccountId: runtimeState.currentAdAccountId };
        } else if (target.startsWith('act_') || /^\d+$/.test(target)) {
          const id = target.startsWith('act_') ? target : `act_${target}`;
          runtimeState.currentAdAccountId = id;
          runtimeState.currentAccountName = id;
          return { success: true, currentAccountName: id, currentAdAccountId: id };
        }
        return { success: false, error: `找不到帳號「${target}」，可用帳號包含：${Object.keys(KNOWN_ACCOUNTS).join('、')}` };
      }

      default:
        return { error: `未知工具: ${name}` };
    }
  } catch (err: any) {
    console.error(`❌ [AI Tool Error] 工具 ${name} 執行失敗:`, err.message);
    return { error: err.message || 'Meta API 查詢失敗' };
  }
}

const SYSTEM_INSTRUCTION = `
你是由 Google DeepMind 精心調校的頂尖 Meta 廣告操盤 AI 特助（代號 Antigravity Ads Agent）。
你的使用者是一位資深的數位行銷操盤手，目前正透過手機 LINE 與你對話。

【最高思考與回覆紀律】
1. 事實求是與零腦補鐵則：所有數據、ROAS、花費、點擊率必須 100% 來自工具回傳的真實 Meta API 數值，嚴禁捏造任何門檻或數字。
2. 商業矛盾與深度批判：
   - 主動抓出數據表象與商業本質的錯位（例如：點擊率超高但轉換率極低的「名人光環好奇點擊 vs. 落地頁意圖錯位」）。
   - 抓出預算倒掛矛盾（例如：高 ROAS 活動只配到小預算，虧錢活動卻吃重預算）。
   - 評估素材疲勞（頻率 > 4.0 且 CPA 上揚的素材）。
3. 手機排版優化：
   - 回應對象是手機螢幕，文字應當精準、犀利、有條理。
   - 善用 Emoji（📊、⚠️、💡、🎯）、加粗關鍵數據（例如 **ROAS 3.13x**、**花費 $2,159**）。
   - 給出破壞性且可落地的具體戰術建議（例如建議調配預算比例、關閉哪支素材）。
   - 篇幅控制：手機好讀至上，字數精簡控制在 350 字內，直切問題核心與解法，嚴禁冗長廢話。
4. 預設帳號環境：目前預設廣告帳號為【${runtimeState.currentAccountName}】(${runtimeState.currentAdAccountId})。
5. 語音與風格：使用自然親切但具備專業行銷洞察的台灣繁體中文。
6. 純讀取安全邊界 (Zero-Spend Guarantee)：本特助受最高資安政策保護，僅具備成效調閱與戰略分析權限（純唯讀 ads_read），絕無任何修改預算、暫停廣告或變更設定的寫入權限，以確保 100% 財務與資產零風險。所有戰術建議應清楚引導操盤手前往 Meta Ads Manager 手動調整，切勿宣稱能直接幫使用者代為執行關閉或修改。
`.trim();

export class AIAgent {
  public static async handleUserMessage(userText: string): Promise<string> {
    const rawKey = config.gemini.apiKey || '';
    const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();
    const model = (config.gemini.model || 'gemini-2.5-flash').trim();

    if (!apiKey || apiKey.includes('your_gemini')) {
      throw new Error('未在 Render 環境變數設定正確的 GEMINI_API_KEY（請填入 AQ.Ab8... 完整金鑰）');
    }

    console.log(`🤖 [AIAgent] 正在使用主要模型: ${model}, 金鑰字首: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);

    // 依序排列可用模型：優先使用回應極速且配額穩定的 gemini-3.5-flash，遇負載或配額限制自動平滑降級備援
    const candidateModels = [
      model,
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-2.5-flash',
    ];
    const modelsToTry = [...new Set(candidateModels)];

    async function callGeminiWithFallback(requestBody: any): Promise<any> {
      let lastError: Error | null = null;
      for (const m of modelsToTry) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
          const data = await res.json();
          if (res.ok && !data.error) {
            return data;
          }
          const errMsg = data.error?.message || `HTTP ${res.status}`;
          const errStatus = data.error?.status || '';
          const errLower = errMsg.toLowerCase();
          console.warn(`⚠️ 模型 [${m}] 暫時無法回應 (${errMsg})，立即嘗試切換備援模型...`);
          lastError = new Error(errMsg);

          const isQuotaOrLoadIssue =
            res.status === 429 ||
            res.status === 503 ||
            res.status === 404 ||
            errStatus === 'RESOURCE_EXHAUSTED' ||
            errLower.includes('quota') ||
            errLower.includes('rate') ||
            errLower.includes('high demand') ||
            errLower.includes('resource_exhausted') ||
            errLower.includes('overloaded') ||
            errLower.includes('not found') ||
            errLower.includes('no longer available');

          if (isQuotaOrLoadIssue) {
            continue;
          }
          // 若為非負載錯誤 (例如 API key 錯誤)，直接拋出
          throw lastError;
        } catch (e: any) {
          lastError = e;
          const eMsg = (e.message || '').toLowerCase();
          if (
            eMsg.includes('high demand') ||
            eMsg.includes('503') ||
            eMsg.includes('429') ||
            eMsg.includes('quota') ||
            eMsg.includes('resource_exhausted') ||
            eMsg.includes('fetch failed')
          ) {
            continue;
          }
          throw lastError;
        }
      }

      // 若所有模型皆因短暫配額限制（例如 RPM 尖峰冷卻 3~5 秒），自動延遲等待後重試主力模型
      if (
        lastError &&
        (lastError.message.toLowerCase().includes('quota') ||
          lastError.message.toLowerCase().includes('resource_exhausted'))
      ) {
        console.warn('⏳ 偵測到模型配額暫時冷卻中，自動等待 3.5 秒後為用戶重試主力模型...');
        await new Promise((resolve) => setTimeout(resolve, 3500));
        const retryModel = 'gemini-3.6-flash';
        const retryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${retryModel}:generateContent?key=${apiKey}`;
        const retryRes = await fetch(retryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        const retryData = await retryRes.json();
        if (retryRes.ok && !retryData.error) {
          console.log(`✅ [AIAgent] 自動冷卻重試成功！使用模型: ${retryModel}`);
          return retryData;
        }
      }

      throw lastError || new Error('所有 Gemini 備援模型皆忙碌中，請稍候重試');
    }

    const contents: Array<{ role: string; parts: Array<any> }> = [
      { role: 'user', parts: [{ text: userText }] },
    ];

    let turns = 0;
    const maxTurns = 6;

    while (turns < maxTurns) {
      turns++;

      const requestBody = {
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      };

      const data = await callGeminiWithFallback(requestBody);

      const candidate = data.candidates?.[0];
      if (!candidate || !candidate.content) {
        return '⚠️ AI 目前無法生成回應，請稍後再試。';
      }

      const modelParts = candidate.content.parts || [];
      contents.push({ role: 'model', parts: modelParts });

      // 檢查是否要求調用 Tool
      const functionCalls = modelParts.filter((p: any) => p.functionCall);

      if (functionCalls.length === 0) {
        // 沒有更多 Tool 調用，直接提取文字輸出
        const textParts = modelParts.filter((p: any) => p.text).map((p: any) => p.text);
        return textParts.join('\n').trim();
      }

      // 平行非同步執行各個 Tool Call 並回填，大幅縮短響應時間
      const functionResponseParts = await Promise.all(
        functionCalls.map(async (fc: any) => {
          const call = fc.functionCall;
          const result = await executeTool(call.name, call.args || {});
          return {
            functionResponse: {
              name: call.name,
              response: result,
            },
          };
        })
      );

      contents.push({
        role: 'user',
        parts: functionResponseParts,
      });
    }

    return '⚠️ 查詢步驟過於複雜，請嘗試簡化問題。';
  }
}
