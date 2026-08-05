import { describe, it, expect, beforeEach } from 'vitest';
import { getAll, resetDBForTests } from '../src/db/db';
import { seedIfNeeded } from '../src/db/seed';
import { loadSettings } from '../src/db/settings';
import type { ExpenseCategory, LinkGroup, LinkItem } from '../src/types';

describe('seed', () => {
  beforeEach(async () => {
    resetDBForTests();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('browser-workbench');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    localStorage.clear();
  });

  it('首次运行写入默认分类与默认链接，且只执行一次', async () => {
    await seedIfNeeded();
    const cats = await getAll<ExpenseCategory>('expense_categories');
    expect(cats.length).toBeGreaterThanOrEqual(10);
    const groups = await getAll<LinkGroup>('link_groups');
    expect(groups).toHaveLength(1);
    const links = await getAll<LinkItem>('links');
    expect(links.length).toBeGreaterThanOrEqual(8);
    const settings = await loadSettings();
    expect(settings.seeded).toBe(true);

    await seedIfNeeded();
    expect((await getAll<LinkItem>('links')).length).toBe(links.length);
  });
});
