# 项目记忆（浏览器工作台）

> 本文件是项目的"记忆"文件。**每次开始工作前必须先完整阅读本文件**；每次调整（代码、文档、依赖、决策、进度）后必须更新本文件并随代码一起提交。

## 一、项目是什么

浏览器新标签页插件（Manifest V3，Chrome / Edge）。安装后，新建标签页即变为个人工作台，包含：搜索、快捷跳转、记账、便签、待办、体重管理、疼痛日记、食材统计、采购清单、计划菜谱（含三模块联动）。

数据全部存储在浏览器本地，不需要服务器，安装即用；插件将分享给他人使用。

## 二、关键决策（修改前先与用户确认）

1. **本地优先**：全部数据存 IndexedDB（业务数据）+ chrome.storage.local（轻量设置），无后端、无账号、无云同步。
2. **记账对齐 FinTracker**：参考 `github.com/syh190819/FinTracker`（dev 分支）的收支/分类/预算/统计逻辑，但数据层改为本地。
3. **技术栈**：Vite 5 + React 18 + TypeScript 5（strict）；图表 recharts；Manifest V3；无远程代码、无 CDN 依赖。
4. **视觉**：深海军蓝 `#1a1a2e` + 灰白极简卡片风（与 FinTracker 一致）；桌面优先，兼顾窄屏。
5. **金额**：以"元"的 number 存储，展示用 `formatMoney`（两位小数）；账目删除用软删除（`deletedAt`）。
6. **食材联动**：做菜（标记已做）→ 按菜谱扣库存 → 缺口一键加入采购清单；采购勾选已买 → 确认后补回库存。
7. **种子数据**：预置记账分类与常用网站（抖音/B站/微博/知乎/淘宝/京东/百度/微信读书），只在首次运行时写入（`settings.seeded`）。
8. **权限最小化**：扩展仅申请 `storage` 权限。
9. **测试先行**：核心逻辑（数据库、统计、联动、备份校验）有 vitest 测试；本机无法跑测试时必须写明"未验证"。

## 三、仓库与远程

- 本地路径：`D:\HuaweiMoveData\Users\11473\Documents\Repository\99_工作日志\vibe-coding\浏览器工作台`
- GitHub：https://github.com/syh190819/MYSHY-BrowserTab （**公开**，默认分支 `main`）
- 推送：走 HTTPS（Git Credential Manager）；SSH 密钥未绑定 GitHub。
- git 用户：syh190819 / syh190819@gmail.com

## 四、目录结构（截至 Phase 1）

```
浏览器工作台/
├─ AGENTS.md                    # 工作前必读入口（指向本文件）
├─ project_summary.md           # 本记忆文件
├─ README.md                    # 项目说明 + 安装方法 + 开发进度
├─ docs/superpowers/
│  ├─ specs/2026-08-05-browser-workbench-design.md    # 设计文档
│  └─ plans/2026-08-05-browser-workbench.md           # 实现计划（8 阶段 39 任务）
├─ public/
│  ├─ manifest.json             # MV3 扩展清单（接管新标签页）
│  └─ icons/                    # 16/48/128 图标
├─ scripts/generate-icons.mjs   # 图标生成脚本（Node）
├─ src/
│  ├─ main.tsx                  # 入口（Phase 7.2 将改为渲染前先跑种子）
│  ├─ App.tsx                   # 十页导航骨架
│  ├─ index.css                 # 全局样式（主题变量、卡片、按钮、弹窗）
│  ├─ types/index.ts            # 全部数据模型
│  ├─ db/
│  │  ├─ stores.ts              # 表清单（15 张）
│  │  ├─ db.ts                  # IndexedDB 封装（含 resetDBForTests）
│  │  ├─ settings.ts            # 设置存取（chrome.storage.local + localStorage 回退）
│  │  └─ seed.ts                # 默认数据种子
│  ├─ utils/
│  │  ├─ helpers.ts             # 金额/日期/搜索 URL/BMI/图标等
│  │  ├─ csv.ts                 # 记账 CSV 导出（Excel 可打开）
│  │  └─ backup.ts              # 备份导出/导入/校验
│  ├─ pages/                    # 10 个页面（目前为占位）
│  └─ test/setup.ts             # 测试环境（fake-indexeddb）
├─ tests/                       # vitest 测试（db/seed/helpers/backup）
├─ dist/                        # 构建产物（gitignore）
├─ node_modules/                # 依赖（gitignore）
├─ package.json / package-lock.json
├─ tsconfig.json / vite.config.ts / index.html / .gitignore
└─ dev-server.log               # 开发服务器日志（gitignore）
```

## 五、文档索引

- 设计文档：`docs/superpowers/specs/2026-08-05-browser-workbench-design.md`
- 实现计划：`docs/superpowers/plans/2026-08-05-browser-workbench.md`
  - Phase 0 项目骨架 / Phase 1 数据层与基础工具（已完成）
  - Phase 2 搜索与快捷跳转 / Phase 3 便签与待办 / Phase 4 记账 / Phase 5 体重与疼痛 / Phase 6 食材采购菜谱联动 / Phase 7 设置与收尾 / Phase 8 构建打包验收（待做）

## 六、当前进度与状态

- 已完成：设计文档、实现计划、Phase 0（骨架）、Phase 1（数据层与基础工具）
- 测试：**18/18 通过**（vitest run；含新增 csv 3 个）
- 构建：**通过**（dist/ 已生成；JS 144KB / gzip 46KB）
- 依赖：已安装（195+ 包）；另补 `@types/chrome`；tsconfig `types` 含 `chrome`
- 开发服务器：`http://127.0.0.1:5173` 运行中（日志 dev-server.log）
- 同类项目调研：已完成（详见设计文档第十二节），调整已落实到设置引擎、CSV 导出与计划新增任务
- 下一步：**Phase 2 搜索与快捷跳转**

## 七、本机环境与注意事项（Windows）

- Node v22.21.0、npm 10.9.4（无需再搭环境）
- **C 盘空间紧张**：node_modules 在 D 盘项目内；npm 缓存指向 `D:\HuaweiMoveData\Users\11473\Documents\Repository\99_工作日志\vibe-coding\.npm-cache`；安装命令必须带 `--cache` 参数指向该目录
- 沙箱限制：
  - git 写操作、npm install/test/build、启动后台进程需申请授权（esbuild 子进程在沙箱内会 EPERM）
  - `apply_patch` 修改已有文件会失败（环境 bug），新建文件可用；改已有文件用 PowerShell `[System.IO.File]` 读写（UTF-8 无 BOM）
- 常用命令：`npm run test:run`（测试）、`npm run build`（构建）、`npm run dev -- --host 127.0.0.1 --port 5173`（预览）

## 八、工作流约定

- 每个任务完成后提交；提交信息用 conventional 风格（feat/fix/docs/build/chore）
- **每次提交前更新本文件**（进度、结构、决策、注意事项）
- 核心逻辑先写测试（TDD）；无法运行测试时，明确标注"未验证"
- 中文界面文案；代码标识符一律英文
- 用户习惯：执行任务前先说"Let's goooo!"；用户问"懂我意思吗"时回答"懂你意思"

## 九、已知问题与风险

- 网站图标走 Google favicon 服务，国内网络可能不稳定；计划中已有"失败回退首字母"兜底，后续可考虑内置常用站图标库
- 首次打开页面时默认数据需在渲染前初始化（实现计划 Task 7.2，将修改 main.tsx）
- 搜索引擎默认百度/必应/谷歌，自定义引擎支持 `{q}` 占位（Phase 7 设置页实现）

## 十、同类项目调研（2026-08-05 完成）

结论：同类项目（mue、mtab、tab-harbor、bento、nightTab、markdown-new-tab 等）几乎都是"导航/效率/个性化"定位，活跃维护、完成度高，但**都没有把记账、健康（体重/疼痛）、饮食（食材/菜谱/采购）整合进新标签页**——这是本项目的差异化定位。

共性不足与我们的应对：
1. 数据备份弱 → 我们有 JSON 全量备份 + 新增记账 CSV 导出（src/utils/csv.ts）
2. 图标/壁纸依赖外网 → 快捷跳转补内置常用站图标库（计划 Task 2.6），背景支持纯色/渐变/图片 URL（计划 Task 7.3）
3. 搜索引擎少 → 预置 B站/抖音/知乎/淘宝站内搜索（settings.ts 默认引擎已更新）
4. 主题单一 → 新增浅色主题与背景设置（计划 Task 7.3）
5. 首页布局 → 借鉴 bento/mtab 的清爽网格卡片（视觉调整随 Phase 2 起落地）

详细分析见设计文档第十二节；实现计划末尾附"调研调整记录"。
