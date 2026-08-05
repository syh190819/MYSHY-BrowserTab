import type { Expense, ExpenseCategory } from '../types';

function esc(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function expensesToCsv(expenses: Expense[], categories: ExpenseCategory[]): string {
  const nameOf = (id: number) => categories.find((c) => c.id === id)?.name ?? '未分类';
  const header = ['日期', '类型', '分类', '金额', '备注'];
  const rows = [...expenses]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((e) =>
      [e.date, e.type === 'income' ? '收入' : '支出', nameOf(e.categoryId), e.amount, e.note]
        .map(esc)
        .join(','),
    );
  return [header.join(','), ...rows].join('\r\n');
}
