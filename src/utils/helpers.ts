export function formatMoney(n: number): string {
  return `¥${n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function buildSearchUrl(template: string, query: string): string {
  return template.replace('{q}', encodeURIComponent(query));
}

export function bmi(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function faviconUrl(url: string): string {
  const host = hostOf(url);
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : '';
}

export function clampLevel(n: number): number {
  return Math.min(10, Math.max(1, n));
}
