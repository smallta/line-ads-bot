import { config, runtimeState, KNOWN_ACCOUNTS } from './config.js';
import { MetaService } from './metaService.js';
import { AccountManager } from './accountManager.js';
import { generateCleanedDiagnosticReport, DiagnosticReportPayload } from './pipelineReport.js';
import { AutomationService } from './automation/automationService.js';

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
    description: '切換當前對話預設監控的廣告帳號。你完全具備此權限！當使用者要求換帳號、切換帳號或想查看其他品牌/專案時，必須調用此工具。',
    parameters: {
      type: 'OBJECT',
      properties: {
        targetAccount: {
          type: 'STRING',
          description: '目標帳號名稱（如 DR.WU、微型社福、蔚然頌缽、生活用品、科懋）或 ID（如 act_6666271896827259）。',
        },
      },
      required: ['targetAccount'],
    },
  },
  {
    name: 'pause_ad',
    description: '暫停指定的 Meta 廣告素材（將其狀態設為 PAUSED）。用於止血、停損或疲勞素材淘汰。你具備此操作權限！',
    parameters: {
      type: 'OBJECT',
      properties: {
        adId: {
          type: 'STRING',
          description: '廣告素材 ID（如 120210... 或 ad_120210...）。',
        },
        adName: {
          type: 'STRING',
          description: '廣告名稱（選填）。',
        },
      },
      required: ['adId'],
    },
  },
  {
    name: 'pause_campaign',
    description: '暫停指定的 Meta 行銷活動（將其狀態設為 PAUSED）。用於整體活動表現不佳或預算嚴重超支時一鍵止血。你具備此操作權限！',
    parameters: {
      type: 'OBJECT',
      properties: {
        campaignId: {
          type: 'STRING',
          description: '行銷活動 ID（如 120210...）。',
        },
        campaignName: {
          type: 'STRING',
          description: '活動名稱（選填）。',
        },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'reduce_budget',
    description: '縮減指定行銷活動或廣告組合的日預算（預設調降 20%）。用於風控止血與預算收縮。你具備此操作權限！',
    parameters: {
      type: 'OBJECT',
      properties: {
        targetId: {
          type: 'STRING',
          description: '目標活動或廣告組合 ID。',
        },
        percentage: {
          type: 'NUMBER',
          description: '縮減比例（小數，例如 0.2 代表縮減 20%）。預設 0.2。',
        },
      },
      required: ['targetId'],
    },
  },
  {
    name: 'run_health_audit',
    description: '執行 Meta 廣告帳號的 0-100 分綜合健康大健檢 (Ads Health Score)，涵蓋素材疲勞風控、預算結構、獲客 ROI、點擊意圖與 A~F 級評等。當使用者要求健檢、診斷帳號或詢問健康度時調用。',
    parameters: {
      type: 'OBJECT',
      properties: {
        accountNameOrId: {
          type: 'STRING',
          description: '廣告帳號名稱或 ID。若未指定則使用當前帳號。',
        },
      },
    },
  },
  {
    name: 'run_automation_scan',
    description: '執行全自動風控哨兵巡檢 (Auto Bleed-Guard)，自動偵測零轉換失血活動、ROAS 崩跌與受眾疲勞，並依據 24 小時冷卻期保護自動執行調降 20% 預算或暫停止血。當使用者要求自動化巡檢、防暴衝或模擬風控時調用。',
    parameters: {
      type: 'OBJECT',
      properties: {
        accountNameOrId: {
          type: 'STRING',
          description: '廣告帳號名稱或 ID。若未指定則使用當前帳號。',
        },
        dryRun: {
          type: 'BOOLEAN',
          description: '是否為模擬模式（true 為僅演算與產出戰報，不真正向 Meta API 寫入；false 為實戰執行止血）。',
        },
      },
    },
  },
  {
    name: 'get_daily_cleaned_report',
    description:
      '調閱指定日期（預設昨日）與前 7 日基準線對比的「標準化清洗日報 JSON」，涵蓋：1.醫美私訊數與單則私訊成本(cost_per_messaging)、2.公益/名單轉換成本(CPA)、3.電商漏斗(加購/結帳/購買/ROAS)及各活動異常診斷註記。當使用者詢問昨日表現、日報診斷、與7日基準線比較時優先調用。',
    parameters: {
      type: 'OBJECT',
      properties: {
        accountNameOrId: {
          type: 'STRING',
          description: '廣告帳號名稱或 ID（如 生鮮美食、悅姿醫美、一起夢想、DR.WU）。若未指定則使用當前帳號。',
        },
        date: {
          type: 'STRING',
          description: '指定日期 (YYYY-MM-DD)，未填則預設為昨日。',
        },
      },
    },
  },
];

// 解析帳號名稱或 ID（動態查詢全帳號庫與模糊比對）
async function resolveAccountId(input?: string): Promise<{ id: string; name: string }> {
  if (!input) {
    return { id: runtimeState.currentAdAccountId, name: runtimeState.currentAccountName };
  }
  const result = await AccountManager.matchAndSwitchAccount(input);
  if (result.success && result.account) {
    return { id: result.account.id, name: result.account.shortName || result.account.name };
  }
  const clean = input.trim();
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
        const { id, name: accName } = await resolveAccountId(args.accountNameOrId);
        const preset = args.datePreset || 'last_7d';
        const data = await MetaService.getAccountOverview(id, preset);
        return { targetAccount: accName, accountId: id, metrics: data };
      }

      case 'list_campaigns': {
        const { id, name: accName } = await resolveAccountId(args.accountNameOrId);
        const preset = args.datePreset || 'last_7d';
        const limit = args.limit || 6;
        const campaigns = await MetaService.listCampaigns(id, preset, limit);
        return { targetAccount: accName, accountId: id, campaigns };
      }

      case 'detect_fatigue_ads': {
        const { id, name: accName } = await resolveAccountId(args.accountNameOrId);
        const fatigued = await MetaService.detectFatigue(id);
        return { targetAccount: accName, accountId: id, fatiguedAds: fatigued, totalFatigued: fatigued.length };
      }

      case 'list_accessible_ad_accounts': {
        const accounts = await AccountManager.getAccessibleAccounts();
        return { accessibleAccounts: accounts };
      }

      case 'switch_ad_account': {
        const target = args.targetAccount;
        const result = await AccountManager.matchAndSwitchAccount(target);
        if (result.success && result.account) {
          return {
            success: true,
            currentAccountName: runtimeState.currentAccountName,
            currentAdAccountId: runtimeState.currentAdAccountId,
          };
        }
        const accounts = await AccountManager.getAccessibleAccounts();
        const names = accounts.map((a) => a.shortName).join('、');
        return {
          success: false,
          error: `找不到帳號「${target}」，目前可存取的廣告帳號包含：${names}`,
        };
      }

      case 'pause_ad': {
        const adId = String(args.adId);
        const adName = args.adName;
        const res = await MetaService.pauseAd(adId, adName);
        return { success: true, message: `已成功將廣告【${res.name}】(${res.id}) 狀態設為 PAUSED 暫停！` };
      }

      case 'pause_campaign': {
        const campaignId = String(args.campaignId);
        const campaignName = args.campaignName;
        const res = await MetaService.pauseCampaign(campaignId, campaignName);
        return { success: true, message: `已成功將行銷活動【${res.name}】(${res.id}) 狀態設為 PAUSED 暫停！` };
      }

      case 'reduce_budget': {
        const targetId = String(args.targetId);
        const pct = typeof args.percentage === 'number' ? args.percentage : 0.2;
        const res = await MetaService.reduceBudget(targetId, pct);
        return {
          success: true,
          message: `已成功將【${res.name}】日預算由 ${res.oldBudgetDisplay} 調降至 ${res.newBudgetDisplay}（調降 ${res.percentage}%），節省約 ${res.savedDisplay} / 天。`,
        };
      }

      case 'run_health_audit': {
        const { id, name: accName } = await resolveAccountId(args.accountNameOrId);
        const audit = await MetaService.generateHealthAudit(id);
        return {
          targetAccount: accName,
          accountId: id,
          healthScore: audit.score,
          grade: audit.grade,
          dimensions: audit.dimensions,
          passedChecks: audit.passedChecks,
          failedChecks: audit.failedChecks,
          topRecommendation: audit.topRecommendation,
        };
      }

      case 'run_automation_scan': {
        const { id, name: accName } = await resolveAccountId(args.accountNameOrId);
        const dryRun = Boolean(args.dryRun);
        const report = await AutomationService.runScan(id, accName, dryRun);
        return {
          targetAccount: accName,
          accountId: id,
          dryRun: report.dryRun,
          totalInspected: report.totalInspected,
          triggeredCount: report.triggeredCount,
          executedCount: report.executedCount,
          cooldownSuppressedCount: report.cooldownSuppressedCount,
          advisoryOnlyCount: report.advisoryOnlyCount,
          resultsSummary: report.results.map((r) => ({
            target: r.targetName,
            type: r.targetType,
            rule: r.triggeredRule?.name,
            reason: r.reason,
            action: r.actionDetail,
            inCooldown: r.inCooldown,
            executed: r.executed,
          })),
        };
      }

      case 'get_daily_cleaned_report': {
        const { id, name: accName } = await resolveAccountId(args.accountNameOrId);
        const payload = await generateCleanedDiagnosticReport({
          account: id,
          date: args.date,
        });
        return {
          targetAccount: accName,
          accountId: id,
          cleanedReport: payload,
        };
      }

      default:
        return { error: `未知工具: ${name}` };
    }
  } catch (err: any) {
    console.error(`❌ [AI Tool Error] 工具 ${name} 執行失敗:`, err.message);
    let errMsg = err.message || 'Meta API 執行失敗';
    if (errMsg.includes('permission') || errMsg.includes('OAuthException') || errMsg.includes('ads_management')) {
      errMsg = `目前 Meta Access Token 缺少「ads_management（寫入/更新廣告）」權限。請在 Meta for Developers 將該 Token 增加 ads_management 權限後重新填入環境變數。`;
    }
    return { error: errMsg };
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
6. 帳號切換與止血操作權限：
   - 【帳號切換權限】你「完全有權限」在已授權的多個廣告帳號間自由切換！當使用者提到「換帳號」、「切換到...」、「看DRWU」、「看微型社福」、「看生活用品」等時，你【必須】積極調用 switch_ad_account 工具為使用者切換目標帳號。
   - 【止血與預算管理權限】當操盤手明確下達「暫停廣告」、「關閉素材」、「暫停活動」或「縮減預算 / 縮預算 20%」等止血指令時，你【具備執行權限】！請調用 pause_ad、pause_campaign 或 reduce_budget 工具為操盤手即時執行止血操作。執行完畢後請回報操作對象名稱、調整前後金額與節省幅度。
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

  /**
   * 根據清洗後的標準化 JSON Payload 產出每日晨報 AI 顧問診斷摘要
   * 嚴格遵循優先級：1. 醫美/私訊導向 > 3. 公益/捐款導向 > 2. 電商/購買導向
   */
  public static async generateMorningAiDiagnosis(
    payload: DiagnosticReportPayload,
    accountName: string
  ): Promise<string> {
    const prompt = `
請根據以下已完成防除以零清洗與 7 日基準線對比的真實廣告數據 JSON，為【${accountName}】產出今日晨間 AI 操盤診斷摘要。

【嚴格判讀紀律（依產業屬性切換尺標，禁止拿錯指標）】
1. 第一優先（醫美／諮詢導向，如生鮮美食/醫美、悅姿醫美）：
   - 若 purchases=0 且活動屬於互動/私訊導向，【嚴禁】批評 ROAS 為 0！
   - 必須聚焦檢視：私訊數 (messaging_conversations)、單則私訊成本 (cost_per_messaging vs 7日均值)、點擊率 (CTR vs 7日均值)、CPC 漲跌幅與頻次 (Frequency 是否 > 2.5)。
2. 第二優先（公益／捐款名單導向，如一起夢想、微型社福）：
   - 聚焦檢視：單筆轉換/捐款成本 (CPA vs 7日均值)、CTR 點擊意圖與各活動花費配置。
3. 第三優先（電商／購買導向，如 DR.WU、科懋、生活用品）：
   - 聚焦檢視：ROAS vs 7日基準線與目標 (${payload.target_roas})、加購 (cart_adds) 到結帳 (checkout_initiated) 漏斗轉換、AOV 與高頻次疲勞活動。

【輸出格式要求】
- 手機 LINE 閱讀極簡排版，總字數嚴格控制在 260 字以內。
- 分為三點：
  📊 **昨日大盤 vs 7日基準**：1~2 句點出花費與核心指標變化。
  ⚠️ **矛盾與異常抓漏**：點出哪支 Campaign 表現最佳或哪支有成本上揚/頻次偏高風險。
  🎯 **今日具體動作**：給出 1~2 條可立即執行的預算或素材調整建議。

【清洗後真實數據 JSON】
${JSON.stringify(payload)}
`.trim();

    return this.handleUserMessage(prompt);
  }
}
