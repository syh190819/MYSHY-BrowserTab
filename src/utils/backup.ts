import { exportAll, importAll } from '../db/db';
import { todayStr } from './helpers';

export interface BackupFile {
  version: 1;
  data: Record<string, unknown[]>;
  exportedAt: string;
}

export function validateBackup(input: unknown): input is BackupFile {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  return obj.version === 1 && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data);
}

export async function downloadBackup(): Promise<void> {
  const data = await exportAll();
  const payload: BackupFile = {
    version: 1,
    data,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `browser-workbench-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function readBackupFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

export async function restoreBackup(input: unknown): Promise<void> {
  if (!validateBackup(input)) {
    throw new Error('备份文件格式不正确');
  }
  await importAll(input.data);
}
