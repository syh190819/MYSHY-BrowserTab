import { describe, it, expect } from 'vitest';
import { validateBackup } from '../src/utils/backup';

describe('backup', () => {
  it('合法备份通过校验', () => {
    const data = { version: 1, data: { notes: [{ id: 1, text: 'hi' }] } };
    expect(validateBackup(data)).toBe(true);
  });

  it('缺 version 或 data 被拒绝', () => {
    expect(validateBackup({ data: {} })).toBe(false);
    expect(validateBackup({ version: 1 })).toBe(false);
  });

  it('version 不是 1 被拒绝', () => {
    expect(validateBackup({ version: 2, data: {} })).toBe(false);
  });

  it('非对象被拒绝', () => {
    expect(validateBackup(null)).toBe(false);
    expect(validateBackup('x')).toBe(false);
    expect(validateBackup(123)).toBe(false);
  });
});
