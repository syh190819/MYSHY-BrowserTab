import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAll,
  putRecord,
  deleteRecord,
  clearStore,
  exportAll,
  importAll,
  resetDBForTests,
} from '../src/db/db';

interface Sample {
  id?: number;
  name: string;
}

describe('db', () => {
  beforeEach(async () => {
    resetDBForTests();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('browser-workbench');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('put 后能 getAll 读取，并返回自增 id', async () => {
    const id = await putRecord<Sample>('notes', { name: '第一条' });
    expect(id).toBeGreaterThan(0);
    const all = await getAll<Sample>('notes');
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('第一条');
  });

  it('delete 后记录消失', async () => {
    const id = await putRecord<Sample>('notes', { name: '待删' });
    await deleteRecord('notes', id);
    const all = await getAll<Sample>('notes');
    expect(all).toHaveLength(0);
  });

  it('clearStore 清空指定表', async () => {
    await putRecord<Sample>('notes', { name: 'a' });
    await putRecord<Sample>('notes', { name: 'b' });
    await clearStore('notes');
    expect(await getAll<Sample>('notes')).toHaveLength(0);
  });

  it('exportAll/importAll 往返一致', async () => {
    await putRecord<Sample>('notes', { name: '备份我' });
    const backup = await exportAll();
    await clearStore('notes');
    await importAll(backup);
    const all = await getAll<Sample>('notes');
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('备份我');
  });
});
