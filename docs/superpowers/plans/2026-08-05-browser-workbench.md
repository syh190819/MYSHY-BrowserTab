# 浏览器工作台实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个接管浏览器新标签页的工作台插件（搜索、快捷跳转、记账、便签、待办、体重、疼痛、食材、采购、菜谱联动），数据全部本地存储，构建产物可打包分享。

**Architecture:** Manifest V3 扩展通过 `chrome_url_overrides.newtab` 接管新标签页；前端为 Vite + React + TypeScript 单页应用，页面内用状态切换（不引入路由库）；业务数据存 IndexedDB（统一封装在 `src/db/`），轻量设置存 chrome.storage.local（无扩展环境时回退 localStorage）；所有图表用 recharts，图标抓取走 favicon 服务、失败回退首字母图标；无远程代码、无 CDN 依赖。

**Tech Stack:** Manifest V3 / Vite 5 / React 18 / TypeScript 5 / IndexedDB / chrome.storage.local / recharts / vitest + fake-indexeddb / jsdom

---

## 约定

- 本机 Windows + PowerShell。`npm install` 等写操作若被沙箱拦截，用 `require_escalated` 申请权限；`.git` 目录在沙箱中只读，所有 `git` 写命令需要申请权限执行。
- 中文注释允许，但代码标识符一律英文。
- 金额一律用"元"的 number 存储，展示用 `formatMoney`。
- 每个任务完成后提交一次 git，提交信息见各任务。
- 每个任务里的测试命令若无特殊说明，工作目录均为仓库根目录。

## 文件结构总览

```
浏览器工作台/
├─ docs/superpowers/specs/2026-08-05-browser-workbench-design.md   # 设计文档（已存在）
├─ docs/superpowers/plans/2026-08-05-browser-workbench.md          # 本实现计划
├─ public/
│  ├─ manifest.json
│  └─ icons/                 # icon16/48/128.png（由脚本生成）
├─ scripts/
│  └─ generate-icons.mjs
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ index.css
│  ├─ types/index.ts
│  ├─ db/
│  │  ├─ stores.ts
│  │  ├─ db.ts
│  │  ├─ settings.ts
│  │  └─ seed.ts
│  ├─ utils/
│  │  ├─ helpers.ts
│  │  ├─ stats.ts
│  │  ├─ backup.ts
│  │  └─ foodLinkage.ts
│  ├─ components/
│  │  ├─ SearchBar.tsx
│  │  ├─ FAB.tsx
│  │  ├─ Modal.tsx
│  │  ├─ ConfirmDialog.tsx
│  │  ├─ NumberField.tsx
│  │  └─ EmptyState.tsx
│  ├─ pages/
│  │  ├─ HomePage.tsx
│  │  ├─ AccountingPage.tsx
│  │  ├─ WeightPage.tsx
│  │  ├─ PainPage.tsx
│  │  ├─ IngredientsPage.tsx
│  │  ├─ RecipesPage.tsx
│  │  ├─ ShoppingPage.tsx
│  │  ├─ NotesPage.tsx
│  │  ├─ TodosPage.tsx
│  │  └─ SettingsPage.tsx
│  └─ test/setup.ts
├─ tests/                    # vitest 测试（与 src 平行，避免打进扩展）
│  ├─ db.test.ts
│  ├─ helpers.test.ts
│  ├─ stats.test.ts
│  ├─ backup.test.ts
│  └─ foodLinkage.test.ts
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ .gitignore
└─ README.md                 # 已存在，最后补充安装说明
```

---

## Phase 0：项目骨架

### Task 0.1: 初始化 Vite + React + TS 工程

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "browser-workbench",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.2",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.1",
    "typescript": "~5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 3: 创建 vite.config.ts**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
  },
});
```

- [ ] **Step 4: 创建 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>浏览器工作台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 创建 .gitignore**

```gitignore
node_modules/
dist/
*.local
.DS_Store
```

- [ ] **Step 6: 安装依赖并验证构建命令存在**

Run: `npm install`
Expected: 安装完成无报错。

Run: `npx vite --version`
Expected: 输出 vite 版本号（5.x）。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "chore: 初始化 Vite + React + TS 工程骨架"
```

### Task 0.2: 扩展清单与图标

**Files:**
- Create: `public/manifest.json`
- Create: `scripts/generate-icons.mjs`
- Create: `public/icons/icon16.png`
- Create: `public/icons/icon48.png`
- Create: `public/icons/icon128.png`

- [ ] **Step 1: 创建 public/manifest.json**

```json
{
  "manifest_version": 3,
  "name": "浏览器工作台",
  "version": "0.1.0",
  "description": "个人工作台新标签页：搜索、快捷跳转、记账、便签、待办、健康与饮食管理",
  "chrome_url_overrides": {
    "newtab": "index.html"
  },
  "permissions": ["storage"],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: 创建图标生成脚本 scripts/generate-icons.mjs**

```js
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(size, rgb) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const p = row + 1 + x * 4;
      raw[p] = rgb[0];
      raw[p + 1] = rgb[1];
      raw[p + 2] = rgb[2];
      raw[p + 3] = rgb[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const darkBlue = [26, 26, 46, 255];
mkdirSync('public/icons', { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(`public/icons/icon${size}.png`, makePng(size, darkBlue));
}
console.log('icons generated');
```

- [ ] **Step 3: 运行脚本生成图标**

Run: `node scripts/generate-icons.mjs`
Expected: 输出 `icons generated`，且 `public/icons/` 下出现三个 PNG。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 新增扩展清单与图标"
```

### Task 0.3: 应用入口与全局样式

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`

- [ ] **Step 1: 创建 src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 2: 创建 src/index.css**

```css
:root {
  --primary: #1a1a2e;
  --bg: #f4f5f7;
  --card: #ffffff;
  --text: #333333;
  --muted: #999999;
  --danger: #c0392b;
  --success: #1e8449;
  --accent: #3498db;
  --radius: 10px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}

.app-shell {
  max-width: 1100px;
  margin: 0 auto;
  padding: 12px 16px 90px;
}

.top-nav {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  background: var(--primary);
  padding: 8px 10px;
  border-radius: var(--radius);
  margin-bottom: 16px;
}

.nav-btn {
  background: transparent;
  color: #c9cadd;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.nav-btn.active {
  background: #ffffff;
  color: var(--primary);
  font-weight: 600;
}

.card {
  background: var(--card);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.card-title {
  font-size: 14px;
  color: #888888;
  margin: 0 0 10px;
}

.btn {
  background: var(--primary);
  color: #ffffff;
  border: none;
  padding: 7px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn:hover {
  opacity: 0.88;
}

.btn.secondary {
  background: #e9e9ee;
  color: var(--text);
}

.btn.danger {
  background: var(--danger);
}

.btn.small {
  padding: 4px 10px;
  font-size: 12px;
}

.input,
.select,
.textarea {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
}

.field {
  margin-bottom: 10px;
}

.field label {
  display: block;
  font-size: 12px;
  color: #888888;
  margin-bottom: 4px;
}

.row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.list-item:last-child {
  border-bottom: none;
}

.muted {
  color: var(--muted);
  font-size: 12px;
}

.danger-text {
  color: var(--danger);
}

.success-text {
  color: var(--success);
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-box {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  width: min(92vw, 480px);
  max-height: 86vh;
  overflow: auto;
}

.fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary);
  color: #ffffff;
  border: none;
  font-size: 26px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  z-index: 150;
}

.fab-menu {
  position: fixed;
  right: 28px;
  bottom: 92px;
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 160;
}

.fab-menu button {
  border: none;
  background: transparent;
  padding: 8px 18px;
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.fab-menu button:hover {
  background: #f0f0f4;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  background: #eef0f6;
  color: var(--primary);
}

.badge.danger {
  background: #fdecea;
  color: var(--danger);
}

.badge.success {
  background: #e8f6ec;
  color: var(--success);
}

.empty {
  text-align: center;
  color: #aaaaaa;
  padding: 24px 0;
  font-size: 13px;
}

@media (max-width: 768px) {
  .app-shell {
    padding: 8px 10px 90px;
  }

  .grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}
```

- [ ] **Step 3: 创建 src/App.tsx（临时占位版本，后续 Task 0.4 完成）**

```tsx
export default function App() {
  return (
    <div className="app-shell">
      <h1>浏览器工作台</h1>
      <p>骨架已就绪</p>
    </div>
  );
}
```

- [ ] **Step 4: 运行构建验证**

Run: `npm run build`
Expected: TypeScript 无报错，`dist/` 生成 index.html 与 JS/CSS 资源。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 应用入口与全局样式"
```

### Task 0.4: 页面导航骨架

**Files:**
- Create: `src/types/index.ts`（仅 PageId，完整类型在 Phase 1 补充）
- Modify: `src/App.tsx`
- Create: `src/pages/HomePage.tsx`（占位）
- Create: `src/pages/AccountingPage.tsx`（占位）
- Create: `src/pages/WeightPage.tsx`（占位）
- Create: `src/pages/PainPage.tsx`（占位）
- Create: `src/pages/IngredientsPage.tsx`（占位）
- Create: `src/pages/RecipesPage.tsx`（占位）
- Create: `src/pages/ShoppingPage.tsx`（占位）
- Create: `src/pages/NotesPage.tsx`（占位）
- Create: `src/pages/TodosPage.tsx`（占位）
- Create: `src/pages/SettingsPage.tsx`（占位）

- [ ] **Step 1: 创建 src/types/index.ts**

```ts
export type PageId =
  | 'home'
  | 'accounting'
  | 'weight'
  | 'pain'
  | 'ingredients'
  | 'recipes'
  | 'shopping'
  | 'notes'
  | 'todos'
  | 'settings';
```

- [ ] **Step 2: 创建 10 个占位页面（每个文件内容相同模板，文件名不同）**

以 `src/pages/HomePage.tsx` 为例，其余 9 个文件把函数名与文案换成对应页面名：

```tsx
export default function HomePage() {
  return <div className="card">工作台（开发中）</div>;
}
```

对应页面名：`AccountingPage` 记账、`WeightPage` 体重、`PainPage` 疼痛日记、`IngredientsPage` 食材、`RecipesPage` 菜谱、`ShoppingPage` 采购、`NotesPage` 便签、`TodosPage` 待办、`SettingsPage` 设置。

- [ ] **Step 3: 用完整导航替换 src/App.tsx**

```tsx
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { PageId } from './types';
import HomePage from './pages/HomePage';
import AccountingPage from './pages/AccountingPage';
import WeightPage from './pages/WeightPage';
import PainPage from './pages/PainPage';
import IngredientsPage from './pages/IngredientsPage';
import RecipesPage from './pages/RecipesPage';
import ShoppingPage from './pages/ShoppingPage';
import NotesPage from './pages/NotesPage';
import TodosPage from './pages/TodosPage';
import SettingsPage from './pages/SettingsPage';

const NAV: Array<{ id: PageId; label: string }> = [
  { id: 'home', label: '工作台' },
  { id: 'accounting', label: '记账' },
  { id: 'weight', label: '体重' },
  { id: 'pain', label: '疼痛' },
  { id: 'ingredients', label: '食材' },
  { id: 'recipes', label: '菜谱' },
  { id: 'shopping', label: '采购' },
  { id: 'notes', label: '便签' },
  { id: 'todos', label: '待办' },
  { id: 'settings', label: '设置' },
];

const PAGES: Record<PageId, ReactElement> = {
  home: <HomePage />,
  accounting: <AccountingPage />,
  weight: <WeightPage />,
  pain: <PainPage />,
  ingredients: <IngredientsPage />,
  recipes: <RecipesPage />,
  shopping: <ShoppingPage />,
  notes: <NotesPage />,
  todos: <TodosPage />,
  settings: <SettingsPage />,
};

export default function App() {
  const [page, setPage] = useState<PageId>('home');
  return (
    <div className="app-shell">
      <nav className="top-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={page === item.id ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main>{PAGES[page]}</main>
    </div>
  );
}
```

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 页面导航骨架"
```

---

## Phase 1：数据层与基础工具

### Task 1.1: 完整类型定义

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 用完整类型替换 src/types/index.ts**

```ts
export type PageId =
  | 'home'
  | 'accounting'
  | 'weight'
  | 'pain'
  | 'ingredients'
  | 'recipes'
  | 'shopping'
  | 'notes'
  | 'todos'
  | 'settings';

export interface ExpenseCategory {
  id?: number;
  name: string;
  type: 'income' | 'expense';
  sort: number;
  deletedAt: string | null;
}

export interface Expense {
  id?: number;
  type: 'income' | 'expense';
  amount: number;
  categoryId: number;
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface Budget {
  id?: number;
  month: string; // YYYY-MM
  categoryId: number | null; // null 表示总预算
  amount: number;
}

export interface Note {
  id?: number;
  text: string;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id?: number;
  title: string;
  dueDate: string | null; // YYYY-MM-DD
  done: boolean;
  createdAt: string;
}

export interface LinkGroup {
  id?: number;
  name: string;
  sort: number;
}

export interface LinkItem {
  id?: number;
  groupId: number;
  name: string;
  url: string;
  iconUrl: string | null;
  sort: number;
}

export interface WeightRecord {
  id?: number;
  date: string; // YYYY-MM-DD
  weightKg: number;
  note: string;
}

export interface PainEntry {
  id?: number;
  time: string; // YYYY-MM-DDTHH:mm
  part: string;
  level: number; // 1-10
  trigger: string;
  note: string;
}

export interface Ingredient {
  id?: number;
  name: string;
  quantity: number;
  unit: string;
  category: '蔬菜' | '肉蛋' | '调料' | '主食' | '其他';
  expiryDate: string | null; // YYYY-MM-DD
  updatedAt: string;
}

export interface ShoppingItem {
  id?: number;
  name: string;
  quantity: number;
  unit: string;
  done: boolean;
  source: 'manual' | 'recipe' | 'low_stock';
  createdAt: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id?: number;
  name: string;
  ingredients: RecipeIngredient[];
  steps: string;
  servings: number;
  createdAt: string;
}

export interface MealPlan {
  id?: number;
  date: string; // YYYY-MM-DD
  recipeId: number;
  status: 'planned' | 'cooked';
  cookedAt: string | null;
}

export interface SearchEngine {
  id: string;
  name: string;
  url: string; // 含 {q} 占位符
}

export interface WorkbenchSettings {
  defaultEngine: string;
  engines: SearchEngine[];
  heightCm: number;
  goalWeightKg: number;
  weightRemindEnabled: boolean;
  seeded: boolean;
}
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: 完整类型定义"
```

### Task 1.2: IndexedDB 封装

**Files:**
- Create: `src/db/stores.ts`
- Create: `src/db/db.ts`
- Create: `tests/db.test.ts`

- [ ] **Step 1: 写失败测试 tests/db.test.ts**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDB, getAll, putRecord, deleteRecord, clearStore, exportAll, importAll, resetDBForTests } from '../src/db/db';

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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- tests/db.test.ts`
Expected: FAIL，报错找不到模块 `../src/db/db`。

- [ ] **Step 3: 创建 src/db/stores.ts**

```ts
export const STORES = [
  'expense_categories',
  'expenses',
  'budgets',
  'notes',
  'todos',
  'link_groups',
  'links',
  'weight_records',
  'weight_settings',
  'pain_entries',
  'ingredients',
  'shopping_items',
  'recipes',
  'meal_plans',
  'settings',
] as const;

export type StoreName = (typeof STORES)[number];
```

- [ ] **Step 4: 创建 src/db/db.ts**

```ts
import { STORES } from './stores';

const DB_NAME = 'browser-workbench';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  return (await run(storeName, 'readonly', (s) => s.getAll())) as T[];
}

export async function putRecord<T>(storeName: string, record: T): Promise<number> {
  return (await run(storeName, 'readwrite', (s) => s.put(record))) as number;
}

export async function deleteRecord(storeName: string, id: number): Promise<void> {
  await run(storeName, 'readwrite', (s) => s.delete(id));
}

export async function clearStore(storeName: string): Promise<void> {
  await run(storeName, 'readwrite', (s) => s.clear());
}

export async function exportAll(): Promise<Record<string, unknown[]>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...STORES], 'readonly');
    const out: Record<string, unknown[]> = {};
    let remaining = STORES.length;
    tx.onerror = () => reject(tx.error);
    for (const name of STORES) {
      const req = tx.objectStore(name).getAll();
      req.onsuccess = () => {
        out[name] = req.result as unknown[];
        remaining -= 1;
        if (remaining === 0) resolve(out);
      };
      req.onerror = () => reject(req.error);
    }
  });
}

export async function importAll(data: Record<string, unknown[]>): Promise<void> {
  const db = await openDB();
  const names = Object.keys(data).filter((n) => (STORES as readonly string[]).includes(n));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    for (const name of names) {
      const store = tx.objectStore(name);
      store.clear();
      for (const record of data[name]) {
        store.put(record);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export function resetDBForTests(): void {
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => undefined);
    dbPromise = null;
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test:run -- tests/db.test.ts`
Expected: 4 个测试全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: IndexedDB 数据访问封装与测试"
```

### Task 1.3: 设置存储（chrome.storage.local + localStorage 回退）

**Files:**
- Create: `src/db/settings.ts`

- [ ] **Step 1: 创建 src/db/settings.ts**

```ts
import type { SearchEngine, WorkbenchSettings } from '../types';

const KEY = 'workbenchSettings';

export const DEFAULT_SETTINGS: WorkbenchSettings = {
  defaultEngine: 'baidu',
  engines: [
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={q}' },
    { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q={q}' },
    { id: 'google', name: '谷歌', url: 'https://www.google.com/search?q={q}' },
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
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: 设置存储层"
```

### Task 1.4: 默认数据种子

**Files:**
- Create: `src/db/seed.ts`
- Create: `tests/seed.test.ts`

- [ ] **Step 1: 写失败测试 tests/seed.test.ts**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDB, getAll, resetDBForTests } from '../src/db/db';
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- tests/seed.test.ts`
Expected: FAIL，找不到模块 `../src/db/seed`。

- [ ] **Step 3: 创建 src/db/seed.ts**

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:run -- tests/seed.test.ts`
Expected: 1 个测试 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 默认数据种子"
```

### Task 1.5: 通用工具函数

**Files:**
- Create: `src/utils/helpers.ts`
- Create: `tests/helpers.test.ts`

- [ ] **Step 1: 写失败测试 tests/helpers.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { formatMoney, buildSearchUrl, bmi, hostOf, faviconUrl, todayStr } from '../src/utils/helpers';

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
    expect(faviconUrl('https://www.douyin.com/')).toBe('https://www.google.com/s2/favicons?domain=www.douyin.com&sz=64');
    expect(faviconUrl('bad')).toBe('');
  });

  it('todayStr 返回 YYYY-MM-DD 格式', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- tests/helpers.test.ts`
Expected: FAIL，找不到模块 `../src/utils/helpers`。

- [ ] **Step 3: 创建 src/utils/helpers.ts**

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:run -- tests/helpers.test.ts`
Expected: 6 个测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 通用工具函数与测试"
```

### Task 1.6: 备份导出/导入工具

**Files:**
- Create: `src/utils/backup.ts`
- Create: `tests/backup.test.ts`

- [ ] **Step 1: 写失败测试 tests/backup.test.ts**

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- tests/backup.test.ts`
Expected: FAIL，找不到模块 `../src/utils/backup`。

- [ ] **Step 3: 创建 src/utils/backup.ts**

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:run -- tests/backup.test.ts`
Expected: 4 个测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 备份导出导入工具与测试"
```
---
## Phase 2：搜索与快捷跳转

### Task 2.1: 通用数组工具 moveItem（拖拽排序用）

**Files:**
- Create: `src/utils/array.ts`
- Create: `tests/array.test.ts`

- [ ] **Step 1: 写失败测试 tests/array.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { moveItem } from '../src/utils/array';

describe('moveItem', () => {
  it('把元素从 from 移到 to', () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3, 4], 3, 1)).toEqual([1, 4, 2, 3]);
  });

  it('from === to 时原样返回', () => {
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
  });

  it('越界时原样返回', () => {
    expect(moveItem([1, 2, 3], -1, 2)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 0, 9)).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- tests/array.test.ts`
Expected: FAIL，找不到模块 `../src/utils/array`。

- [ ] **Step 3: 创建 src/utils/array.ts**

```ts
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return arr;
  }
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:run -- tests/array.test.ts`
Expected: 3 个测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 数组拖拽排序工具与测试"
```

### Task 2.2: 搜索框组件

**Files:**
- Create: `src/components/SearchBar.tsx`

- [ ] **Step 1: 创建 src/components/SearchBar.tsx**

```tsx
import { useState } from 'react';
import type { SearchEngine } from '../types';
import { buildSearchUrl } from '../utils/helpers';

interface Props {
  engines: SearchEngine[];
  defaultEngine: string;
}

export default function SearchBar({ engines, defaultEngine }: Props) {
  const [engineId, setEngineId] = useState(defaultEngine);
  const [query, setQuery] = useState('');
  const engine = engines.find((e) => e.id === engineId) ?? engines[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || !engine) return;
    window.open(buildSearchUrl(engine.url, q), '_self');
  };

  return (
    <form className="card row" onSubmit={submit}>
      <select
        className="select"
        style={{ width: 110 }}
        value={engine?.id ?? ''}
        onChange={(e) => setEngineId(e.target.value)}
      >
        {engines.map((en) => (
          <option key={en.id} value={en.id}>
            {en.name}
          </option>
        ))}
      </select>
      <input
        className="input"
        style={{ flex: 1 }}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="输入关键词，回车或点搜索"
      />
      <button className="btn" type="submit">
        搜索
      </button>
    </form>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 搜索框组件"
```

### Task 2.3: 通用弹窗组件

**Files:**
- Create: `src/components/Modal.tsx`
- Create: `src/components/ConfirmDialog.tsx`
- Create: `src/components/EmptyState.tsx`

- [ ] **Step 1: 创建 src/components/Modal.tsx**

```tsx
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, title, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <strong>{title}</strong>
          <button className="btn small secondary" onClick={onClose}>
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 src/components/ConfirmDialog.tsx**

```tsx
interface Props {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({ open, title, message, onCancel, onConfirm }: Props) {
  if (!open) return null;
  return (
    <div className="modal-mask" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <strong>{title}</strong>
        <p>{message}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn small secondary" onClick={onCancel}>
            取消
          </button>
          <button className="btn small danger" onClick={onConfirm}>
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 src/components/EmptyState.tsx**

```tsx
export default function EmptyState({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
```

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 通用弹窗与空状态组件"
```

### Task 2.4: 快捷跳转区块（分组 + 链接增删改 + 拖拽排序 + 图标）

**Files:**
- Create: `src/components/LinksSection.tsx`

- [ ] **Step 1: 创建 src/components/LinksSection.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { LinkGroup, LinkItem } from '../types';
import { getAll, putRecord, deleteRecord } from '../db/db';
import { faviconUrl } from '../utils/helpers';
import { moveItem } from '../utils/array';
import Modal from './Modal';
import EmptyState from './EmptyState';

export default function LinksSection() {
  const [groups, setGroups] = useState<LinkGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LinkItem | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const loadGroups = async () => {
    const gs = (await getAll<LinkGroup>('link_groups')).sort((a, b) => a.sort - b.sort);
    setGroups(gs);
    setActiveGroupId((cur) => cur ?? gs[0]?.id ?? null);
  };

  const loadLinks = async (groupId: number) => {
    const all = await getAll<LinkItem>('links');
    setLinks(all.filter((l) => l.groupId === groupId).sort((a, b) => a.sort - b.sort));
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  useEffect(() => {
    if (activeGroupId != null) void loadLinks(activeGroupId);
  }, [activeGroupId, showForm]);

  const openNew = () => {
    setEditing(null);
    setName('');
    setUrl('');
    setShowForm(true);
  };

  const openEdit = (link: LinkItem) => {
    setEditing(link);
    setName(link.name);
    setUrl(link.url);
    setShowForm(true);
  };

  const save = async () => {
    if (!name.trim() || !url.trim() || activeGroupId == null) return;
    const normalized = url.includes('://') ? url : `https://${url}`;
    if (editing) {
      await putRecord<LinkItem>('links', { ...editing, name: name.trim(), url: normalized });
    } else {
      const maxSort = links.length ? Math.max(...links.map((l) => l.sort)) : -1;
      await putRecord<LinkItem>('links', {
        groupId: activeGroupId,
        name: name.trim(),
        url: normalized,
        iconUrl: null,
        sort: maxSort + 1,
      });
    }
    setShowForm(false);
    if (activeGroupId != null) await loadLinks(activeGroupId);
  };

  const remove = async (link: LinkItem) => {
    await deleteRecord('links', link.id!);
    if (activeGroupId != null) await loadLinks(activeGroupId);
  };

  const onDrop = async (toIndex: number) => {
    if (dragIndex == null || dragIndex === toIndex) return;
    const next = moveItem(links, dragIndex, toIndex);
    setLinks(next);
    for (let i = 0; i < next.length; i++) {
      await putRecord<LinkItem>('links', { ...next[i], sort: i });
    }
    setDragIndex(null);
  };

  const addGroup = async () => {
    const groupName = window.prompt('分组名称');
    if (!groupName?.trim()) return;
    const maxSort = groups.length ? Math.max(...groups.map((g) => g.sort)) : -1;
    const id = await putRecord<LinkGroup>('link_groups', { name: groupName.trim(), sort: maxSort + 1 });
    setActiveGroupId(id);
    await loadGroups();
  };

  const removeGroup = async (group: LinkGroup) => {
    if (!window.confirm(`删除分组「${group.name}」及其全部链接？`)) return;
    const all = await getAll<LinkItem>('links');
    for (const l of all.filter((x) => x.groupId === group.id)) {
      await deleteRecord('links', l.id!);
    }
    await deleteRecord('link_groups', group.id!);
    setActiveGroupId(null);
    await loadGroups();
  };

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="row">
          {groups.map((g) => (
            <button
              key={g.id}
              className="nav-btn"
              style={{
                background: activeGroupId === g.id ? '#eef0f6' : 'transparent',
                color: activeGroupId === g.id ? '#1a1a2e' : '#666666',
              }}
              onClick={() => setActiveGroupId(g.id!)}
            >
              {g.name}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn small secondary" onClick={addGroup}>
            新建分组
          </button>
          <button className="btn small" onClick={openNew}>
            添加网站
          </button>
        </div>
      </div>

      {activeGroup && (
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="muted">当前分组：{activeGroup.name}</span>
          <button className="btn small secondary" onClick={() => removeGroup(activeGroup)}>
            删除分组
          </button>
        </div>
      )}

      {links.length === 0 ? (
        <EmptyState text="这个分组还没有链接，点右上角「添加网站」" />
      ) : (
        <div className="grid">
          {links.map((link, index) => (
            <div
              key={link.id}
              className="card"
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void onDrop(index)}
              style={{ margin: 0, padding: 12, textAlign: 'center', cursor: 'grab' }}
            >
              <a href={link.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                {faviconUrl(link.url) ? (
                  <img
                    src={faviconUrl(link.url)}
                    alt={link.name}
                    width={40}
                    height={40}
                    style={{ borderRadius: 8 }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <div style={{ marginTop: 6, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {link.name}
                </div>
              </a>
              <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>
                <button className="btn small secondary" onClick={() => openEdit(link)}>
                  编辑
                </button>
                <button className="btn small danger" onClick={() => void remove(link)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} title={editing ? '编辑网站' : '添加网站'} onClose={() => setShowForm(false)}>
        <div className="field">
          <label>名称</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：GitHub" />
        </div>
        <div className="field">
          <label>网址</label>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="例如：github.com" />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => void save()}>
            保存
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

说明：图标先走 Google favicon 服务；`onError` 隐藏图片后由外层文字兜底，满足"抓取失败回退"要求。

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 快捷跳转分组与链接管理"
```

### Task 2.5: 首页 v1（搜索框 + 快捷跳转）

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: 替换 src/pages/HomePage.tsx**

```tsx
import { useEffect, useState } from 'react';
import SearchBar from '../components/SearchBar';
import LinksSection from '../components/LinksSection';
import { loadSettings } from '../db/settings';
import type { WorkbenchSettings } from '../types';

export default function HomePage() {
  const [settings, setSettings] = useState<WorkbenchSettings | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  return (
    <div>
      <SearchBar engines={settings.engines} defaultEngine={settings.defaultEngine} />
      <LinksSection />
      <div className="card">
        <div className="card-title">概览卡片将在后续阶段加入</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 首页 v1（搜索 + 快捷跳转）"
```---
## Phase 3：便签与待办

### Task 3.1: 排序工具 sorters

**Files:**
- Create: `src/utils/sorters.ts`
- Create: `tests/sorters.test.ts`

- [ ] **Step 1: 写失败测试 tests/sorters.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { sortNotes, sortTodos } from '../src/utils/sorters';
import type { Note, Todo } from '../src/types';

const baseTodo = (over: Partial<Todo>): Todo => ({
  id: 1,
  title: 'x',
  dueDate: null,
  done: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

const baseNote = (over: Partial<Note>): Note => ({
  id: 1,
  text: 'x',
  color: '#fff',
  pinned: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

describe('sorters', () => {
  it('sortTodos 未完成在前，按日期升序，无日期最后', () => {
    const todos = [
      baseTodo({ id: 1, done: true, dueDate: '2026-08-02' }),
      baseTodo({ id: 2, done: false, dueDate: '2026-08-03' }),
      baseTodo({ id: 3, done: false, dueDate: null }),
      baseTodo({ id: 4, done: false, dueDate: '2026-08-01' }),
    ];
    expect(sortTodos(todos).map((t) => t.id)).toEqual([4, 2, 3, 1]);
  });

  it('sortNotes 置顶在前，更新新的在前', () => {
    const notes = [
      baseNote({ id: 1, pinned: false, updatedAt: '2026-08-02T00:00:00.000Z' }),
      baseNote({ id: 2, pinned: true, updatedAt: '2026-08-01T00:00:00.000Z' }),
      baseNote({ id: 3, pinned: false, updatedAt: '2026-08-03T00:00:00.000Z' }),
    ];
    expect(sortNotes(notes).map((n) => n.id)).toEqual([2, 3, 1]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- tests/sorters.test.ts`
Expected: FAIL，找不到模块 `../src/utils/sorters`。

- [ ] **Step 3: 创建 src/utils/sorters.ts**

```ts
import type { Note, Todo } from '../types';

export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const da = a.dueDate ?? '9999-99-99';
    const db = b.dueDate ?? '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:run -- tests/sorters.test.ts`
Expected: 2 个测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 便签与待办排序工具及测试"
```

### Task 3.2: 便签页面

**Files:**
- Modify: `src/pages/NotesPage.tsx`

- [ ] **Step 1: 替换 src/pages/NotesPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { Note } from '../types';
import { getAll, putRecord, deleteRecord } from '../db/db';
import { sortNotes } from '../utils/sorters';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const COLORS = ['#fff9c4', '#ffebee', '#e8f5e9', '#e3f2fd', '#f3e5f5', '#ffffff'];

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [text, setText] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const load = async () => {
    const all = await getAll<Note>('notes');
    setNotes(sortNotes(all));
  };

  useEffect(() => {
    void load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setText('');
    setColor(COLORS[0]);
    setShowForm(true);
  };

  const openEdit = (n: Note) => {
    setEditing(n);
    setText(n.text);
    setColor(n.color);
    setShowForm(true);
  };

  const save = async () => {
    if (!text.trim()) return;
    const now = new Date().toISOString();
    if (editing) {
      await putRecord<Note>('notes', { ...editing, text: text.trim(), updatedAt: now });
    } else {
      await putRecord<Note>('notes', {
        text: text.trim(),
        color,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    setShowForm(false);
    await load();
  };

  const togglePin = async (n: Note) => {
    await putRecord<Note>('notes', { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() });
    await load();
  };

  const remove = async (n: Note) => {
    await deleteRecord('notes', n.id!);
    await load();
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>便签</h2>
        <button className="btn" onClick={openNew}>
          新建便签
        </button>
      </div>

      {notes.length === 0 ? (
        <EmptyState text="还没有便签，点「新建便签」记一条" />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {notes.map((n) => (
            <div key={n.id} className="card" style={{ background: n.color, margin: 0 }}>
              <div style={{ minHeight: 80, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{n.text}</div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <button className="btn small secondary" onClick={() => void togglePin(n)}>
                  {n.pinned ? '取消置顶' : '置顶'}
                </button>
                <div className="row">
                  <button className="btn small secondary" onClick={() => openEdit(n)}>
                    编辑
                  </button>
                  <button className="btn small danger" onClick={() => void remove(n)}>
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} title={editing ? '编辑便签' : '新建便签'} onClose={() => setShowForm(false)}>
        <div className="field">
          <label>内容</label>
          <textarea
            className="textarea"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="field">
          <label>颜色</label>
          <div className="row">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: c,
                  border: color === c ? '2px solid #1a1a2e' : '1px solid #ddd',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => void save()}>
            保存
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 便签页面"
```

### Task 3.3: 待办页面

**Files:**
- Modify: `src/pages/TodosPage.tsx`

- [ ] **Step 1: 替换 src/pages/TodosPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { Todo } from '../types';
import { getAll, putRecord, deleteRecord } from '../db/db';
import { sortTodos } from '../utils/sorters';
import { todayStr } from '../utils/helpers';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  const load = async () => {
    const all = await getAll<Todo>('todos');
    setTodos(sortTodos(all));
  };

  useEffect(() => {
    void load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setDueDate('');
    setShowForm(true);
  };

  const openEdit = (t: Todo) => {
    setEditing(t);
    setTitle(t.title);
    setDueDate(t.dueDate ?? '');
    setShowForm(true);
  };

  const save = async () => {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    if (editing) {
      await putRecord<Todo>('todos', { ...editing, title: title.trim(), dueDate: dueDate || null });
    } else {
      await putRecord<Todo>('todos', {
        title: title.trim(),
        dueDate: dueDate || null,
        done: false,
        createdAt: now,
      });
    }
    setShowForm(false);
    await load();
  };

  const toggleDone = async (t: Todo) => {
    await putRecord<Todo>('todos', { ...t, done: !t.done });
    await load();
  };

  const remove = async (t: Todo) => {
    await deleteRecord('todos', t.id!);
    await load();
  };

  const isOverdue = (t: Todo) => t.dueDate !== null && !t.done && t.dueDate < todayStr();

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>待办</h2>
        <button className="btn" onClick={openNew}>
          新建待办
        </button>
      </div>

      {todos.length === 0 ? (
        <EmptyState text="还没有待办" />
      ) : (
        todos.map((t) => (
          <div key={t.id} className="list-item">
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => void toggleDone(t)}
              style={{ width: 18, height: 18 }}
            />
            <span
              style={{
                flex: 1,
                textDecoration: t.done ? 'line-through' : 'none',
                color: t.done ? '#999999' : 'inherit',
              }}
            >
              {t.title}
            </span>
            {t.dueDate && (
              <span className={isOverdue(t) ? 'badge danger' : 'badge'}>{t.dueDate}</span>
            )}
            <button className="btn small secondary" onClick={() => openEdit(t)}>
              编辑
            </button>
            <button className="btn small danger" onClick={() => void remove(t)}>
              删除
            </button>
          </div>
        ))
      )}

      <Modal open={showForm} title={editing ? '编辑待办' : '新建待办'} onClose={() => setShowForm(false)}>
        <div className="field">
          <label>标题</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="要做什么" />
        </div>
        <div className="field">
          <label>日期（可选）</label>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => void save()}>
            保存
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 待办页面"
```

### Task 3.4: FAB 快速操作按钮

**Files:**
- Create: `src/components/FAB.tsx`

- [ ] **Step 1: 创建 src/components/FAB.tsx**

```tsx
import { useState } from 'react';
import type { PageId } from '../types';

interface Props {
  onNavigate: (page: PageId) => void;
}

const ACTIONS: Array<{ label: string; page: PageId }> = [
  { label: '记收入', page: 'accounting' },
  { label: '记支出', page: 'accounting' },
  { label: '新建便签', page: 'notes' },
  { label: '新建待办', page: 'todos' },
  { label: '添加网站', page: 'home' },
];

export default function FAB({ onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div className="fab-menu">
          {ACTIONS.map((a) => (
            <button key={a.label} onClick={() => { setOpen(false); onNavigate(a.page); }}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      <button className="fab" onClick={() => setOpen(!open)}>
        {open ? '×' : '+'}
      </button>
    </>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: FAB 快速操作按钮"
```

### Task 3.5: 首页 v2（待办/便签概览 + FAB + 导航接线）

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 替换 src/pages/HomePage.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { Note, PageId, Todo, WorkbenchSettings } from '../types';
import SearchBar from '../components/SearchBar';
import LinksSection from '../components/LinksSection';
import FAB from '../components/FAB';
import { loadSettings } from '../db/settings';
import { getAll } from '../db/db';
import { sortNotes, sortTodos } from '../utils/sorters';
import { todayStr } from '../utils/helpers';

interface Props {
  onNavigate: (page: PageId) => void;
}

export default function HomePage({ onNavigate }: Props) {
  const [settings, setSettings] = useState<WorkbenchSettings | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void getAll<Todo>('todos').then((all) => setTodos(sortTodos(all)));
    void getAll<Note>('notes').then((all) => setNotes(sortNotes(all).slice(0, 4)));
  }, []);

  if (!settings) return null;

  const openTodos = todos.filter((t) => !t.done);
  const todayDue = openTodos.filter((t) => t.dueDate === todayStr()).length;

  return (
    <div>
      <SearchBar engines={settings.engines} defaultEngine={settings.defaultEngine} />
      <LinksSection />
      <div className="grid">
        <div className="card">
          <div className="card-title">待办</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{openTodos.length} 项未完成</div>
          <div className="danger-text" style={{ fontSize: 12, margin: '4px 0 8px' }}>
            今天到期 {todayDue} 项
          </div>
          {openTodos.slice(0, 3).map((t) => (
            <div key={t.id} className="list-item">
              {t.title}
            </div>
          ))}
          <button className="btn small secondary" onClick={() => onNavigate('todos')}>
            去处理
          </button>
        </div>
        <div className="card">
          <div className="card-title">最近便签</div>
          {notes.length === 0 ? (
            <div className="muted">暂无便签</div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className="list-item"
                style={{ background: n.color, borderRadius: 6, padding: '6px 10px' }}
              >
                {n.text}
              </div>
            ))
          )}
          <button className="btn small secondary" onClick={() => onNavigate('notes')}>
            查看全部
          </button>
        </div>
      </div>
      <FAB onNavigate={onNavigate} />
    </div>
  );
}
```

- [ ] **Step 2: 修改 src/App.tsx，把 PAGES 移进组件内并给 HomePage 传 onNavigate**

```tsx
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { PageId } from './types';
import HomePage from './pages/HomePage';
import AccountingPage from './pages/AccountingPage';
import WeightPage from './pages/WeightPage';
import PainPage from './pages/PainPage';
import IngredientsPage from './pages/IngredientsPage';
import RecipesPage from './pages/RecipesPage';
import ShoppingPage from './pages/ShoppingPage';
import NotesPage from './pages/NotesPage';
import TodosPage from './pages/TodosPage';
import SettingsPage from './pages/SettingsPage';

const NAV: Array<{ id: PageId; label: string }> = [
  { id: 'home', label: '工作台' },
  { id: 'accounting', label: '记账' },
  { id: 'weight', label: '体重' },
  { id: 'pain', label: '疼痛' },
  { id: 'ingredients', label: '食材' },
  { id: 'recipes', label: '菜谱' },
  { id: 'shopping', label: '采购' },
  { id: 'notes', label: '便签' },
  { id: 'todos', label: '待办' },
  { id: 'settings', label: '设置' },
];

export default function App() {
  const [page, setPage] = useState<PageId>('home');
  const pages: Record<PageId, ReactElement> = {
    home: <HomePage onNavigate={setPage} />,
    accounting: <AccountingPage />,
    weight: <WeightPage />,
    pain: <PainPage />,
    ingredients: <IngredientsPage />,
    recipes: <RecipesPage />,
    shopping: <ShoppingPage />,
    notes: <NotesPage />,
    todos: <TodosPage />,
    settings: <SettingsPage />,
  };
  return (
    <div className="app-shell">
      <nav className="top-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={page === item.id ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main>{pages[page]}</main>
    </div>
  );
}
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 首页概览与 FAB 接线"
```---
## Phase 4：记账模块

### Task 4.1: 记账统计工具 stats

**Files:**
- Create: `src/utils/stats.ts`
- Create: `tests/stats.test.ts`

- [ ] **Step 1: 写失败测试 tests/stats.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { summarizeMonth, monthlyTotals, categoryTotals, budgetVsActual } from '../src/utils/stats';
import type { Budget, Expense, ExpenseCategory } from '../src/types';

const cat = (id: number, name: string, type: 'income' | 'expense'): ExpenseCategory => ({
  id,
  name,
  type,
  sort: 0,
  deletedAt: null,
});

const exp = (over: Partial<Expense>): Expense => ({
  id: 1,
  type: 'expense',
  amount: 10,
  categoryId: 1,
  date: '2026-08-01',
  note: '',
  createdAt: '2026-08-01T00:00:00.000Z',
  deletedAt: null,
  ...over,
});

describe('stats', () => {
  it('summarizeMonth 汇总当月收支', () => {
    const expenses = [
      exp({ type: 'expense', amount: 30, date: '2026-08-05' }),
      exp({ type: 'income', amount: 100, date: '2026-08-02' }),
      exp({ type: 'expense', amount: 20, date: '2026-07-31' }),
    ];
    expect(summarizeMonth(expenses, '2026-08')).toEqual({ income: 100, expense: 50 });
  });

  it('monthlyTotals 输出全年 12 个月', () => {
    const expenses = [
      exp({ type: 'expense', amount: 10, date: '2026-03-15' }),
      exp({ type: 'income', amount: 999, date: '2026-03-15' }),
    ];
    const result = monthlyTotals(expenses, 2026);
    expect(result).toHaveLength(12);
    expect(result[2]).toEqual({ month: '2026-03', total: 10 });
    expect(result[0]).toEqual({ month: '2026-01', total: 0 });
  });

  it('categoryTotals 只统计支出并排序', () => {
    const categories = [cat(1, '餐饮', 'expense'), cat(2, '购物', 'expense'), cat(3, '工资', 'income')];
    const expenses = [
      exp({ categoryId: 1, amount: 20 }),
      exp({ categoryId: 2, amount: 50 }),
      exp({ categoryId: 3, amount: 999, type: 'income' }),
    ];
    expect(categoryTotals(expenses, categories)).toEqual([
      { category: '购物', total: 50 },
      { category: '餐饮', total: 20 },
    ]);
  });

  it('budgetVsActual 输出预算与当月实际', () => {
    const budgets: Budget[] = [
      { id: 1, month: '2026-08', categoryId: null, amount: 1000 },
      { id: 2, month: '2026-08', categoryId: 1, amount: 300 },
    ];
    const categories = [cat(1, '餐饮', 'expense')];
    const expenses = [
      exp({ categoryId: 1, amount: 80, date: '2026-08-03' }),
      exp({ categoryId: 2, amount: 50, date: '2026-08-03' }),
      exp({ categoryId: 1, amount: 80, date: '2026-09-03' }),
    ];
    expect(budgetVsActual(budgets, expenses, categories, '2026-08')).toEqual([
      { category: '总预算', budget: 1000, actual: 130 },
      { category: '餐饮', budget: 300, actual: 80 },
    ]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- tests/stats.test.ts`
Expected: FAIL，找不到模块 `../src/utils/stats`。

- [ ] **Step 3: 创建 src/utils/stats.ts**

```ts
import type { Budget, Expense, ExpenseCategory } from '../types';

export interface MonthSummary {
  income: number;
  expense: number;
}

export function summarizeMonth(expenses: Expense[], month: string): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const e of expenses) {
    if (!e.date.startsWith(month)) continue;
    if (e.type === 'income') income += e.amount;
    else expense += e.amount;
  }
  return { income, expense };
}

export function monthlyTotals(expenses: Expense[], year: number): Array<{ month: string; total: number }> {
  const map = new Map<string, number>();
  for (const e of expenses) {
    if (e.type !== 'expense' || !e.date.startsWith(String(year))) continue;
    const key = e.date.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + e.amount);
  }
  const out: Array<{ month: string; total: number }> = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    out.push({ month: key, total: map.get(key) ?? 0 });
  }
  return out;
}

export function categoryTotals(
  expenses: Expense[],
  categories: ExpenseCategory[],
): Array<{ category: string; total: number }> {
  const map = new Map<number, number>();
  for (const e of expenses) {
    if (e.type !== 'expense') continue;
    map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.amount);
  }
  return categories
    .filter((c) => c.type === 'expense' && !c.deletedAt)
    .map((c) => ({ category: c.name, total: map.get(c.id!) ?? 0 }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function budgetVsActual(
  budgets: Budget[],
  expenses: Expense[],
  categories: ExpenseCategory[],
  month: string,
): Array<{ category: string; budget: number; actual: number }> {
  const actualMap = new Map<number | null, number>();
  for (const e of expenses) {
    if (e.type !== 'expense' || !e.date.startsWith(month)) continue;
    actualMap.set(e.categoryId, (actualMap.get(e.categoryId) ?? 0) + e.amount);
  }
  return budgets
    .filter((b) => b.month === month)
    .map((b) => ({
      category:
        b.categoryId === null
          ? '总预算'
          : (categories.find((c) => c.id === b.categoryId)?.name ?? '未知分类'),
      budget: b.amount,
      actual: actualMap.get(b.categoryId) ?? 0,
    }));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:run -- tests/stats.test.ts`
Expected: 4 个测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 记账统计工具与测试"
```

### Task 4.2: 记账表单与明细列表组件

**Files:**
- Create: `src/components/accounting/ExpenseForm.tsx`
- Create: `src/components/accounting/HistoryPanel.tsx`

- [ ] **Step 1: 创建 src/components/accounting/ExpenseForm.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { Expense, ExpenseCategory } from '../../types';
import { todayStr } from '../../utils/helpers';

interface Props {
  categories: ExpenseCategory[];
  initial: Expense | null;
  onSave: (data: {
    type: 'income' | 'expense';
    amount: number;
    categoryId: number;
    date: string;
    note: string;
  }) => Promise<void>;
  onCancelEdit: () => void;
}

export default function ExpenseForm({ categories, initial, onSave, onCancelEdit }: Props) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (initial) {
      setType(initial.type);
      setAmount(String(initial.amount));
      setCategoryId(initial.categoryId);
      setDate(initial.date);
      setNote(initial.note);
    } else {
      setType('expense');
      setAmount('');
      setCategoryId('');
      setDate(todayStr());
      setNote('');
    }
  }, [initial]);

  const list = categories.filter((c) => c.type === type && !c.deletedAt);

  const submit = async () => {
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      window.alert('请输入有效金额');
      return;
    }
    if (categoryId === '') {
      window.alert('请选择分类');
      return;
    }
    await onSave({ type, amount: value, categoryId, date, note: note.trim() });
    if (!initial) {
      setAmount('');
      setCategoryId('');
      setNote('');
    }
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="card-title" style={{ margin: 0 }}>
          {initial ? '编辑记录' : '记一笔'}
        </div>
        {initial && (
          <button className="btn small secondary" onClick={onCancelEdit}>
            取消编辑
          </button>
        )}
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <button
          className={type === 'expense' ? 'btn small' : 'btn small secondary'}
          onClick={() => setType('expense')}
        >
          支出
        </button>
        <button
          className={type === 'income' ? 'btn small' : 'btn small secondary'}
          onClick={() => setType('income')}
        >
          收入
        </button>
      </div>
      <div className="field">
        <label>金额（元）</label>
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="field">
        <label>分类</label>
        <select
          className="select"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">请选择</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>日期</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>备注</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button className="btn" onClick={() => void submit()}>
        保存
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 创建 src/components/accounting/HistoryPanel.tsx**

```tsx
import type { Expense, ExpenseCategory } from '../../types';
import { formatMoney } from '../../utils/helpers';
import EmptyState from '../EmptyState';

interface Props {
  expenses: Expense[];
  categories: ExpenseCategory[];
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}

export default function HistoryPanel({ expenses, categories, onEdit, onDelete }: Props) {
  if (expenses.length === 0) return <EmptyState text="本月还没有记录" />;
  const nameOf = (id: number) => categories.find((c) => c.id === id)?.name ?? '未分类';
  const sorted = [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div>
      {sorted.map((e) => (
        <div key={e.id} className="list-item">
          <span style={{ flex: 1 }}>
            {nameOf(e.categoryId)} · {e.note || '无备注'}
            <span className="muted"> · {e.date}</span>
          </span>
          <span style={{ color: e.type === 'income' ? 'var(--success)' : 'inherit', fontWeight: 600 }}>
            {e.type === 'income' ? '+' : '-'}
            {formatMoney(e.amount)}
          </span>
          <button className="btn small secondary" onClick={() => onEdit(e)}>
            编辑
          </button>
          <button className="btn small danger" onClick={() => onDelete(e)}>
            删除
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 记账表单与明细组件"
```

### Task 4.3: 分类管理与预算设置组件

**Files:**
- Create: `src/components/accounting/CategoryManager.tsx`
- Create: `src/components/accounting/BudgetManager.tsx`

- [ ] **Step 1: 创建 src/components/accounting/CategoryManager.tsx**

```tsx
import { useState } from 'react';
import type { ExpenseCategory } from '../../types';
import Modal from '../Modal';

interface Props {
  categories: ExpenseCategory[];
  onAdd: (name: string, type: 'income' | 'expense') => Promise<void>;
  onRename: (c: ExpenseCategory, name: string) => Promise<void>;
  onDelete: (c: ExpenseCategory) => Promise<void>;
  onClose: () => void;
}

export default function CategoryManager({ categories, onAdd, onRename, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [editName, setEditName] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    await onAdd(name.trim(), type);
    setName('');
  };

  const saveEdit = async () => {
    if (editing && editName.trim()) {
      await onRename(editing, editName.trim());
      setEditing(null);
    }
  };

  const list = (t: 'income' | 'expense') => categories.filter((c) => c.type === t && !c.deletedAt);

  const renderRow = (c: ExpenseCategory) => (
    <div key={c.id} className="list-item">
      {editing?.id === c.id ? (
        <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
      ) : (
        <span style={{ flex: 1 }}>{c.name}</span>
      )}
      {editing?.id === c.id ? (
        <button className="btn small" onClick={() => void saveEdit()}>
          保存
        </button>
      ) : (
        <button
          className="btn small secondary"
          onClick={() => {
            setEditing(c);
            setEditName(c.name);
          }}
        >
          重命名
        </button>
      )}
      <button className="btn small danger" onClick={() => void onDelete(c)}>
        删除
      </button>
    </div>
  );

  return (
    <Modal open title="分类管理" onClose={onClose}>
      <div className="field">
        <label>新分类名称</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <button
          className={type === 'expense' ? 'btn small' : 'btn small secondary'}
          onClick={() => setType('expense')}
        >
          支出
        </button>
        <button
          className={type === 'income' ? 'btn small' : 'btn small secondary'}
          onClick={() => setType('income')}
        >
          收入
        </button>
      </div>
      <button className="btn small" onClick={() => void add()}>
        添加
      </button>

      <h4 style={{ margin: '16px 0 6px' }}>支出分类</h4>
      {list('expense').map(renderRow)}

      <h4 style={{ margin: '16px 0 6px' }}>收入分类</h4>
      {list('income').map(renderRow)}
    </Modal>
  );
}
```

- [ ] **Step 2: 创建 src/components/accounting/BudgetManager.tsx**

```tsx
import { useState } from 'react';
import type { Budget, ExpenseCategory } from '../../types';
import { formatMoney } from '../../utils/helpers';
import Modal from '../Modal';

interface Props {
  budgets: Budget[];
  categories: ExpenseCategory[];
  month: string;
  onSave: (budget: Omit<Budget, 'id'>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
}

export default function BudgetManager({ budgets, categories, month, onSave, onDelete, onClose }: Props) {
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');

  const save = async () => {
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value < 0) return;
    await onSave({ month, categoryId: categoryId === '' ? null : categoryId, amount: value });
    setAmount('');
    setCategoryId('');
  };

  const list = budgets.filter((b) => b.month === month);

  return (
    <Modal open title={`${month} 预算`} onClose={onClose}>
      <div className="field">
        <label>分类（留空为总预算）</label>
        <select
          className="select"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">总预算</option>
          {categories
            .filter((c) => c.type === 'expense' && !c.deletedAt)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>
      <div className="field">
        <label>金额（元）</label>
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <button className="btn" onClick={() => void save()}>
        添加预算
      </button>

      <h4 style={{ margin: '16px 0 6px' }}>本月预算</h4>
      {list.length === 0 ? (
        <div className="muted">尚未设置预算</div>
      ) : (
        list.map((b) => (
          <div key={b.id} className="list-item">
            <span style={{ flex: 1 }}>
              {b.categoryId === null
                ? '总预算'
                : (categories.find((c) => c.id === b.categoryId)?.name ?? '未知分类')}
            </span>
            <span>{formatMoney(b.amount)}</span>
            <button className="btn small danger" onClick={() => void onDelete(b.id!)}>
              删除
            </button>
          </div>
        ))
      )}
    </Modal>
  );
}
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 分类管理与预算设置组件"
```

### Task 4.4: 统计图表组件

**Files:**
- Create: `src/components/accounting/StatsSection.tsx`

- [ ] **Step 1: 创建 src/components/accounting/StatsSection.tsx**

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import type { Budget, Expense, ExpenseCategory } from '../../types';
import { budgetVsActual, categoryTotals, monthlyTotals } from '../../utils/stats';
import { formatMoney } from '../../utils/helpers';

const COLORS = ['#1a1a2e', '#27ae60', '#c0392b', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];

interface Props {
  expenses: Expense[];
  categories: ExpenseCategory[];
  budgets: Budget[];
  month: string;
}

export default function StatsSection({ expenses, categories, budgets, month }: Props) {
  const year = Number(month.slice(0, 4));
  const trend = monthlyTotals(expenses, year);
  const pie = categoryTotals(expenses, categories);
  const bar = budgetVsActual(budgets, expenses, categories, month);

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className="card">
        <div className="card-title">月度支出趋势（{year}）</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v: number) => `¥${v}`} tick={{ fontSize: 12 }} width={70} />
            <Tooltip formatter={(value) => [formatMoney(Number(value)), '支出']} />
            <Line type="monotone" dataKey="total" stroke="#3498db" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-title">分类支出分布（{month}）</div>
        {pie.length === 0 ? (
          <div className="empty">暂无数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pie}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {pie.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [formatMoney(Number(value)), '支出']} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-title">预算 vs 实际（{month}）</div>
        {bar.length === 0 ? (
          <div className="empty">暂无预算数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bar}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={70} />
              <Tooltip formatter={(value, name) => [formatMoney(Number(value)), name === 'budget' ? '预算' : '实际']} />
              <Legend formatter={(v: string) => (v === 'budget' ? '预算' : '实际')} />
              <Bar dataKey="budget" fill="#3498db" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="#e74c3c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错（recharts 类型在 strict 模式下若提示 formatter 参数类型，可将 `(value)` 标注为 `(value: number | string)`）。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 记账统计图表组件"
```

### Task 4.5: 记账页面（组合表单、明细、分类、预算、图表）

**Files:**
- Modify: `src/pages/AccountingPage.tsx`

- [ ] **Step 1: 替换 src/pages/AccountingPage.tsx**

```tsx
import { useCallback, useEffect, useState } from 'react';
import type { Budget, Expense, ExpenseCategory } from '../types';
import { getAll, putRecord, deleteRecord } from '../db/db';
import { monthStr, formatMoney } from '../utils/helpers';
import { summarizeMonth } from '../utils/stats';
import ExpenseForm from '../components/accounting/ExpenseForm';
import HistoryPanel from '../components/accounting/HistoryPanel';
import CategoryManager from '../components/accounting/CategoryManager';
import BudgetManager from '../components/accounting/BudgetManager';
import StatsSection from '../components/accounting/StatsSection';

export default function AccountingPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [month, setMonth] = useState(monthStr());
  const [showCategories, setShowCategories] = useState(false);
  const [showBudgets, setShowBudgets] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const load = useCallback(async () => {
    setCategories(await getAll<ExpenseCategory>('expense_categories'));
    setExpenses(await getAll<Expense>('expenses'));
    setBudgets(await getAll<Budget>('budgets'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveExpense = async (data: {
    type: 'income' | 'expense';
    amount: number;
    categoryId: number;
    date: string;
    note: string;
  }) => {
    if (editing) {
      await putRecord<Expense>('expenses', { ...editing, ...data });
    } else {
      await putRecord<Expense>('expenses', {
        ...data,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      });
    }
    setEditing(null);
    await load();
  };

  const deleteExpense = async (e: Expense) => {
    await putRecord<Expense>('expenses', { ...e, deletedAt: new Date().toISOString() });
    await load();
  };

  const addCategory = async (name: string, type: 'income' | 'expense') => {
    const maxSort = categories
      .filter((c) => c.type === type)
      .reduce((m, c) => Math.max(m, c.sort), -1);
    await putRecord<ExpenseCategory>('expense_categories', { name, type, sort: maxSort + 1, deletedAt: null });
    await load();
  };

  const renameCategory = async (c: ExpenseCategory, name: string) => {
    await putRecord<ExpenseCategory>('expense_categories', { ...c, name });
    await load();
  };

  const deleteCategory = async (c: ExpenseCategory) => {
    await putRecord<ExpenseCategory>('expense_categories', { ...c, deletedAt: new Date().toISOString() });
    await load();
  };

  const saveBudget = async (b: Omit<Budget, 'id'>) => {
    await putRecord<Budget>('budgets', b);
    await load();
  };

  const deleteBudget = async (id: number) => {
    await deleteRecord('budgets', id);
    await load();
  };

  const monthExpenses = expenses.filter((e) => e.date.startsWith(month) && !e.deletedAt);
  const summary = summarizeMonth(monthExpenses, month);
  const totalBudget = budgets.find((b) => b.month === month && b.categoryId === null)?.amount ?? 0;
  const budgetPercent = totalBudget > 0 ? Math.min(100, Math.round((summary.expense / totalBudget) * 100)) : 0;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>记账</h2>
        <div className="row">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input"
            style={{ width: 150 }}
          />
          <button className="btn small secondary" onClick={() => setShowCategories(true)}>
            分类管理
          </button>
          <button className="btn small secondary" onClick={() => setShowBudgets(true)}>
            预算设置
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 12 }}>
        <div className="card">
          <div className="card-title">本月收入</div>
          <div className="success-text" style={{ fontSize: 24, fontWeight: 700 }}>
            {formatMoney(summary.income)}
          </div>
        </div>
        <div className="card">
          <div className="card-title">本月支出</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatMoney(summary.expense)}</div>
        </div>
        <div className="card">
          <div className="card-title">预算使用</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{budgetPercent}%</div>
          <div className="muted">预算 {formatMoney(totalBudget)}</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <ExpenseForm
          categories={categories}
          initial={editing}
          onSave={saveExpense}
          onCancelEdit={() => setEditing(null)}
        />
        <div className="card">
          <div className="card-title">本月明细</div>
          <HistoryPanel
            expenses={monthExpenses}
            categories={categories}
            onEdit={setEditing}
            onDelete={(e) => void deleteExpense(e)}
          />
        </div>
      </div>

      <StatsSection expenses={monthExpenses} categories={categories} budgets={budgets} month={month} />

      <CategoryManager
        categories={categories}
        onAdd={addCategory}
        onRename={renameCategory}
        onDelete={deleteCategory}
        onClose={() => setShowCategories(false)}
      />
      <BudgetManager
        budgets={budgets}
        categories={categories}
        month={month}
        onSave={saveBudget}
        onDelete={deleteBudget}
        onClose={() => setShowBudgets(false)}
      />
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 记账页面"
```

### Task 4.6: 首页加入本月收支概览卡

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: 修改 HomePage：加载记账数据并展示收支卡**

在 `src/pages/HomePage.tsx` 中：
- 引入 `monthStr`、`formatMoney`、`summarizeMonth`、`getAll`、类型 `Expense`、`ExpenseCategory`；
- state 增加 `expenses`、`categories`；
- `useEffect` 中加载 `expenses`、`expense_categories`；
- 在"最近便签"卡片前增加"本月收支"卡片。

完整文件：

```tsx
import { useEffect, useState } from 'react';
import type { Expense, ExpenseCategory, Note, PageId, Todo, WorkbenchSettings } from '../types';
import SearchBar from '../components/SearchBar';
import LinksSection from '../components/LinksSection';
import FAB from '../components/FAB';
import { loadSettings } from '../db/settings';
import { getAll } from '../db/db';
import { sortNotes, sortTodos } from '../utils/sorters';
import { todayStr, monthStr, formatMoney } from '../utils/helpers';
import { summarizeMonth } from '../utils/stats';

interface Props {
  onNavigate: (page: PageId) => void;
}

export default function HomePage({ onNavigate }: Props) {
  const [settings, setSettings] = useState<WorkbenchSettings | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void getAll<Todo>('todos').then((all) => setTodos(sortTodos(all)));
    void getAll<Note>('notes').then((all) => setNotes(sortNotes(all).slice(0, 4)));
    void getAll<Expense>('expenses').then(setExpenses);
    void getAll<ExpenseCategory>('expense_categories').then(setCategories);
  }, []);

  if (!settings) return null;

  const openTodos = todos.filter((t) => !t.done);
  const todayDue = openTodos.filter((t) => t.dueDate === todayStr()).length;
  const month = monthStr();
  const summary = summarizeMonth(expenses.filter((e) => !e.deletedAt), month);

  return (
    <div>
      <SearchBar engines={settings.engines} defaultEngine={settings.defaultEngine} />
      <LinksSection />
      <div className="grid">
        <div className="card">
          <div className="card-title">本月收支</div>
          <div className="row">
            <div>
              <div className="muted">收入</div>
              <div className="success-text" style={{ fontSize: 20, fontWeight: 700 }}>
                {formatMoney(summary.income)}
              </div>
            </div>
            <div>
              <div className="muted">支出</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(summary.expense)}</div>
            </div>
          </div>
          <button className="btn small secondary" onClick={() => onNavigate('accounting')}>
            去记账
          </button>
        </div>
        <div className="card">
          <div className="card-title">待办</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{openTodos.length} 项未完成</div>
          <div className="danger-text" style={{ fontSize: 12, margin: '4px 0 8px' }}>
            今天到期 {todayDue} 项
          </div>
          {openTodos.slice(0, 3).map((t) => (
            <div key={t.id} className="list-item">
              {t.title}
            </div>
          ))}
          <button className="btn small secondary" onClick={() => onNavigate('todos')}>
            去处理
          </button>
        </div>
        <div className="card">
          <div className="card-title">最近便签</div>
          {notes.length === 0 ? (
            <div className="muted">暂无便签</div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className="list-item"
                style={{ background: n.color, borderRadius: 6, padding: '6px 10px' }}
              >
                {n.text}
              </div>
            ))
          )}
          <button className="btn small secondary" onClick={() => onNavigate('notes')}>
            查看全部
          </button>
        </div>
      </div>
      <FAB onNavigate={onNavigate} />
    </div>
  );
}```
- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 首页本月收支概览"
```---
## Phase 5：体重管理与疼痛日记

### Task 5.1: 体重管理页面

**Files:**
- Modify: `src/pages/WeightPage.tsx`

- [ ] **Step 1: 替换 src/pages/WeightPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { WeightRecord, WorkbenchSettings } from '../types';
import { getAll, putRecord, deleteRecord } from '../db/db';
import { loadSettings, saveSettings } from '../db/settings';
import { todayStr, bmi } from '../utils/helpers';
import EmptyState from '../components/EmptyState';

export default function WeightPage() {
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [settings, setSettings] = useState<WorkbenchSettings | null>(null);
  const [date, setDate] = useState(todayStr());
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [goal, setGoal] = useState('');
  const [height, setHeight] = useState('');
  const [remind, setRemind] = useState(true);

  const load = async () => {
    const all = await getAll<WeightRecord>('weight_records');
    setRecords([...all].sort((a, b) => (a.date < b.date ? -1 : 1)));
    const s = await loadSettings();
    setSettings(s);
    setGoal(s.goalWeightKg ? String(s.goalWeightKg) : '');
    setHeight(String(s.heightCm));
    setRemind(s.weightRemindEnabled);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    const value = Number(weight);
    if (!weight || !Number.isFinite(value) || value <= 0) {
      window.alert('请输入有效体重');
      return;
    }
    const exists = records.find((r) => r.date === date);
    if (exists) {
      await putRecord<WeightRecord>('weight_records', { ...exists, weightKg: value, note: note.trim() });
    } else {
      await putRecord<WeightRecord>('weight_records', { date, weightKg: value, note: note.trim() });
    }
    setWeight('');
    setNote('');
    await load();
  };

  const saveSettingsRow = async () => {
    if (!settings) return;
    const next: WorkbenchSettings = {
      ...settings,
      goalWeightKg: goal ? Number(goal) : 0,
      heightCm: height ? Number(height) : 170,
      weightRemindEnabled: remind,
    };
    await saveSettings(next);
    setSettings(next);
    window.alert('已保存');
  };

  const remove = async (r: WeightRecord) => {
    await deleteRecord('weight_records', r.id!);
    await load();
  };

  const latest = records[records.length - 1];
  const todayRecorded = records.some((r) => r.date === todayStr());
  const chartData = records.map((r) => ({ date: r.date.slice(5), kg: r.weightKg }));
  const goalKg = settings?.goalWeightKg ?? 0;

  return (
    <div>
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>体重管理</h2>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 2fr' }}>
        <div className="card">
          <div className="card-title">记录体重</div>
          <div className="field">
            <label>日期</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>体重（kg）</label>
            <input
              className="input"
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="例如 65.5"
            />
          </div>
          <div className="field">
            <label>备注</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="btn" onClick={() => void save()}>
            保存
          </button>
        </div>

        <div className="card">
          <div className="card-title">目标与提醒</div>
          <div className="field">
            <label>目标体重（kg，0 表示不设）</label>
            <input className="input" type="number" step="0.1" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div className="field">
            <label>身高（cm，用于 BMI）</label>
            <input className="input" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <label className="row" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
            首页提醒：当天未记录时提示
          </label>
          <button className="btn small" onClick={() => void saveSettingsRow()}>
            保存设置
          </button>
          <div className="muted" style={{ marginTop: 10 }}>
            {latest
              ? `最新：${latest.weightKg.toFixed(1)} kg（${latest.date}）`
              : '还没有记录'}
          </div>
          {latest && settings && settings.heightCm > 0 && (
            <div className="muted">BMI：{bmi(latest.weightKg, settings.heightCm).toFixed(1)}</div>
          )}
          {remind && !todayRecorded && (
            <div className="danger-text" style={{ marginTop: 8 }}>
              今天还没记录体重
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">体重趋势</div>
          {chartData.length < 2 ? (
            <EmptyState text="记录两次以上即可查看趋势" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={50} />
                <Tooltip />
                {goalKg > 0 && (
                  <ReferenceLine y={goalKg} stroke="#c0392b" strokeDasharray="4 4" label="目标" />
                )}
                <Line type="monotone" dataKey="kg" stroke="#1a1a2e" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">历史记录</div>
        {records.length === 0 ? (
          <EmptyState text="还没有体重记录" />
        ) : (
          [...records].reverse().map((r) => (
            <div key={r.id} className="list-item">
              <span style={{ flex: 1 }}>
                {r.date} · {r.weightKg.toFixed(1)} kg
                {r.note ? ` · ${r.note}` : ''}
              </span>
              <button className="btn small danger" onClick={() => void remove(r)}>
                删除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 体重管理页面"
```

### Task 5.2: 疼痛日记页面

**Files:**
- Modify: `src/pages/PainPage.tsx`

- [ ] **Step 1: 替换 src/pages/PainPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { PainEntry } from '../types';
import { getAll, putRecord, deleteRecord } from '../db/db';
import { clampLevel } from '../utils/helpers';
import EmptyState from '../components/EmptyState';

const PARTS = ['头部', '颈部', '肩部', '背部', '腰部', '手臂', '腿部', '膝盖', '腹部', '其他'];

export default function PainPage() {
  const [entries, setEntries] = useState<PainEntry[]>([]);
  const [time, setTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [part, setPart] = useState(PARTS[0]);
  const [level, setLevel] = useState(5);
  const [trigger, setTrigger] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    const all = await getAll<PainEntry>('pain_entries');
    setEntries([...all].sort((a, b) => (a.time < b.time ? 1 : -1)));
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    await putRecord<PainEntry>('pain_entries', {
      time,
      part,
      level: clampLevel(level),
      trigger: trigger.trim(),
      note: note.trim(),
    });
    setTrigger('');
    setNote('');
    await load();
  };

  const remove = async (e: PainEntry) => {
    await deleteRecord('pain_entries', e.id!);
    await load();
  };

  const trend = [...entries].reverse().slice(0, 30).map((e) => ({
    time: e.time.slice(5, 16),
    level: e.level,
  }));

  const partFreq = new Map<string, number>();
  for (const e of entries) {
    partFreq.set(e.part, (partFreq.get(e.part) ?? 0) + 1);
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>疼痛日记</h2>

      <div className="grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <div className="card">
          <div className="card-title">记录疼痛</div>
          <div className="field">
            <label>时间</label>
            <input
              className="input"
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="field">
            <label>部位</label>
            <select className="select" value={part} onChange={(e) => setPart(e.target.value)}>
              {PARTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>疼痛程度：{level} / 10</label>
            <input
              type="range"
              min={1}
              max={10}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>诱因（可选）</label>
            <input className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="例如：久坐、受凉" />
          </div>
          <div className="field">
            <label>备注</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="btn" onClick={() => void save()}>
            保存
          </button>
        </div>

        <div className="card">
          <div className="card-title">最近 30 条疼痛程度变化</div>
          {trend.length < 2 ? (
            <EmptyState text="记录两次以上即可查看变化" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis domain={[1, 10]} tick={{ fontSize: 11 }} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="level" stroke="#c0392b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
          <div className="card-title">历史记录</div>
          {entries.length === 0 ? (
            <EmptyState text="还没有疼痛记录" />
          ) : (
            entries.map((e) => (
              <div key={e.id} className="list-item">
                <span style={{ flex: 1 }}>
                  {e.time.replace('T', ' ')} · {e.part} · 程度 {e.level}
                  {e.trigger ? ` · 诱因：${e.trigger}` : ''}
                  {e.note ? ` · ${e.note}` : ''}
                </span>
                <button className="btn small danger" onClick={() => void remove(e)}>
                  删除
                </button>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <div className="card-title">部位出现频次</div>
          {partFreq.size === 0 ? (
            <EmptyState text="暂无数据" />
          ) : (
            [...partFreq.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([p, count]) => (
                <div key={p} className="list-item">
                  <span style={{ flex: 1 }}>{p}</span>
                  <span className="badge">{count} 次</span>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 疼痛日记页面"
```

### Task 5.3: 首页加入体重与疼痛概览卡

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: 修改 HomePage：加载体重与疼痛数据并新增两张卡片**

在 `src/pages/HomePage.tsx` 中：
- 引入类型 `WeightRecord`、`PainEntry` 与 `bmi`；
- state 增加 `weights`、`painEntries`；
- `useEffect` 中加载 `weight_records`、`pain_entries`；
- 在"最近便签"卡片后增加"体重"与"疼痛"卡片。

在现有文件基础上新增/修改的片段（其余部分保持不变）：

```tsx
// 顶部类型引入新增
import type { Expense, ExpenseCategory, Note, PainEntry, PageId, Todo, WeightRecord, WorkbenchSettings } from '../types';
import { todayStr, monthStr, formatMoney, bmi } from '../utils/helpers';

// state 新增
const [weights, setWeights] = useState<WeightRecord[]>([]);
const [painEntries, setPainEntries] = useState<PainEntry[]>([]);

// useEffect 中新增
void getAll<WeightRecord>('weight_records').then(setWeights);
void getAll<PainEntry>('pain_entries').then(setPainEntries);

// 计算值
const latestWeight = weights.length
  ? weights.reduce((max, r) => (r.date > max.date ? r : max))
  : null;
const todayWeightRecorded = weights.some((r) => r.date === todayStr());
const recentPain = [...painEntries].sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 3);

// 在「最近便签」卡片后追加两张卡片
<div className="card">
  <div className="card-title">体重</div>
  {latestWeight ? (
    <div style={{ fontSize: 20, fontWeight: 700 }}>
      {latestWeight.weightKg.toFixed(1)} kg
      <span className="muted"> · {latestWeight.date}</span>
    </div>
  ) : (
    <div className="muted">暂无记录</div>
  )}
  {settings.heightCm > 0 && latestWeight && (
    <div className="muted">BMI：{bmi(latestWeight.weightKg, settings.heightCm).toFixed(1)}</div>
  )}
  {settings.weightRemindEnabled && !todayWeightRecorded && (
    <div className="danger-text">今天还没记录体重</div>
  )}
  <button className="btn small secondary" onClick={() => onNavigate('weight')}>
    去记录
  </button>
</div>
<div className="card">
  <div className="card-title">最近疼痛</div>
  {recentPain.length === 0 ? (
    <div className="muted">暂无记录</div>
  ) : (
    recentPain.map((p) => (
      <div key={p.id} className="list-item">
        <span style={{ flex: 1 }}>{p.part}</span>
        <span className={p.level >= 6 ? 'badge danger' : 'badge'}>{p.level}/10</span>
      </div>
    ))
  )}
  <button className="btn small secondary" onClick={() => onNavigate('pain')}>
    去记录
  </button>
</div>
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 首页体重与疼痛概览"
```---
## Phase 6：食材统计 / 采购清单 / 计划菜谱（联动）

### Task 6.1: 联动引擎 foodLinkage

**Files:**
- Create: `src/utils/foodLinkage.ts`
- Create: `tests/foodLinkage.test.ts`

- [ ] **Step 1: 写失败测试 tests/foodLinkage.test.ts**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDB, getAll, putRecord, resetDBForTests } from '../src/db/db';
import {
  computeDeficits,
  markMealCooked,
  addToShoppingList,
  restockFromShopping,
} from '../src/utils/foodLinkage';
import type { Ingredient, MealPlan, Recipe, ShoppingItem } from '../src/types';

describe('foodLinkage', () => {
  beforeEach(async () => {
    resetDBForTests();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('browser-workbench');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  const recipe: Recipe = {
    name: '番茄炒蛋',
    ingredients: [
      { name: '番茄', quantity: 2, unit: '个' },
      { name: '鸡蛋', quantity: 3, unit: '个' },
    ],
    steps: '翻炒',
    servings: 2,
    createdAt: '2026-08-01T00:00:00.000Z',
  };

  it('computeDeficits 计算缺口', async () => {
    const ingredients: Ingredient[] = [
      { name: '番茄', quantity: 1, unit: '个', category: '蔬菜', expiryDate: null, updatedAt: '' },
    ];
    expect(await computeDeficits(recipe, ingredients)).toEqual([
      { name: '番茄', quantity: 1, unit: '个' },
      { name: '鸡蛋', quantity: 3, unit: '个' },
    ]);
  });

  it('markMealCooked 扣减库存并返回缺口', async () => {
    await putRecord<Ingredient>('ingredients', {
      name: '番茄',
      quantity: 5,
      unit: '个',
      category: '蔬菜',
      expiryDate: null,
      updatedAt: '',
    });
    const recipeId = await putRecord<Recipe>('recipes', recipe);
    const plan: MealPlan = { date: '2026-08-05', recipeId, status: 'planned', cookedAt: null };
    const planId = await putRecord<MealPlan>('meal_plans', plan);
    const deficits = await markMealCooked({ ...plan, id: planId });
    expect(deficits).toEqual([{ name: '鸡蛋', quantity: 3, unit: '个' }]);
    const ingredients = await getAll<Ingredient>('ingredients');
    expect(ingredients[0].quantity).toBe(3);
    const plans = await getAll<MealPlan>('meal_plans');
    expect(plans[0].status).toBe('cooked');
  });

  it('addToShoppingList 合并同名未完成项', async () => {
    await putRecord<ShoppingItem>('shopping_items', {
      name: '鸡蛋',
      quantity: 1,
      unit: '个',
      done: false,
      source: 'manual',
      createdAt: '',
    });
    await addToShoppingList([{ name: '鸡蛋', quantity: 3, unit: '个' }]);
    const items = await getAll<ShoppingItem>('shopping_items');
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(4);
  });

  it('restockFromShopping 补回库存并标记完成', async () => {
    await putRecord<ShoppingItem>('shopping_items', {
      name: '牛奶',
      quantity: 2,
      unit: '盒',
      done: false,
      source: 'manual',
      createdAt: '',
    });
    const item = (await getAll<ShoppingItem>('shopping_items'))[0];
    await restockFromShopping(item);
    const ingredients = await getAll<Ingredient>('ingredients');
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0].name).toBe('牛奶');
    expect(ingredients[0].quantity).toBe(2);
    expect((await getAll<ShoppingItem>('shopping_items'))[0].done).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:run -- tests/foodLinkage.test.ts`
Expected: FAIL，找不到模块 `../src/utils/foodLinkage`。

- [ ] **Step 3: 创建 src/utils/foodLinkage.ts**

```ts
import { getAll, putRecord } from '../db/db';
import type { Ingredient, MealPlan, Recipe, ShoppingItem } from '../types';

export interface Deficit {
  name: string;
  quantity: number;
  unit: string;
}

export async function computeDeficits(recipe: Recipe, ingredients: Ingredient[]): Promise<Deficit[]> {
  const deficits: Deficit[] = [];
  for (const need of recipe.ingredients) {
    const stock = ingredients.find((i) => i.name === need.name);
    const have = stock ? stock.quantity : 0;
    const missing = need.quantity - have;
    if (missing > 0) deficits.push({ name: need.name, quantity: missing, unit: need.unit });
  }
  return deficits;
}

export async function markMealCooked(plan: MealPlan): Promise<Deficit[]> {
  const recipe = (await getAll<Recipe>('recipes')).find((r) => r.id === plan.recipeId);
  if (!recipe) throw new Error('菜谱不存在');
  const ingredients = await getAll<Ingredient>('ingredients');
  const deficits = await computeDeficits(recipe, ingredients);
  for (const need of recipe.ingredients) {
    const stock = ingredients.find((i) => i.name === need.name);
    if (stock) {
      stock.quantity = Math.max(0, stock.quantity - need.quantity);
      stock.updatedAt = new Date().toISOString();
      await putRecord<Ingredient>('ingredients', stock);
    }
  }
  plan.status = 'cooked';
  plan.cookedAt = new Date().toISOString();
  await putRecord<MealPlan>('meal_plans', plan);
  return deficits;
}

export async function addToShoppingList(items: Deficit[], source: 'recipe' | 'low_stock' = 'recipe'): Promise<void> {
  const existing = await getAll<ShoppingItem>('shopping_items');
  for (const item of items) {
    const found = existing.find((e) => e.name === item.name && !e.done);
    if (found) {
      found.quantity += item.quantity;
      await putRecord<ShoppingItem>('shopping_items', found);
    } else {
      await putRecord<ShoppingItem>('shopping_items', {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        done: false,
        source,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

export async function restockFromShopping(item: ShoppingItem): Promise<void> {
  const ingredients = await getAll<Ingredient>('ingredients');
  const stock = ingredients.find((i) => i.name === item.name);
  if (stock) {
    stock.quantity += item.quantity;
    stock.updatedAt = new Date().toISOString();
    await putRecord<Ingredient>('ingredients', stock);
  } else {
    await putRecord<Ingredient>('ingredients', {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: '其他',
      expiryDate: null,
      updatedAt: new Date().toISOString(),
    });
  }
  item.done = true;
  await putRecord<ShoppingItem>('shopping_items', item);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:run -- tests/foodLinkage.test.ts`
Expected: 4 个测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 食材联动引擎与测试"
```

### Task 6.2: 食材统计页面

**Files:**
- Modify: `src/pages/IngredientsPage.tsx`

- [ ] **Step 1: 替换 src/pages/IngredientsPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { Ingredient } from '../types';
import { getAll, putRecord, deleteRecord } from '../db/db';
import { todayStr } from '../utils/helpers';
import { addToShoppingList } from '../utils/foodLinkage';
import EmptyState from '../components/EmptyState';

const CATEGORIES = ['蔬菜', '肉蛋', '调料', '主食', '其他'] as const;
const UNITS = ['个', '斤', '克', '千克', '盒', '瓶', '袋', '包'];

export default function IngredientsPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(UNITS[0]);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [expiry, setExpiry] = useState('');

  const load = async () => {
    setItems(await getAll<Ingredient>('ingredients'));
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    const q = Number(quantity);
    if (!name.trim() || !quantity || !Number.isFinite(q) || q < 0) {
      window.alert('请输入食材名称与有效数量');
      return;
    }
    await putRecord<Ingredient>('ingredients', {
      name: name.trim(),
      quantity: q,
      unit,
      category: category as Ingredient['category'],
      expiryDate: expiry || null,
      updatedAt: new Date().toISOString(),
    });
    setName('');
    setQuantity('');
    setExpiry('');
    await load();
  };

  const adjust = async (item: Ingredient, delta: number) => {
    await putRecord<Ingredient>('ingredients', {
      ...item,
      quantity: Math.max(0, item.quantity + delta),
      updatedAt: new Date().toISOString(),
    });
    await load();
  };

  const remove = async (item: Ingredient) => {
    await deleteRecord('ingredients', item.id!);
    await load();
  };

  const addLowStockToShopping = async () => {
    const low = items.filter((i) => i.quantity === 0);
    if (low.length === 0) {
      window.alert('没有缺货食材');
      return;
    }
    await addToShoppingList(low.map((i) => ({ name: i.name, quantity: 1, unit: i.unit })), 'low_stock');
    window.alert(`已将 ${low.length} 种缺货食材加入采购清单`);
  };

  const today = todayStr();
  const daysUntil = (d: string) =>
    Math.ceil((new Date(d).getTime() - new Date(today).getTime()) / 86400000);
  const expired = items.filter((i) => i.expiryDate && i.expiryDate <= today && i.quantity > 0);
  const nearExpiry = items.filter(
    (i) => i.expiryDate && i.expiryDate > today && daysUntil(i.expiryDate) <= 3 && i.quantity > 0,
  );
  const lowStock = items.filter((i) => i.quantity === 0);

  return (
    <div>
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>食材统计</h2>

      <div className="grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <div className="card">
          <div className="card-title">添加食材</div>
          <div className="field">
            <label>名称</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：番茄" />
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label>数量</label>
              <input className="input" type="number" min="0" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>单位</label>
              <select className="select" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>分类</label>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>保质期（可选）</label>
            <input className="input" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <button className="btn" onClick={() => void save()}>
            添加
          </button>
        </div>

        <div>
          <div className="card">
            <div className="card-title">提醒</div>
            <div className="row">
              <span className="badge danger">已过期 {expired.length}</span>
              <span className="badge danger">临期（3 天内）{nearExpiry.length}</span>
              <span className="badge">缺货 {lowStock.length}</span>
              <button className="btn small secondary" onClick={() => void addLowStockToShopping()}>
                缺货加入采购清单
              </button>
            </div>            <div className="muted" style={{ marginTop: 8 }}>
              库存 {items.length} 种 · 共 {items.reduce((s, i) => s + i.quantity, 0)} 单位 ·{' '}
              {['蔬菜', '肉蛋', '调料', '主食', '其他']
                .map((c) => `${c} ${items.filter((i) => i.category === c).length}`)
                .join(' / ')}
            </div>
            {expired.length > 0 && (
              <div className="danger-text" style={{ marginTop: 8 }}>
                {expired.map((i) => `${i.name}（${i.expiryDate}）`).join('、')} 已过期
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">库存列表</div>
            {items.length === 0 ? (
              <EmptyState text="还没有食材" />
            ) : (
              items.map((i) => (
                <div key={i.id} className="list-item">
                  <span style={{ flex: 1 }}>
                    {i.name}
                    <span className="muted"> · {i.category}</span>
                    {i.expiryDate && (
                      <span className={i.expiryDate <= today ? 'badge danger' : 'badge'} style={{ marginLeft: 6 }}>
                        {i.expiryDate}
                      </span>
                    )}
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {i.quantity} {i.unit}
                  </span>
                  <button className="btn small secondary" onClick={() => void adjust(i, 1)}>
                    +
                  </button>
                  <button className="btn small secondary" onClick={() => void adjust(i, -1)}>
                    -
                  </button>
                  <button className="btn small danger" onClick={() => void remove(i)}>
                    删除
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 食材统计页面"
```

### Task 6.3: 采购清单页面

**Files:**
- Modify: `src/pages/ShoppingPage.tsx`

- [ ] **Step 1: 替换 src/pages/ShoppingPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { ShoppingItem } from '../types';
import { getAll, putRecord, deleteRecord } from '../db/db';
import { restockFromShopping } from '../utils/foodLinkage';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('份');
  const [confirmItem, setConfirmItem] = useState<ShoppingItem | null>(null);

  const load = async () => {
    const all = await getAll<ShoppingItem>('shopping_items');
    setItems([...all].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)));
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    const q = Number(quantity) || 1;
    if (!name.trim()) return;
    await putRecord<ShoppingItem>('shopping_items', {
      name: name.trim(),
      quantity: q,
      unit,
      done: false,
      source: 'manual',
      createdAt: new Date().toISOString(),
    });
    setName('');
    setQuantity('');
    await load();
  };

  const remove = async (item: ShoppingItem) => {
    await deleteRecord('shopping_items', item.id!);
    await load();
  };

  const check = async (item: ShoppingItem) => {
    if (!item.done) {
      setConfirmItem(item);
    } else {
      await putRecord<ShoppingItem>('shopping_items', { ...item, done: false });
      await load();
    }
  };

  const confirmRestock = async () => {
    if (!confirmItem) return;
    await restockFromShopping(confirmItem);
    setConfirmItem(null);
    await load();
  };

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div>
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>采购清单</h2>

      <div className="card">
        <div className="card-title">添加采购项</div>
        <div className="row">
          <input
            className="input"
            style={{ flex: 2 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="要买什么"
          />
          <input
            className="input"
            style={{ flex: 1 }}
            type="number"
            min="0"
            step="0.1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="数量"
          />
          <input
            className="input"
            style={{ flex: 1 }}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="单位"
          />
          <button className="btn" onClick={() => void save()}>
            添加
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">待购买（{pending.length}）</div>
        {pending.length === 0 ? (
          <EmptyState text="没有待购买项" />
        ) : (
          pending.map((item) => (
            <div key={item.id} className="list-item">
              <input
                type="checkbox"
                checked={false}
                onChange={() => void check(item)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ flex: 1 }}>
                {item.name}
                <span className="muted">
                  {' '}
                  · {item.quantity} {item.unit} · {item.source === 'recipe' ? '来自菜谱' : item.source === 'low_stock' ? '库存不足' : '手动添加'}
                </span>
              </span>
              <button className="btn small danger" onClick={() => void remove(item)}>
                删除
              </button>
            </div>
          ))
        )}
      </div>

      {done.length > 0 && (
        <div className="card">
          <div className="card-title">已购买（勾掉恢复未买）</div>
          {done.map((item) => (
            <div key={item.id} className="list-item">
              <input
                type="checkbox"
                checked
                onChange={() => void check(item)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ flex: 1, textDecoration: 'line-through', color: '#999999' }}>
                {item.name}
              </span>
              <button className="btn small danger" onClick={() => void remove(item)}>
                删除
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmItem !== null}
        title="已购买？"
        message={`确认「${confirmItem?.name}」已买？将自动补回食材库存。`}
        onCancel={() => setConfirmItem(null)}
        onConfirm={() => void confirmRestock()}
      />
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 采购清单页面"
```

### Task 6.4: 计划菜谱页面（菜谱库 + 菜单安排 + 做菜联动）

**Files:**
- Modify: `src/pages/RecipesPage.tsx`

- [ ] **Step 1: 替换 src/pages/RecipesPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { MealPlan, Recipe, RecipeIngredient } from '../types';
import { getAll, putRecord, deleteRecord } from '../db/db';
import { markMealCooked, addToShoppingList } from '../utils/foodLinkage';
import { todayStr } from '../utils/helpers';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [tab, setTab] = useState<'recipes' | 'plans'>('recipes');

  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { name: '', quantity: 1, unit: '份' },
  ]);
  const [steps, setSteps] = useState('');
  const [servings, setServings] = useState('1');

  const [planDate, setPlanDate] = useState(todayStr());
  const [planRecipeId, setPlanRecipeId] = useState<number | ''>('');

  const load = async () => {
    setRecipes(await getAll<Recipe>('recipes'));
    const all = await getAll<MealPlan>('meal_plans');
    setPlans([...all].sort((a, b) => (a.date < b.date ? -1 : 1)));
  };

  useEffect(() => {
    void load();
  }, []);

  const saveRecipe = async () => {
    if (!recipeName.trim()) return;
    const valid = ingredients.filter((i) => i.name.trim() && i.quantity > 0);
    if (valid.length === 0) {
      window.alert('请至少填写一种食材');
      return;
    }
    await putRecord<Recipe>('recipes', {
      name: recipeName.trim(),
      ingredients: valid.map((i) => ({ name: i.name.trim(), quantity: i.quantity, unit: i.unit })),
      steps: steps.trim(),
      servings: Number(servings) || 1,
      createdAt: new Date().toISOString(),
    });
    setShowRecipeForm(false);
    setRecipeName('');
    setIngredients([{ name: '', quantity: 1, unit: '份' }]);
    setSteps('');
    await load();
  };

  const removeRecipe = async (r: Recipe) => {
    await deleteRecord('recipes', r.id!);
    await load();
  };

  const addPlan = async () => {
    if (planRecipeId === '') return;
    await putRecord<MealPlan>('meal_plans', {
      date: planDate,
      recipeId: planRecipeId,
      status: 'planned',
      cookedAt: null,
    });
    await load();
  };

  const cook = async (plan: MealPlan) => {
    const deficits = await markMealCooked(plan);
    await load();
    if (
      deficits.length > 0 &&
      window.confirm(
        `库存不足：${deficits.map((d) => `${d.name} 缺 ${d.quantity}${d.unit}`).join('、')}。加入采购清单？`,
      )
    ) {
      await addToShoppingList(deficits);
      window.alert('缺口已加入采购清单');
    }
  };

  const removePlan = async (p: MealPlan) => {
    await deleteRecord('meal_plans', p.id!);
    await load();
  };

  const recipeNameOf = (id: number) => recipes.find((r) => r.id === id)?.name ?? '未知菜谱';
  const planDays = [...new Set(plans.map((p) => p.date))].sort();

  return (
    <div>
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>计划菜谱</h2>

      <div className="row" style={{ marginBottom: 12 }}>
        <button className={tab === 'recipes' ? 'btn small' : 'btn small secondary'} onClick={() => setTab('recipes')}>
          菜谱库
        </button>
        <button className={tab === 'plans' ? 'btn small' : 'btn small secondary'} onClick={() => setTab('plans')}>
          菜单安排
        </button>
      </div>

      {tab === 'recipes' && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="card-title" style={{ margin: 0 }}>
              菜谱（{recipes.length}）
            </div>
            <button className="btn small" onClick={() => setShowRecipeForm(true)}>
              新建菜谱
            </button>
          </div>
          {recipes.length === 0 ? (
            <EmptyState text="还没有菜谱" />
          ) : (
            recipes.map((r) => (
              <div key={r.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <strong>{r.name}</strong>
                  <div className="muted">
                    {r.ingredients.map((i) => `${i.name} ${i.quantity}${i.unit}`).join('、')}
                    {r.servings > 0 ? ` · ${r.servings} 人份` : ''}
                  </div>
                  {r.steps && <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{r.steps}</div>}
                </div>
                <button className="btn small danger" onClick={() => void removeRecipe(r)}>
                  删除
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'plans' && (
        <div>
          <div className="card">
            <div className="card-title">安排菜单</div>
            <div className="row">
              <input
                className="input"
                style={{ width: 150 }}
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
              />
              <select
                className="select"
                style={{ flex: 1 }}
                value={planRecipeId}
                onChange={(e) => setPlanRecipeId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">选择菜谱</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button className="btn" onClick={() => void addPlan()}>
                添加
              </button>
            </div>
          </div>

          {planDays.length === 0 ? (
            <div className="card">
              <EmptyState text="还没有安排菜单" />
            </div>
          ) : (
            planDays.map((day) => (
              <div key={day} className="card">
                <div className="card-title">{day}</div>
                {plans
                  .filter((p) => p.date === day)
                  .map((p) => (
                    <div key={p.id} className="list-item">
                      <span style={{ flex: 1 }}>
                        {recipeNameOf(p.recipeId)}
                        {p.status === 'cooked' ? <span className="badge success" style={{ marginLeft: 8 }}>已做</span> : null}
                      </span>
                      {p.status === 'planned' && (
                        <button className="btn small" onClick={() => void cook(p)}>
                          标记已做
                        </button>
                      )}
                      <button className="btn small danger" onClick={() => void removePlan(p)}>
                        删除
                      </button>
                    </div>
                  ))}
              </div>
            ))
          )}
        </div>
      )}

      <Modal open={showRecipeForm} title="新建菜谱" onClose={() => setShowRecipeForm(false)}>
        <div className="field">
          <label>菜名</label>
          <input className="input" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} />
        </div>
        <div className="field">
          <label>份量（人份）</label>
          <input className="input" type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} />
        </div>
        <div className="field">
          <label>食材清单</label>
          {ingredients.map((ing, index) => (
            <div key={index} className="row" style={{ marginBottom: 6 }}>
              <input
                className="input"
                style={{ flex: 2 }}
                value={ing.name}
                onChange={(e) => {
                  const next = [...ingredients];
                  next[index] = { ...next[index], name: e.target.value };
                  setIngredients(next);
                }}
                placeholder="食材名"
              />
              <input
                className="input"
                style={{ flex: 1 }}
                type="number"
                min="0"
                step="0.1"
                value={ing.quantity}
                onChange={(e) => {
                  const next = [...ingredients];
                  next[index] = { ...next[index], quantity: Number(e.target.value) };
                  setIngredients(next);
                }}
              />
              <input
                className="input"
                style={{ flex: 1 }}
                value={ing.unit}
                onChange={(e) => {
                  const next = [...ingredients];
                  next[index] = { ...next[index], unit: e.target.value };
                  setIngredients(next);
                }}
                placeholder="单位"
              />
              <button
                className="btn small danger"
                onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))}
              >
                删
              </button>
            </div>
          ))}
          <button
            className="btn small secondary"
            onClick={() => setIngredients([...ingredients, { name: '', quantity: 1, unit: '份' }])}
          >
            + 添加食材
          </button>
        </div>
        <div className="field">
          <label>做法步骤</label>
          <textarea className="textarea" rows={4} value={steps} onChange={(e) => setSteps(e.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => void saveRecipe()}>
            保存菜谱
          </button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 计划菜谱页面与做菜联动"
```

### Task 6.5: 首页加入食材提醒与采购概览卡

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: 修改 HomePage：加载食材与采购数据并新增两张卡片**

在 `src/pages/HomePage.tsx` 中：
- 引入类型 `Ingredient`、`ShoppingItem`；
- state 增加 `ingredients`、`shoppingItems`；
- `useEffect` 中加载 `ingredients`、`shopping_items`；
- 在"疼痛"卡片后追加"食材提醒"与"采购清单"两张卡片。

在现有文件基础上新增/修改的片段：

```tsx
// 类型引入新增
import type {
  Expense, ExpenseCategory, Ingredient, Note, PainEntry, PageId, ShoppingItem,
  Todo, WeightRecord, WorkbenchSettings,
} from '../types';
import { todayStr } from '../utils/helpers';

// state 新增
const [ingredients, setIngredients] = useState<Ingredient[]>([]);
const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);

// useEffect 中新增
void getAll<Ingredient>('ingredients').then(setIngredients);
void getAll<ShoppingItem>('shopping_items').then(setShoppingItems);

// 计算值
const expiredCount = ingredients.filter((i) => i.expiryDate && i.expiryDate <= todayStr() && i.quantity > 0).length;
const lowStockCount = ingredients.filter((i) => i.quantity === 0).length;
const pendingShopping = shoppingItems.filter((i) => !i.done);

// 在「最近疼痛」卡片后追加
<div className="card">
  <div className="card-title">食材提醒</div>
  <div className="row">
    <span className={expiredCount > 0 ? 'badge danger' : 'badge'}>过期 {expiredCount}</span>
    <span className={lowStockCount > 0 ? 'badge danger' : 'badge'}>缺货 {lowStockCount}</span>
  </div>
  <button className="btn small secondary" onClick={() => onNavigate('ingredients')}>
    去查看
  </button>
</div>
<div className="card">
  <div className="card-title">采购清单</div>
  <div style={{ fontSize: 20, fontWeight: 700 }}>{pendingShopping.length} 项待购买</div>
  {pendingShopping.slice(0, 3).map((s) => (
    <div key={s.id} className="list-item">
      {s.name}
    </div>
  ))}
  <button className="btn small secondary" onClick={() => onNavigate('shopping')}>
    去采购
  </button>
</div>
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 首页食材与采购概览"
```---
## Phase 7：设置页与收尾接线

### Task 7.1: 设置页面

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: 替换 src/pages/SettingsPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { SearchEngine, WorkbenchSettings } from '../types';
import { loadSettings, saveSettings, addEngine, removeEngine } from '../db/settings';
import { downloadBackup, readBackupFile, restoreBackup } from '../utils/backup';
import { STORES } from '../db/stores';
import { clearStore } from '../db/db';
import ConfirmDialog from '../components/ConfirmDialog';

export default function SettingsPage() {
  const [settings, setSettings] = useState<WorkbenchSettings | null>(null);
  const [engineName, setEngineName] = useState('');
  const [engineUrl, setEngineUrl] = useState('');
  const [height, setHeight] = useState('');
  const [goal, setGoal] = useState('');
  const [remind, setRemind] = useState(true);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    void loadSettings().then((s) => {
      setSettings(s);
      setHeight(String(s.heightCm));
      setGoal(s.goalWeightKg ? String(s.goalWeightKg) : '');
      setRemind(s.weightRemindEnabled);
    });
  }, []);

  if (!settings) return null;

  const persist = async (next: WorkbenchSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const saveBasics = async () => {
    await persist({
      ...settings,
      heightCm: height ? Number(height) : 170,
      goalWeightKg: goal ? Number(goal) : 0,
      weightRemindEnabled: remind,
    });
    window.alert('已保存');
  };

  const addCustomEngine = async () => {
    if (!engineName.trim() || !engineUrl.includes('{q}')) {
      window.alert('请填写名称，且网址需包含 {q} 占位符');
      return;
    }
    await persist({
      ...settings,
      engines: addEngine(settings.engines, {
        id: `custom-${Date.now()}`,
        name: engineName.trim(),
        url: engineUrl.trim(),
      }),
    });
    setEngineName('');
    setEngineUrl('');
  };

  const deleteEngine = async (engine: SearchEngine) => {
    if (settings.engines.length <= 1) {
      window.alert('至少保留一个搜索引擎');
      return;
    }
    const next = removeEngine(settings.engines, engine.id);
    await persist({
      ...settings,
      engines: next,
      defaultEngine: settings.defaultEngine === engine.id ? next[0].id : settings.defaultEngine,
    });
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await readBackupFile(file);
      await restoreBackup(data);
      window.alert('恢复成功，页面即将刷新');
      location.reload();
    } catch (err) {
      window.alert(`恢复失败：${err instanceof Error ? err.message : '文件格式不正确'}`);
    }
  };

  const resetAll = async () => {
    for (const store of STORES) {
      await clearStore(store);
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove('workbenchSettings');
    }
    localStorage.removeItem('workbenchSettings');
    setShowReset(false);
    location.reload();
  };

  return (
    <div>
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>设置</h2>

      <div className="card">
        <div className="card-title">搜索</div>
        <div className="field">
          <label>默认搜索引擎</label>
          <select
            className="select"
            value={settings.defaultEngine}
            onChange={(e) => void persist({ ...settings, defaultEngine: e.target.value })}
          >
            {settings.engines.map((en) => (
              <option key={en.id} value={en.id}>
                {en.name}
              </option>
            ))}
          </select>
        </div>
        <div className="card-title" style={{ marginTop: 12 }}>
          自定义引擎
        </div>
        <div className="row">
          <input
            className="input"
            style={{ flex: 1 }}
            value={engineName}
            onChange={(e) => setEngineName(e.target.value)}
            placeholder="名称，例如：B站站内"
          />
          <input
            className="input"
            style={{ flex: 2 }}
            value={engineUrl}
            onChange={(e) => setEngineUrl(e.target.value)}
            placeholder="搜索网址，用 {q} 代替关键词"
          />
          <button className="btn small" onClick={() => void addCustomEngine()}>
            添加
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          {settings.engines.map((en) => (
            <div key={en.id} className="list-item">
              <span style={{ flex: 1 }}>
                {en.name}
                {en.id === settings.defaultEngine ? <span className="badge" style={{ marginLeft: 8 }}>默认</span> : null}
              </span>
              <button className="btn small danger" onClick={() => void deleteEngine(en)}>
                删除
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">体重相关</div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>身高（cm）</label>
            <input className="input" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>目标体重（kg，0 为不设）</label>
            <input className="input" type="number" step="0.1" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
        </div>
        <label className="row" style={{ marginBottom: 10 }}>
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          首页提醒：当天未记录体重时提示
        </label>
        <button className="btn small" onClick={() => void saveBasics()}>
          保存
        </button>
      </div>

      <div className="card">
        <div className="card-title">数据备份</div>
        <div className="row">
          <button className="btn small" onClick={() => void downloadBackup()}>
            导出备份
          </button>
          <label className="btn small secondary" style={{ cursor: 'pointer' }}>
            导入备份
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => void onImport(e.target.files?.[0])}
            />
          </label>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          备份为 JSON 文件，包含全部数据；导入会覆盖当前数据。
        </div>
      </div>

      <div className="card">
        <div className="card-title">危险操作</div>
        <button className="btn small danger" onClick={() => setShowReset(true)}>
          清空全部数据
        </button>
      </div>

      <ConfirmDialog
        open={showReset}
        title="确认清空？"
        message="将删除本地全部数据且无法恢复，确定继续？"
        onCancel={() => setShowReset(false)}
        onConfirm={() => void resetAll()}
      />
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 设置页面"
``n
### Task 7.2: 应用启动时执行数据种子

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: 修改 src/main.tsx，渲染前先完成默认数据初始化**

完整文件：

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { seedIfNeeded } from './db/seed';
import './index.css';

seedIfNeeded()
  .catch(() => undefined)
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 应用启动时初始化默认数据"
```
---

## Phase 8：构建、打包与验收

### Task 8.1: 全量测试与构建

**Files:** 无（验证任务）

- [ ] **Step 1: 运行全部测试**

Run: `npm run test:run`
Expected: 全部测试 PASS（db 4 个、seed 1 个、helpers 6 个、array 3 个、sorters 2 个、stats 4 个、backup 4 个、foodLinkage 4 个）。

- [ ] **Step 2: 生产构建**

Run: `npm run build`
Expected: `tsc --noEmit` 无报错，`dist/` 生成完整产物（index.html、assets/、manifest.json、icons/）。

- [ ] **Step 3: 核对 dist 内容**

Run: `Get-ChildItem -Recurse dist | Select-Object FullName`
Expected: 包含 `dist/index.html`、`dist/manifest.json`、`dist/icons/icon16.png`、`dist/icons/icon48.png`、`dist/icons/icon128.png` 与 `dist/assets/`。

- [ ] **Step 4: 提交（若有代码调整）**

```bash
git add -A
git commit -m "chore: 全量测试与构建通过"
``n
### Task 8.2: 打包分享压缩包并更新 README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 生成分享压缩包**

Run（PowerShell，在仓库根目录）：

```powershell
Compress-Archive -Path dist\* -DestinationPath dist\browser-workbench.zip -Force
```

Expected: 生成 `dist/browser-workbench.zip`。注意：zip 放在 dist 内仅用于临时分享，不要提交 dist/（已在 .gitignore 中）。

- [ ] **Step 2: 更新 README.md，追加安装说明**

在 `README.md` 末尾追加：

```markdown
## 安装方法

1. 构建：`npm install && npm run build`
2. 打开 Chrome（或 Edge）的扩展管理页：`chrome://extensions`（Edge 为 `edge://extensions`）
3. 打开右上角"开发者模式"
4. 点击"加载已解压的扩展程序"，选择 `dist` 文件夹
5. 新建标签页即可看到工作台

分享给他人：把 `dist` 压缩成 zip 发过去，对方解压后按第 2-4 步安装即可。
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "docs: README 补充安装说明"
```

### Task 8.3: 浏览器手工验收清单

**Files:** 无（验收任务，不提交代码）

- [ ] **Step 1: Chrome 验收**

1. 打开 `chrome://extensions`，开启开发者模式，加载 `dist` 目录；
2. 新建标签页：出现工作台（搜索框 + 常用网站图标 + 概览卡）；
3. 搜索：切换百度/必应/谷歌，回车后打开对应搜索页；
4. 快捷跳转：添加网站（图标显示或回退字母/文字）、拖拽排序、新建/删除分组；
5. 记账：分别记一笔收入与支出，确认本月汇总、明细、分类、预算、三个图表正常；编辑与软删除正常；
6. 便签：新建、改色、置顶、编辑、删除；
7. 待办：新建（含日期）、勾选完成、排序（未完成在前）；
8. 体重：记录两天数据看趋势，设置目标体重出现参考线，BMI 显示正常，当天未记录有提醒；
9. 疼痛：记录几条（程度 1-10），趋势图与部位频次正常；
10. 食材：添加食材（含保质期），过期/临期/缺货提醒正确；
11. 菜谱：新建菜谱 → 安排菜单 → 标记已做 → 库存自动扣减、缺口可加入采购清单；
12. 采购：添加采购项 → 勾选已买 → 确认后库存增加；
13. 设置：默认引擎切换、自定义引擎（含 {q}）、身高/目标体重保存；
14. 备份：导出 JSON → 清空数据 → 导入恢复，数据一致；
15. 重启浏览器后重新打开新标签页，数据仍在。

- [ ] **Step 2: Edge 验收**

重复 Step 1（扩展管理页为 `edge://extensions`），重点验证新标签页接管与数据互通。

- [ ] **Step 3: 窄屏检查**

在 DevTools 设备模式检查 375px / 768px / 1280px 三种宽度，导航换行与卡片布局不破版。

---

## 收尾说明

- 本计划完成后，产物为可分享的浏览器扩展（`dist/` 压缩包），全部数据本地存储。
- 后续可扩展点（不在本期）：站内搜索配置、浏览器通知、浅色主题、Chrome/Edge 商店上架、云同步。