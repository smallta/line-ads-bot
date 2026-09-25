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
    defaultAdAccountId: string;
    apiVersion: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
}

export const KNOWN_ACCOUNTS: Record<string, { id: string; name: string; currency: string }> = {
  '一起夢想': { id: 'act_4000297516716904', name: '一起夢想', currency: 'USD' },
  '微型社福': { id: 'act_3766578603469957', name: '微型社福', currency: 'USD' },
  'DR.WU': { id: 'act_6666271896827259', name: 'DR. Wu (Transparency)', currency: 'TWD' },
  'DRWU': { id: 'act_6666271896827259', name: 'DR. Wu (Transparency)', currency: 'TWD' },
  '蝦皮CPAS': { id: 'act_436752879347374', name: 'Dr. Wu_蝦皮 CPAS', currency: 'TWD' },
  'DR.WU 蝦皮': { id: 'act_436752879347374', name: 'Dr. Wu_蝦皮 CPAS', currency: 'TWD' },
  '科懋': { id: 'act_1254249735550297', name: '91FB_科懋生物科技', currency: 'TWD' },
  '科懋 PChome': { id: 'act_4062385184016497', name: '91FB_科懋生物科技-CPAS-PChome', currency: 'TWD' },
  '生活用品': { id: 'act_755500688734546', name: '【生活用品】公益國際', currency: 'TWD' },
  '蔚然頌缽': { id: 'act_296133962362410', name: '蔚然頌缽 音療堂', currency: 'TWD' },
  '頌缽 new': { id: 'act_436074055910653', name: '頌缽_new', currency: 'TWD' },
  'Smallta Chen': { id: 'act_10209459378536835', name: 'Smallta Chen', currency: 'USD' },
  'sephiroth': { id: 'act_164267619', name: 'sephiroth', currency: 'TWD' },
  'm2': { id: 'act_925148397169036', name: 'm2', currency: 'USD' },
  'test': { id: 'act_1081893298921164', name: 'test', currency: 'TWD' },
};

// 狀態記憶體：記錄目前對話中選定的廣告帳號
export const runtimeState = {
  currentAdAccountId: process.env.META_AD_ACCOUNT_ID || 'act_4000297516716904',
  currentAccountName: '一起夢想',
};

export const config: BotConfig = {
  line: {
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  },
  adminUserId: process.env.ADMIN_LINE_USER_ID,
  port: parseInt(process.env.PORT || '3000', 10),
  meta: {
    accessToken: process.env.META_ACCESS_TOKEN || '',
    defaultAdAccountId: process.env.META_AD_ACCOUNT_ID || 'act_4000297516716904',
    apiVersion: process.env.META_API_VERSION || 'v20.0',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  },
};
