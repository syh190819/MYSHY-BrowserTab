import type { SearchEngine, WorkbenchSettings } from '../types';

const KEY = 'workbenchSettings';

export const DEFAULT_SETTINGS: WorkbenchSettings = {
  defaultEngine: 'baidu',
  engines: [
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={q}' },
    { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q={q}' },
    { id: 'google', name: '谷歌', url: 'https://www.google.com/search?q={q}' },
    { id: 'bilibili', name: 'B站', url: 'https://search.bilibili.com/all?keyword={q}' },
    { id: 'douyin', name: '抖音', url: 'https://www.douyin.com/search/{q}' },
    { id: 'zhihu', name: '知乎', url: 'https://www.zhihu.com/search?type=content&q={q}' },
    { id: 'taobao', name: '淘宝', url: 'https://s.taobao.com/search?q={q}' },
  ],
  heightCm: 170,
  goalWeightKg: 0,
  weightRemindEnabled: true,
  seeded: false,
};

interface KVBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

function backend(): KVBackend {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return {
      get: async (key) => {
        const obj = await chrome.storage.local.get(key);
        return obj[key];
      },
      set: async (key, value) => {
        await chrome.storage.local.set({ [key]: value });
      },
    };
  }
  return {
    get: async (key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : undefined;
    },
    set: async (key, value) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

export async function loadSettings(): Promise<WorkbenchSettings> {
  const saved = await backend().get(KEY);
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

export async function saveSettings(settings: WorkbenchSettings): Promise<void> {
  await backend().set(KEY, settings);
}

export function addEngine(engines: SearchEngine[], engine: SearchEngine): SearchEngine[] {
  return [...engines, engine];
}

export function removeEngine(engines: SearchEngine[], id: string): SearchEngine[] {
  return engines.filter((e) => e.id !== id);
}
