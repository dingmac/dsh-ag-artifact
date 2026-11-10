# dsh-ag-artifact

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dsh](https://img.shields.io/badge/dsh-%E2%89%A5%200.2.2--rc.1-blueviolet)](package.json)

DeepSeek Harness 的**产出物路径规范插件**：配置全局产出根目录与参数化五层目录规则，提供落盘工具，
以及一个**可视化设置页**（设置 → 产出规范）用于核对、编辑、试算和确认保存。

## 界面预览

浅色（首次接管后的审阅态）：

![设置页 · 浅色](preview/settings-light.png)

深色（已确认态）：

![设置页 · 深色](preview/settings-dark.png)

## 特性

- **全局根目录**：`agHome` 一处配置，工具与系统提示共用；留空可回退读取旧 `ag_config.json`。
- **参数化五层模板**：第 1–5 层各自是一个模板字符串，类型目录、日期、批次、版本号全部可配。
- **三个落盘工具**：`artifact_save`（文本直写）、`artifact_place`（搬入二进制/脚本产物）、`artifact_verify`（结构自查）。
- **Host 内写盘**：不经过会话文件沙箱，产出根目录在工作区之外也能落盘。
- **可视化设置页**：状态、规则、类型目录、策略、路径试算、确认保存，深色/浅色自适应。
- **可审计的设计**：从不修改旧配置文件；所有配置写入都走 DSH 设置服务（profile patch）。

## 状态机（核心行为契约）

| 状态 | 工具 | 系统提示 | 设置页 | 对配置的影响 |
|---|---|---|---|---|
| 未安装 | 无 | 无 | 无 | 无 |
| 已安装·**未启用**（默认） | 无 | 无 | 无 | 不读写任何配置；现有工作流完全不受影响 |
| 已启用·**审阅中** | 有 | 有 | 显示「待确认」横幅 | 首次启用时从旧 `ag_config.json` **只读接管**；旧文件不改 |
| 已启用·**已确认** | 有 | 有 | 正常编辑 | 点「确认并启用」后写入 `confirmed: true` |

- 安装 ≠ 生效：bundle patch 里插入的行默认 `disabled: true`，必须在插件管理器里手动启用。
- 停用只改这一行的 `disabled`：配置、产出目录、旧 `ag_config.json` 都保留；不迁移、不清理、不改路径。
- 插件从不修改配置文件之外的任何东西；所有配置写入都走 DSH 设置服务（profile patch）。

## 架构

```
dsh-ag-artifact/
├── package.json          # bundle 声明：dsh.bundle.patch + dsh.client（platform: web）
├── cordis.patch.yml      # 插入 ag-artifact 行，默认 disabled: true
├── lib/                  # Host 半侧
│   ├── index.js          # 入口：工具 + 提示段 + 关闭自动表单 + 首次接管
│   ├── config.js         # schemastery Config（可编辑字段全部 volatile）+ effectiveConfig
│   ├── adopt.js          # 旧 ag_config.json → 插件配置（只写 profile patch）
│   ├── path.js           # Host 路径解析（扫描批次/版本）
│   ├── tools.js          # artifact_save / artifact_place / artifact_verify
│   ├── prompt.js         # 系统提示段
│   ├── verify.js         # 五层结构自查
│   ├── client.js         # 浏览器 bundle（CI 从 client/ 源码构建）
│   └── core/             # 浏览器与 Node 共用纯逻辑（零 node: 依赖）
│       ├── text.js       # 段名清洗、模板渲染、日期格式化、校验
│       ├── preview.js    # 路径试算
│       └── draft.js      # 草稿 → settings 操作、稳定比较
├── client/               # 浏览器半侧（React）
│   ├── index.jsx         # 注册 settings.section；订阅 configForms
│   └── page.jsx          # 「产出规范」页：状态 / 规则 / 类型目录 / 策略 / 试算 / 保存
├── scripts/
│   ├── build-client.mjs  # esbuild → DSH ModuleLoader 格式 bundle
│   ├── check-client.mjs  # 不需要浏览器：校验 bundle 契约 + SSR 渲染
│   ├── preview.mjs       # 用真实组件生成设置页预览 HTML
│   ├── screenshot.mjs    # 预览 HTML → PNG（CI 用预装 Chrome）
│   └── migrate.mjs       # 旧配置 → 配置片段（备用）
├── preview/              # 设置页截图（CI 生成）
└── test/                 # 47 条单测
```

浏览器 bundle 的构建：`esbuild` 打成 CJS，再包一层
`window.__ModuleLoader__.load({ id, factory: (require) => … })`；`react` / `react/jsx-runtime`
作为平台外部依赖由宿主注入（与第一方页面一致）。

## 设置页

`设置 → 产出规范`，分六块：

1. **当前状态**：已确认/审阅中、产出根目录、配置来源。
2. **路径样例**：实时预览 + 复制路径。
3. **目录规则（固定五层）**：五个模板输入框（方括号为可选段，必须含 `{n}`）。
4. **类型目录**：类型 ↔ 大类目录 ↔ 默认扩展名的可增删表格。
5. **策略**：日期来源/格式、批次策略、层级、暂存目录、忽略目录、自查上限、严格类型目录。
6. **路径试算**：填任务/分类/类型/主题，实时显示五层路径（不写盘）。

保存走 `configForms` 的 `mutate(ops, revision)`：只提交真正变化的字段，修订号不一致时保留草稿并提示，
不会静默覆盖其他窗口的修改。

## 使用说明

安装并启用后，日常不需要手动建目录——把规则交给插件，按下面三步走：

1. **文本产出**（`.md/.py/.sh/.html/.json/.csv`）→ 调用 `artifact_save`，自动清洗段名、分配 `_vN+1`。
2. **脚本 / 二进制产出**（`.xlsx/.png/.pdf` 等）→ 先写到会话工作区的 `.ag-staging/`，再用 `artifact_place` 移入（默认移动，不留副本）。
3. **收尾** → `artifact_verify` 自查，再对最终文件调用 `present` 交付。

调用示例：

```json
// 1) 文本产出直接落盘
artifact_save({
  "type": "报告", "category": "库存对账", "topic": "差异分析",
  "content": "# 差异分析\n..."
})

// 2) 先看落点（不写盘）
artifact_save({ "type": "报告", "category": "库存对账", "topic": "差异分析", "content": "x", "dry_run": true })

// 3) 把脚本生成的 xlsx 搬入正式路径
artifact_place({
  "source_path": ".ag-staging/塞艾斯库存比对.xlsx",
  "type": "数据", "category": "库存对账", "topic": "塞艾斯库存比对"
})

// 4) 五层结构自查
artifact_verify({})
```

行为约定：

- **版本只增不改**：目标已存在自动 +1；显式传已存在的 `version` 会**拒绝覆盖**。
- **批次**：`reuse` 复用该主题最新批次，`new` 每次新建，`explicit` 必须显式给 `batch`。
- **暂存目录**默认 `.ag-staging`，交付前清空；不要用 `bash` 直接写产出根目录（会被会话文件沙箱拒绝）。
- **版本号按主题计**：同一小类目录里的同一主题跨天仍递增，不会每天从 v1 重开。

配置速查：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `agHome` | `''` | 产出根目录绝对路径；空则回退 `legacyConfigFile` |
| `templateTask` `templateCategory` `templateTypeDir` `templateBatch` `templateFile` | 五层默认模板 | 每层一个模板；文件名必须含 `{n}` |
| `typeDirs` | 脚本/报告/数据/截图/原型/参考 | 类型 → 大类目录；可加 `default` 兜底 |
| `defaultExt` | 按类型 | `artifact_save` 缺省扩展名 |
| `dateSource` / `dateFormat` | `today` / `YYYYMMDD` | 文件名日期来源与格式 |
| `batchPolicy` | `reuse` | `reuse` / `new` / `explicit` |
| `stagingDir` | `.ag-staging` | 会话工作区内的暂存目录 |
| `strictTypeDir` | `true` | 第 3 层必须命中类型目录 |

## 安装与启用

1. 插件目录先装依赖（仅两个公开包 + esbuild/react 开发依赖）：

```bash
NODE="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node"
PNPM="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs"
"$NODE" "$PNPM" install
"$NODE" scripts/build-client.mjs   # 产出 lib/client.js
```

2. 通过插件管理器安装本地 bundle（`target` 传本目录绝对路径），安装后默认 **不启用**。
3. 在「插件」页启用 `dsh-ag-artifact`。首次启用会自动：
   - 读取 `~/.dsh/.ag-spec/ag_config.json` 的 `paths.AG_HOME`、`type_dirs`、`date_format`；
   - 写入 profile 的 `cordis.patch.yml`（`confirmed: false`）；
   - 旧文件不动。
4. 打开 `设置 → 产出规范`，核对路径与规则 → 点「确认并启用」。
5. 之后每次改配置都是「编辑草稿 → 保存」，可随时点「还原」。

也可以用插件管理器安装 Git 版本：

```bash
dsh plugin --profile web add github:dingmac/dsh-ag-artifact
```

## 开发命令

```bash
NODE="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node"

"$NODE" scripts/build-client.mjs    # 构建 lib/client.js
"$NODE" scripts/check-client.mjs    # bundle 契约 + SSR 冒烟（无需浏览器）
"$NODE" --test test/*.test.mjs      # 47 条单测
"$NODE" scripts/preview.mjs         # 生成 UI 预览 HTML
"$NODE" scripts/screenshot.mjs      # 预览 HTML → PNG
```

CI（GitHub Actions）会在每次推送时构建 bundle、跑语法检查、bundle 契约检查与全部单测，
并重新生成 `preview/*.png` 截图后自动提交。

## 已验证 / 待验证

**已在本机验证（2026-11-10）**

- 构建链：esbuild → ModuleLoader 外壳，产物约 54 KiB；bundle 契约校验通过。
- 组件：`react-dom/server` 渲染出全部六个区块。
- Host 装配：三个工具、提示段、`settings.configure({ auto: false })` 均注册成功。
- 首次接管：用临时 `DSH_HOME` 真实启动 Web profile，`configEditor` 成功把旧配置写进 profile patch
  （`agHome` / `typeDirs` / `dateFormat` / `importedFrom` / `confirmed: false`）。
- 客户端装载：启动图里出现 `dsh-ag-artifact` 模块，依赖解析通过；`/plugins/??dsh-ag-artifact/client.js` 返回 200。
- 单测 47 条全绿；GitHub Actions 语法检查、bundle 契约检查、单测全部通过。

**待验证（需要安装到当前 profile 并在浏览器里看一次）**

- 设置页在真实 GUI 里的视觉效果与交互（槽位、样式、国际化）。
- 「确认并启用 / 保存 / 还原」与 settings revision 的实际交互。
- 端到端：设置页改规则 → 模型调用 `artifact_save` 落盘到新路径。

## 发布到插件市场

仓库已提交 dsh.so 插件市场（<https://www.dsh.so/submit/>），当前状态 **Declared（待维护者合并）**。
提交入口接受 Git 仓库地址或 npm 包名；本包满足其验收条件（`dsh` 声明、README、MIT、插件 id、可扫描源码）。
详见 [SUBMIT.md](SUBMIT.md)。

## English summary

`dsh-ag-artifact` is a DeepSeek Harness plugin that enforces a configurable five-level artifact layout:
a global output root, per-layer path templates, type→directory mapping, batch/version policies, and a
visual settings page with live path preview and confirm-to-save. It ships three model tools
(`artifact_save`, `artifact_place`, `artifact_verify`), writes artifacts from the host process (outside the
session sandbox), and never modifies your existing config files. Installed bundles are disabled by
default; on first enable the plugin adopts the legacy `ag_config.json` read-only and asks you to review
and confirm in Settings → 产出规范. MIT licensed.

## 回滚

插件管理器里停用即可：不注册工具、不注入提示、不再写任何东西；配置与产出目录保留。
彻底卸载：插件管理器移除 bundle，并删除 profile `cordis.patch.yml` 里的 `ag-artifact` 行。
插件从不修改旧 `ag_config.json`，回滚无需数据修复。
