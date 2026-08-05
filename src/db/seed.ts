import { getAll, putRecord } from './db';
import { loadSettings, saveSettings } from './settings';
import type { ExpenseCategory, LinkGroup, LinkItem } from '../types';

export async function seedIfNeeded(): Promise<void> {
  const settings = await loadSettings();
  if (settings.seeded) return;

  const existingCats = await getAll<ExpenseCategory>('expense_categories');
  if (existingCats.length === 0) {
    const defaults: Array<[string, 'income' | 'expense']> = [
      ['工资', 'income'],
      ['奖金', 'income'],
      ['理财', 'income'],
      ['其他收入', 'income'],
      ['餐饮', 'expense'],
      ['交通', 'expense'],
      ['购物', 'expense'],
      ['居住', 'expense'],
      ['娱乐', 'expense'],
      ['医疗', 'expense'],
      ['其他支出', 'expense'],
    ];
    for (let i = 0; i < defaults.length; i++) {
      await putRecord<ExpenseCategory>('expense_categories', {
        name: defaults[i][0],
        type: defaults[i][1],
        sort: i,
        deletedAt: null,
      });
    }
  }

  const groups = await getAll<LinkGroup>('link_groups');
  if (groups.length === 0) {
    const groupId = await putRecord<LinkGroup>('link_groups', { name: '常用', sort: 0 });
    const presets: Array<[string, string]> = [
      ['抖音', 'https://www.douyin.com'],
      ['哔哩哔哩', 'https://www.bilibili.com'],
      ['微博', 'https://weibo.com'],
      ['知乎', 'https://www.zhihu.com'],
      ['淘宝', 'https://www.taobao.com'],
      ['京东', 'https://www.jd.com'],
      ['百度', 'https://www.baidu.com'],
      ['微信读书', 'https://weread.qq.com'],
    ];
    for (let i = 0; i < presets.length; i++) {
      await putRecord<LinkItem>('links', {
        groupId,
        name: presets[i][0],
        url: presets[i][1],
        iconUrl: null,
        sort: i,
      });
    }
  }

  settings.seeded = true;
  await saveSettings(settings);
}
