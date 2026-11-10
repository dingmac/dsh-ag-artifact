# 上传到 dsh.so 插件市场

当前使用的插件市场索引：

- `https://cdn.dsh.so/market/index.json`（全量、安装实测）
- `https://cdn.dsh.so/market/top-rank.json`（榜单）
- `https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json`

dsh.so 不是托管仓库：它的提交入口是 <https://www.dsh.so/submit/>，**接受一个 Git 仓库地址或 npm 包名**，
拉取后校验格式、跑安全扫描、生成索引条目。所以"上传"= 先把源码放进一个公开仓库（或发布 npm 包），再提交地址。

> 本机没有 GitHub 登录态（`gh` 未安装、无 npm token、keychain 无 github.com 凭据），
> 因此最后一步需要你的账号。下面三条路径任选其一。

## 路径 A：GitHub 仓库（推荐）

仓库名必须是 `dsh-ag-artifact`（市场要求 id 匹配 `^[a-z0-9]+(-[a-z0-9]+)*$`）。

```bash
cd /Volumes/NASData/dingmac/Deepseek\ H/范式转移/plugins/dsh-ag-artifact

git init -b main
git add -A
git commit -m "feat: dsh-ag-artifact 0.1.0 — AG 产出物规范插件（Host + 可视化设置页）"

# 在 GitHub 建一个空仓库 dsh-ag-artifact 后：
git remote add origin https://github.com/<你的账号>/dsh-ag-artifact.git
git push -u origin main
```

然后二选一：

1. 打开 <https://www.dsh.so/submit/>，粘贴 `https://github.com/<你的账号>/dsh-ag-artifact`；
2. 或给仓库加 topic `dsh-plugin`，dsh.so 会自动发现（审核 24 小时内完成 L1–L2）。

## 路径 B：npm 包

```bash
cd /Volumes/NASData/dingmac/Deepseek\ H/范式转移/plugins/dsh-ag-artifact

# 方式一：本机有 npm（node 发行版自带）
npm login
npm publish --access public

# 方式二：用 DSH 自带 pnpm（先在 ~/.npmrc 写入 registry token）
#   //registry.npmjs.org/:_authToken=<你的 npm token>
NODE="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node"
PNPM="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs"
"$NODE" "$PNPM" publish --access public
```

发布后到 <https://www.dsh.so/submit/> 粘贴包名 `dsh-ag-artifact`。

## 路径 C：我代传

需要你提供二选一：

- 一个已经建好的**空 GitHub 仓库地址** + 有 `repo` 权限的临时 token（我 push 并提交）；或
- 已 push 好的仓库 URL（我负责跑 dsh.so 的检查并提交，若页面要求登录则你在页面点提交）。

把地址发我即可，其余我来。

## 提交前对照（dsh.so 的验收条件）

| 条件 | 本插件 |
|---|---|
| DSH 兼容信号 | ✅ `package.json` 有 `dsh.bundle.patch` + `dsh.client` |
| README 含安装说明 | ✅ 见 `README.md`「安装与启用」 |
| SPDX 许可证 | ✅ MIT（`LICENSE` + `package.json`） |
| 插件 id 合法 | ✅ `dsh-ag-artifact` |
| 可扫描源码 | ✅ `lib/**/*.js`、`client/*.jsx` |
| 安全扫描 | ⚠️ 插件按设计会写文件、并在 `artifact_place` 中删除源文件；代码与 README 已写明这是显式操作。若被判 warning，需要人工复核。 |

## 本地包（不安装也能验证）

```bash
NODE="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node"
PNPM="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs"

mkdir -p /tmp/ag-check && cd /tmp/ag-check
printf '{"name":"ag-check","private":true}\n' > package.json
"$NODE" "$PNPM" add /Volumes/NASData/dingmac/Deepseek\ H/范式转移/plugins/dsh-ag-artifact/dsh-ag-artifact-0.1.0.tgz
"$NODE" --input-type=module -e "const m = await import('dsh-ag-artifact'); console.log(Object.keys(m), m.name)"
```

## 下架

删除/归档仓库，或从 npm 撤回版本；dsh.so 下次刷新索引即移除。
