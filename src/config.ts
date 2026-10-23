import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

export interface BotConfig {
  line: {
    channelSecret: string;
    channelAccessToken: string;
  };
  adminUserId?: string;
  port: number;
  meta: {
    accessToken: string;
    accessTokens: string[];
    defaultAdAccountId: string;
    apiVersion: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
}

export type IndustryType = 'medical_aesthetics' | 'ecom_fastfashion' | 'online_courses' | 'b2b_services';

export interface AccountMeta {
  id: string;
  name: string;
  currency: string;
  industry: IndustryType;
}

export const KNOWN_ACCOUNTS: Record<string, AccountMeta> = {
  '一起夢想': { id: 'act_4000297516716904', name: '一起夢想', currency: 'USD', industry: 'b2b_services' },
  '微型社福': { id: 'act_3766578603469957', name: '微型社福', currency: 'USD', industry: 'b2b_services' },
  'DR.WU': { id: 'act_6666271896827259', name: 'DR. Wu (Transparency)', currency: 'TWD', industry: 'ecom_fastfashion' },
  'DRWU': { id: 'act_6666271896827259', name: 'DR. Wu (Transparency)', currency: 'TWD', industry: 'ecom_fastfashion' },
  '蝦皮CPAS': { id: 'act_436752879347374', name: 'Dr. Wu_蝦皮 CPAS', currency: 'TWD', industry: 'ecom_fastfashion' },
  'DR.WU 蝦皮': { id: 'act_436752879347374', name: 'Dr. Wu_蝦皮 CPAS', currency: 'TWD', industry: 'ecom_fastfashion' },
  '科懋': { id: 'act_1254249735550297', name: '91FB_科懋生物科技', currency: 'TWD', industry: 'ecom_fastfashion' },
  '科懋 PChome': { id: 'act_4062385184016497', name: '91FB_科懋生物科技-CPAS-PChome', currency: 'TWD', industry: 'ecom_fastfashion' },
  '生活用品': { id: 'act_755500688734546', name: '【生活用品】公益國際', currency: 'TWD', industry: 'ecom_fastfashion' },
  '蔚然頌缽': { id: 'act_296133962362410', name: '蔚然頌缽 音療堂', currency: 'TWD', industry: 'online_courses' },
  '頌缽 new': { id: 'act_436074055910653', name: '頌缽_new', currency: 'TWD', industry: 'online_courses' },
  'Smallta Chen': { id: 'act_10209459378536835', name: 'Smallta Chen', currency: 'USD', industry: 'b2b_services' },
  'sephiroth': { id: 'act_164267619', name: 'sephiroth', currency: 'TWD', industry: 'ecom_fastfashion' },
  'm2': { id: 'act_925148397169036', name: 'm2', currency: 'USD', industry: 'b2b_services' },
  'test': { id: 'act_1081893298921164', name: 'test', currency: 'TWD', industry: 'b2b_services' },
  '生鮮美食': { id: 'act_173149270766368', name: '【生鮮美食】、【醫美】', currency: 'TWD', industry: 'medical_aesthetics' },
  '生鮮美食醫美': { id: 'act_173149270766368', name: '【生鮮美食】、【醫美】', currency: 'TWD', industry: 'medical_aesthetics' },
  '醫美': { id: 'act_173149270766368', name: '【生鮮美食】、【醫美】', currency: 'TWD', industry: 'medical_aesthetics' },
  '美妝保養心靈保健': { id: 'act_379347667227517', name: '【美妝保養】【心靈保健】', currency: 'TWD', industry: 'ecom_fastfashion' },
  '美妝保養': { id: 'act_379347667227517', name: '【美妝保養】【心靈保健】', currency: 'TWD', industry: 'ecom_fastfashion' },
  '心靈保健': { id: 'act_379347667227517', name: '【美妝保養】【心靈保健】', currency: 'TWD', industry: 'online_courses' },
  '悅姿醫美': { id: 'act_838676849052863', name: '悅姿醫美診所', currency: 'TWD', industry: 'medical_aesthetics' },
  '悅姿': { id: 'act_838676849052863', name: '悅姿醫美診所', currency: 'TWD', industry: 'medical_aesthetics' },
};

export function getAccountIndustry(accountInput?: string): IndustryType {
  if (!accountInput) return 'medical_aesthetics';
  const clean = accountInput.trim();
  const sanitize = (s: string) => s.toLowerCase().replace(/[\s._\-()【】]/g, '');
  const target = sanitize(clean);
  for (const [alias, info] of Object.entries(KNOWN_ACCOUNTS)) {
    if (sanitize(alias) === target || sanitize(info.name) === target || info.id === clean || clean.includes(info.id)) {
      return info.industry;
    }
  }
  return 'medical_aesthetics';
}

// 狀態記憶體：記錄目前對話中選定的廣告帳號（自動依 META_AD_ACCOUNT_ID 匹配正確帳號名稱，避免標題與數據錯置）
const initialAdAccountId = process.env.META_AD_ACCOUNT_ID || 'act_173149270766368';
const matchedInitialAccount = Object.values(KNOWN_ACCOUNTS).find(
  (acc) => acc.id === initialAdAccountId
);

export const runtimeState = {
  currentAdAccountId: initialAdAccountId,
  currentAccountName: matchedInitialAccount ? matchedInitialAccount.name : '一起夢想',
};

// 核心主力監控帳號清單（可由環境變數 CORE_ACCOUNTS=生鮮美食,悅姿醫美,一起夢想 自由覆蓋，預設包含醫美主力與公益）
export const CORE_MONITORED_ACCOUNTS: string[] = (
  process.env.CORE_ACCOUNTS || '生鮮美食,悅姿醫美,一起夢想'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const config: BotConfig = {
  line: {
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  },
  adminUserId: process.env.ADMIN_LINE_USER_ID,
  port: parseInt(process.env.PORT || '3000', 10),
  meta: (() => {
    const rawTokens = [
      process.env.META_ACCESS_TOKEN,
      process.env.META_ACCESS_TOKENS,
      process.env.META_WRITE_ACCESS_TOKEN,
    ]
      .filter(Boolean)
      .join(',');

    const parsedTokens = [
      ...new Set(
        rawTokens
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.startsWith('EAA'))
      ),
    ];

    return {
      accessToken: parsedTokens[0] || process.env.META_ACCESS_TOKEN || '',
      accessTokens: parsedTokens.length > 0 ? parsedTokens : [process.env.META_ACCESS_TOKEN || ''].filter(Boolean),
      defaultAdAccountId: process.env.META_AD_ACCOUNT_ID || 'act_173149270766368',
      apiVersion: process.env.META_API_VERSION || 'v20.0',
    };
  })(),
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  },
};
