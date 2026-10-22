import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CooldownRecord, AuditLogRecord } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../.data');
const STATE_FILE = path.join(DATA_DIR, 'automation_state.json');

export interface IAutomationStateStore {
  getCooldown(targetId: string): Promise<CooldownRecord | null>;
  setCooldown(record: CooldownRecord): Promise<void>;
  removeCooldown(targetId: string): Promise<void>;
  listActiveCooldowns(): Promise<CooldownRecord[]>;
  recordAuditLog(log: AuditLogRecord): Promise<void>;
  getAuditLogs(limit?: number): Promise<AuditLogRecord[]>;
  getAuditLogById(logId: string): Promise<AuditLogRecord | null>;
  markRolledBack(logId: string): Promise<boolean>;
}

/**
 * 檔案式狀態記憶庫 (FileStateStore)
 * 支援本地與 Render 環境持久化，並隨時可無縫替換為 GCP FirestoreStateStore
 */
export class FileStateStore implements IAutomationStateStore {
  private cooldowns: Map<string, CooldownRecord> = new Map();
  private auditLogs: AuditLogRecord[] = [];
  private isLoaded = false;

  constructor() {
    this.loadFromDisk();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.warn('⚠️ [StateStore] 無法建立 .data 目錄，將僅使用記憶體模式:', err);
      }
    }
  }

  private loadFromDisk() {
    if (this.isLoaded) return;
    try {
      this.ensureDataDir();
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.cooldowns)) {
          this.cooldowns.clear();
          const now = Date.now();
          for (const item of data.cooldowns) {
            if (item && item.expiresAt > now) {
              this.cooldowns.set(item.targetId, item);
            }
          }
        }
        if (Array.isArray(data.auditLogs)) {
          this.auditLogs = data.auditLogs;
        }
        console.log(`💾 [StateStore] 已從磁碟載入狀態：${this.cooldowns.size} 筆有效冷卻，${this.auditLogs.length} 筆審查日誌。`);
      }
    } catch (err: any) {
      console.warn('⚠️ [StateStore] 讀取磁碟狀態檔失敗，以初始空狀態啟動:', err.message);
    } finally {
      this.isLoaded = true;
    }
  }

  private saveToDisk() {
    try {
      this.ensureDataDir();
      const payload = {
        updatedAt: new Date().toISOString(),
        cooldowns: Array.from(this.cooldowns.values()),
        auditLogs: this.auditLogs.slice(0, 200), // 保留最近 200 筆審查日誌
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('⚠️ [StateStore] 寫入磁碟狀態檔失敗:', err.message);
    }
  }

  public async getCooldown(targetId: string): Promise<CooldownRecord | null> {
    const item = this.cooldowns.get(targetId);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cooldowns.delete(targetId);
      this.saveToDisk();
      return null;
    }
    return item;
  }

  public async setCooldown(record: CooldownRecord): Promise<void> {
    this.cooldowns.set(record.targetId, record);
    this.saveToDisk();
  }

  public async removeCooldown(targetId: string): Promise<void> {
    if (this.cooldowns.has(targetId)) {
      this.cooldowns.delete(targetId);
      this.saveToDisk();
    }
  }

  public async listActiveCooldowns(): Promise<CooldownRecord[]> {
    const now = Date.now();
    const active: CooldownRecord[] = [];
    for (const [id, item] of this.cooldowns.entries()) {
      if (item.expiresAt > now) {
        active.push(item);
      } else {
        this.cooldowns.delete(id);
      }
    }
    return active;
  }

  public async recordAuditLog(log: AuditLogRecord): Promise<void> {
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 300) {
      this.auditLogs = this.auditLogs.slice(0, 300);
    }
    this.saveToDisk();
  }

  public async getAuditLogs(limit = 20): Promise<AuditLogRecord[]> {
    return this.auditLogs.slice(0, limit);
  }

  public async getAuditLogById(logId: string): Promise<AuditLogRecord | null> {
    const found = this.auditLogs.find((l) => l.id === logId);
    return found || null;
  }

  public async markRolledBack(logId: string): Promise<boolean> {
    const log = this.auditLogs.find((l) => l.id === logId);
    if (!log) return false;
    log.rolledBack = true;
    log.rolledBackAt = new Date().toISOString();
    if (log.targetId) {
      this.cooldowns.delete(log.targetId);
    }
    this.saveToDisk();
    return true;
  }
}

// 導出全局單例
export const globalStateStore = new FileStateStore();
