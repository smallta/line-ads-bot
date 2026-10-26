import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../.data');
const LOCK_FILE = path.join(DATA_DIR, 'push_lock.json');

/**
 * 取得台北時間 (Asia/Taipei) 的今日日期字串 (YYYY-MM-DD)
 */
export function getTodayTaipeiDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
}

/**
 * 檢查今日是否已經成功推送過晨報（磁碟持久化，不受 Render 重啟與冷啟動影響）
 */
export function isMorningBriefPushedToday(): boolean {
  try {
    if (!fs.existsSync(LOCK_FILE)) return false;
    const raw = fs.readFileSync(LOCK_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const today = getTodayTaipeiDate();
    return data.lastMorningBriefDate === today;
  } catch (err) {
    return false;
  }
}

/**
 * 記錄今日晨報已成功推送
 */
export function recordMorningBriefPushed(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    let data: Record<string, any> = {};
    if (fs.existsSync(LOCK_FILE)) {
      try {
        data = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
      } catch (e) {}
    }
    data.lastMorningBriefDate = getTodayTaipeiDate();
    data.lastMorningBriefTimestamp = Date.now();
    fs.writeFileSync(LOCK_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`🔒 [LockManager] 已將今日晨報成功鎖定於磁碟: ${data.lastMorningBriefDate}`);
  } catch (err: any) {
    console.warn('⚠️ [LockManager] 寫入鎖檔失敗:', err.message);
  }
}
