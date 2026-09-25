import { MetaService } from './metaService.js';
import { runtimeState, KNOWN_ACCOUNTS } from './config.js';

export interface AdAccountInfo {
  id: string;
  name: string;
  currency: string;
  statusLabel: string;
  shortName: string;
}

// 帳號快取（記憶體中快取 10 分鐘，避免每次切換重複請求 Meta API）
let cachedAccounts: AdAccountInfo[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

export class AccountManager {
  /**
   * 取得目前 Token 授權所能存取的所有廣告帳號清單（動態同步 Meta Graph API）
   */
  public static async getAccessibleAccounts(forceRefresh = false): Promise<AdAccountInfo[]> {
    const now = Date.now();
    if (!forceRefresh && cachedAccounts && now - lastCacheTime < CACHE_TTL_MS) {
      return cachedAccounts;
    }

    try {
      const metaAccounts = await MetaService.listAccessibleAccounts();
      const list: AdAccountInfo[] = metaAccounts.map((acc) => {
        let short = acc.name;
        // 智慧簡化長名稱，方便手機排版與點擊
        if (acc.name.includes('DR. Wu') || acc.name.includes('Dr. Wu')) {
          short = acc.name.includes('蝦皮') ? 'DR.WU 蝦皮' : 'DR.WU';
        } else if (acc.name.includes('科懋')) {
          short = acc.name.includes('PChome') ? '科懋 PChome' : '科懋';
        } else if (acc.name.includes('生活用品')) {
          short = '生活用品';
        } else if (acc.name.includes('蔚然頌缽')) {
          short = '蔚然頌缽';
        } else if (acc.name.includes('頌缽')) {
          short = '頌缽 new';
        }

        return {
          id: acc.id,
          name: acc.name,
          currency: acc.currency,
          statusLabel: acc.statusLabel,
          shortName: short,
        };
      });

      cachedAccounts = list;
      lastCacheTime = now;
      return list;
    } catch (e: any) {
      console.warn('⚠️ [AccountManager] 動態獲取帳號清單失敗，使用本地備援配置:', e.message);
      // 容錯降級保底
      return Object.entries(KNOWN_ACCOUNTS).map(([k, v]) => ({
        id: v.id,
        name: v.name,
        currency: v.currency,
        statusLabel: 'ACTIVE',
        shortName: k,
      }));
    }
  }

  /**
   * 智慧比對並切換廣告帳號（支援模糊搜尋、ID、別名、自然語言前綴清洗）
   */
  public static async matchAndSwitchAccount(userInput: string): Promise<{
    success: boolean;
    account?: AdAccountInfo;
    error?: string;
    availableAccounts?: AdAccountInfo[];
  }> {
    const accounts = await this.getAccessibleAccounts();

    // 清洗輸入字串：移除常見口語前綴（例如「幫我切換到」、「換成」、「切換成」、「目標設定為」等）
    let clean = userInput
      .replace(/^(請|幫我|我要)?(切換|換帳號|換到|換成|選|設為|改為|看)/i, '')
      .replace(/^(廣告|帳號|目標|到|成|至|為)/i, '')
      .replace(/^(廣告|帳號|目標)/i, '')
      .replace(/^[:：\s]+|[:：\s]+$/g, '')
      .trim();

    if (!clean) {
      return { success: false, availableAccounts: accounts };
    }

    const cleanLower = clean.toLowerCase();
    const cleanDigits = clean.replace(/[^0-9]/g, '');

    // 1. 純數字 ID 或 act_ 前綴精準比對 (如 4000297516716904 或 act_4000297516716904)
    if (cleanDigits.length >= 6) {
      const targetId = clean.startsWith('act_') ? clean : `act_${cleanDigits}`;
      const found = accounts.find((a) => a.id === targetId || a.id.replace('act_', '') === cleanDigits);
      if (found) {
        runtimeState.currentAdAccountId = found.id;
        runtimeState.currentAccountName = found.shortName || found.name;
        return { success: true, account: found };
      }
      // 若是合法格式但不在當前清單中，依然允許切換並綁定
      runtimeState.currentAdAccountId = targetId;
      runtimeState.currentAccountName = targetId;
      return {
        success: true,
        account: { id: targetId, name: targetId, currency: 'TWD', statusLabel: 'CUSTOM', shortName: targetId },
      };
    }

    // 2. 名稱完全匹配（忽略大小寫、空白與符號）
    const sanitize = (s: string) => s.toLowerCase().replace(/[\s\._\-\(\)【】]/g, '');
    const cleanSanitized = sanitize(clean);

    let match = accounts.find(
      (a) =>
        sanitize(a.shortName) === cleanSanitized ||
        sanitize(a.name) === cleanSanitized
    );

    // 3. 雙向包含模糊搜尋 (Fuzzy Containment)
    if (!match) {
      match = accounts.find(
        (a) =>
          sanitize(a.shortName).includes(cleanSanitized) ||
          sanitize(a.name).includes(cleanSanitized) ||
          cleanSanitized.includes(sanitize(a.shortName))
      );
    }

    // 4. 特殊別名與常見口語對映
    if (!match) {
      if (cleanLower.includes('drwu') || cleanLower.includes('dr.wu') || cleanLower.includes('達爾膚')) {
        match = cleanLower.includes('蝦皮') || cleanLower.includes('cpas')
          ? accounts.find((a) => a.id === 'act_436752879347374')
          : accounts.find((a) => a.id === 'act_6666271896827259');
      } else if (cleanLower.includes('科懋')) {
        match = cleanLower.includes('pchome')
          ? accounts.find((a) => a.id === 'act_4062385184016497')
          : accounts.find((a) => a.id === 'act_1254249735550297');
      } else if (cleanLower.includes('頌缽')) {
        match = cleanLower.includes('new')
          ? accounts.find((a) => a.id === 'act_436074055910653')
          : accounts.find((a) => a.id === 'act_296133962362410');
      } else if (cleanLower.includes('生活') || cleanLower.includes('公益國際')) {
        match = accounts.find((a) => a.id === 'act_755500688734546');
      }
    }

    if (match) {
      runtimeState.currentAdAccountId = match.id;
      runtimeState.currentAccountName = match.shortName || match.name;
      return { success: true, account: match };
    }

    return {
      success: false,
      error: `找不到相符的廣告帳號「${clean}」`,
      availableAccounts: accounts,
    };
  }
}
