import dotenv from 'dotenv';
dotenv.config();
export const KNOWN_ACCOUNTS = {
    '一起夢想': { id: 'act_4000297516716904', name: '一起夢想', currency: 'USD' },
    '微型社福': { id: 'act_3766578603469957', name: '微型社福', currency: 'USD' },
    'DR.WU': { id: 'act_6666271896827259', name: 'DR. Wu (Transparency)', currency: 'TWD' },
    'DRWU': { id: 'act_6666271896827259', name: 'DR. Wu (Transparency)', currency: 'TWD' },
    '蝦皮CPAS': { id: 'act_436752879347374', name: 'Dr. Wu_蝦皮 CPAS', currency: 'TWD' },
    '科懋': { id: 'act_1254249735550297', name: '91FB_科懋生物科技', currency: 'TWD' },
};
// 狀態記憶體：記錄目前對話中選定的廣告帳號
export const runtimeState = {
    currentAdAccountId: process.env.META_AD_ACCOUNT_ID || 'act_4000297516716904',
    currentAccountName: '一起夢想',
};
export const config = {
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
};
