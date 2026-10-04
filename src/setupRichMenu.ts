import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { messagingApi } from '@line/bot-sdk';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupRichMenu(): Promise<string> {
  const token = config.line.channelAccessToken;
  if (!token) {
    throw new Error('未設定 LINE_CHANNEL_ACCESS_TOKEN');
  }

  const client = new messagingApi.MessagingApiClient({ channelAccessToken: token });
  const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken: token });

  console.log('🔍 正在檢查既有 Rich Menu 清單...');
  const existing = await client.getRichMenuList();
  for (const rm of existing.richmenus) {
    console.log(`🗑️ 清理舊版 Rich Menu: ${rm.richMenuId} (${rm.name})`);
    try {
      await client.deleteRichMenu(rm.richMenuId);
    } catch (e: any) {
      console.warn(`刪除舊 Rich Menu ${rm.richMenuId} 略過:`, e.message);
    }
  }

  console.log('✨ 正在建立全新的 6 格廣告特助 Rich Menu...');
  const richMenuReq = {
    size: {
      width: 2500,
      height: 1686,
    },
    selected: true,
    name: '廣告特助戰情選單',
    chatBarText: '📊 廣告特助選單',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: { type: 'message' as const, label: '看週報', text: '看週報' },
      },
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: { type: 'message' as const, label: '看成效', text: '看成效' },
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: { type: 'message' as const, label: '查疲勞', text: '查疲勞' },
      },
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: { type: 'message' as const, label: '素材象限', text: '素材象限' },
      },
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: { type: 'message' as const, label: '巡邏', text: '巡邏' },
      },
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: { type: 'message' as const, label: '換帳號', text: '換帳號' },
      },
    ],
  };

  const createRes = await client.createRichMenu(richMenuReq);
  const richMenuId = createRes.richMenuId;
  console.log(`✅ Rich Menu 骨架建立成功！ID: ${richMenuId}`);

  // 尋找 rich_menu.png 路徑
  const candidates = [
    path.resolve(__dirname, '../../rich_menu.png'),
    path.resolve(__dirname, '../rich_menu.png'),
    path.resolve(process.cwd(), 'rich_menu.png'),
  ];
  let imagePath = candidates.find((p) => fs.existsSync(p));
  if (!imagePath) {
    throw new Error('找不到 rich_menu.png 圖檔，請先執行 scripts/generate_rich_menu.py');
  }

  console.log(`📤 正在上傳圖文選單背景圖片 (${imagePath})...`);
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

  await blobClient.setRichMenuImage(richMenuId, imageBlob);
  console.log('✅ 圖文選單圖片上傳成功！');

  console.log('🌍 正在將此選單設定為所有使用者的預設圖文選單...');
  await client.setDefaultRichMenu(richMenuId);
  console.log('✅ 已成功設為預設 Rich Menu！');

  const adminIds = (config.adminUserId || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  for (const adminId of adminIds) {
    try {
      await client.linkRichMenuIdToUser(adminId, richMenuId);
      console.log(`✅ 已為管理員 [${adminId}] 強制綁定此 Rich Menu！`);
    } catch (linkErr: any) {
      console.warn(`為用戶 ${adminId} 綁定 Rich Menu 失敗:`, linkErr.message);
    }
  }

  console.log('🎉 圖文選單 (Rich Menu) 全流程配置完成！');
  return richMenuId;
}

if (process.argv[1]?.endsWith('setupRichMenu.js') || process.argv[1]?.endsWith('setupRichMenu.ts')) {
  setupRichMenu().catch((e) => {
    console.error('❌ 設定 Rich Menu 失敗:', e);
    process.exit(1);
  });
}
