import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  buildSearchUrl,
  bmi,
  hostOf,
  faviconUrl,
  todayStr,
} from '../src/utils/helpers';

describe('helpers', () => {
  it('formatMoney 保留两位小数', () => {
    expect(formatMoney(12.5)).toBe('¥12.50');
    expect(formatMoney(0)).toBe('¥0.00');
  });

  it('buildSearchUrl 对查询词编码', () => {
    expect(buildSearchUrl('https://www.baidu.com/s?wd={q}', 'hello world')).toBe(
      'https://www.baidu.com/s?wd=hello%20world',
    );
  });

  it('bmi 计算正确', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.857, 2);
  });

  it('hostOf 解析域名，非法 URL 返回空串', () => {
    expect(hostOf('https://www.bilibili.com/video/1')).toBe('www.bilibili.com');
    expect(hostOf('not-a-url')).toBe('');
  });

  it('faviconUrl 返回 google s2 服务地址，非法 URL 返回空串', () => {
    expect(faviconUrl('https://www.douyin.com/')).toBe(
      'https://www.google.com/s2/favicons?domain=www.douyin.com&sz=64',
    );
    expect(faviconUrl('bad')).toBe('');
  });

  it('todayStr 返回 YYYY-MM-DD 格式', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
