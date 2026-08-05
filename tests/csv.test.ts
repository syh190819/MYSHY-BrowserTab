import { describe, it, expect } from 'vitest';
import { expensesToCsv } from '../src/utils/csv';
import type { Expense, ExpenseCategory } from '../src/types';

const cat: ExpenseCategory = { id: 1, name: '餐饮', type: 'expense', sort: 0, deletedAt: null };

const exp = (over: Partial<Expense>): Expense => ({
  id: 1,
  type: 'expense',
  amount: 12.5,
  categoryId: 1,
  date: '2026-08-01',
  note: '',
  createdAt: '',
  deletedAt: null,
  ...over,
});

describe('csv', () => {
  it('输出带表头的 CSV', () => {
    const csv = expensesToCsv([exp({})], [cat]);
    expect(csv.split('\r\n')[0]).toBe('日期,类型,分类,金额,备注');
  });

  it('按日期升序且转义逗号', () => {
    const a = exp({ id: 1, date: '2026-08-02', note: '午饭' });
    const b = exp({ id: 2, date: '2026-08-01', note: '咖啡,拿铁' });
    const csv = expensesToCsv([a, b], [cat]);
    const lines = csv.split('\r\n');
    expect(lines[1].startsWith('2026-08-01')).toBe(true);
    expect(lines[1]).toContain('"咖啡,拿铁"');
  });

  it('类型显示为收入/支出', () => {
    const csv = expensesToCsv([exp({ type: 'income' })], [cat]);
    expect(csv).toContain('收入');
  });
});
