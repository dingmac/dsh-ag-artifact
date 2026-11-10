# dsh-ag-artifact

DeepSeek Harness 的**产出物路径规范插件**：配置全局产出根目录与参数化五层目录规则，提供落盘工具，
以及一个**可视化设置页**（设置 → 产出规范）用于核对、编辑、试算和确认保存。

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
│   └── migrate.mjs       # 旧配置 → 配置片段（备用）
└── test/                 # 47 条单测
```

浏览器 bundle 的构建：`esbuild` 打成 CJS，再包一层
`window.__ModuleLoader__.load({ id, factory: (require) => … })`；`react` / `react/jsx-runtime`
作为平台外部依赖由宿主注入（与第一方页面一致）。

## 设置页

`设置 → 产出规范`，分六块：

1. **当前状态**：已确认/审阅中、产出根目录、实时路径样例。
2. **目录规则（固定五层）**：五个模板输入框（方括号为可选段，必须含 `{n}`）。
3. **类型目录**：类型 ↔ 大类目录 ↔ 默认扩展名的可增删表格。
4. **策略**：日期来源/格式、批次策略、层级、暂存目录、忽略目录、自查上限、严格类型目录。
5. **路径试算**：填任务/分类/类型/主题，实时显示五层路径（不写盘）。
6. **底部操作**：还原 / 保存（审阅态显示「确认并启用」）。

保存走 `configForms` 的 `mutate(ops, revision)`：只提交真正变化的字段，修订号不一致时保留草稿并提示，
不会静默覆盖其他窗口的修改。

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

## 开发命令

```bash
NODE="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node"

"$NODE" scripts/build-client.mjs    # 构建 lib/client.js
"$NODE" scripts/check-client.mjs    # bundle 契约 + SSR 冒烟（无需浏览器）
"$NODE" --test test/*.test.mjs      # 47 条单测
"$NODE" scripts/preview.mjs         # 生成 UI 预览 HTML（preview/，可直接截图）
```

## 已验证 / 待验证

**已在本机验证（2026-11-10）**

- 构建链：esbuild → ModuleLoader 外壳，产物 40 KiB；bundle 契约校验通过。
- 组件：`react-dom/server` 渲染出全部六个区块（8.9 KiB HTML）。
- Host 装配：三个工具、提示段、`settings.configure({ auto: false })` 均注册成功。
- 首次接管：用临时 `DSH_HOME` 真实启动 Web profile，`configEditor` 成功把旧配置写进 profile patch
  （`agHome` / `typeDirs` / `dateFormat` / `importedFrom` / `confirmed: false`）。
- 客户端装载：启动图里出现 `dsh-ag-artifact` 模块，`inject: ["@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-ui-settings"]` 解析通过；
  `/plugins/??dsh-ag-artifact/client.js` 返回 200。
- 单测 47 条全绿。

**待验证（需要安装到当前 profile 并在浏览器里看一次）**

- 设置页在真实 GUI 里的视觉效果与交互（槽位、样式、国际化）。
- 「确认并启用 / 保存 / 还原」与 settings revision 的实际交互。
- 端到端：设置页改规则 → 模型调用 `artifact_save` 落盘到新路径。

## 发布到插件市场

见 [SUBMIT.md](SUBMIT.md)。dsh.so 的提交入口是 <https://www.dsh.so/submit/>，接受 Git 仓库地址或 npm 包名；
本包已满足其验收条件（`dsh` 声明、README、MIT、插件 id、可扫描源码）。

## 回滚

插件管理器里停用即可：不注册工具、不注入提示、不再写任何东西；配置与产出目录保留。
彻底卸载：插件管理器移除 bundle，并删除 profile `cordis.patch.yml` 里的 `ag-artifact` 行。
插件从不修改旧 `ag_config.json`，回滚无需数据修复。
