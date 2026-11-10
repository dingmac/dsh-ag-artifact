#!/usr/bin/env node
/**
 * scripts/migrate.mjs — 把旧版 ag_config.json 转成插件配置片段（只读旧文件，不写任何东西）。
 *
 * 用法：
 *   node scripts/migrate.mjs                         # 读 ~/.dsh/.ag-spec/ag_config.json
 *   node scripts/migrate.mjs /path/to/ag_config.json # 指定文件
 *
 * 输出：一段可直接贴进 profile 的 cordis.patch.yml 的配置条目。
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_PATH = join(homedir(), '.dsh', '.ag-spec', 'ag_config.json')
const file = process.argv[2] ?? DEFAULT_PATH

let legacy
try {
  legacy = JSON.parse(readFileSync(file, 'utf8'))
} catch (error) {
  console.error(`读取失败：${file}\n${error.message}`)
  process.exit(1)
}

const agHome = legacy?.paths?.AG_HOME
if (!agHome) {
  console.error(`${file} 里没有 paths.AG_HOME，无法迁移。`)
  process.exit(1)
}

const typeDirs = Array.isArray(legacy?.type_dirs) && legacy.type_dirs.length > 0
  ? Object.fromEntries(legacy.type_dirs.map((name) => [name, name]))
  : { 脚本: '脚本', 报告: '报告', 数据: '数据', 截图: '截图', 原型: '原型', 参考: '参考' }

const indent = '      '
const lines = [
  '# 把下面这段合并进 profile 的 cordis.patch.yml（~/.dsh/profiles/<profile>/cordis.patch.yml）',
  '# 注意：agHome 用单引号包住，路径里有空格也没问题。',
  '- id: ag-artifact',
  "  name: 'dsh-ag-artifact'",
  '  config:',
  `    agHome: '${agHome}'`,
  '    typeDirs:',
  ...Object.entries(typeDirs).map(([key, value]) => `${indent}${key}: '${value}'`),
  `    dateFormat: '${legacy?.naming?.date_format ?? 'YYYYMMDD'}'`,
  "    batchPolicy: 'reuse'",
  '    maxDepth: 5',
]

console.log(lines.join('\n'))
console.log('')
console.log(`# 旧配置来源：${file}`)
console.log(`# 提示：paths.SKILL_BACKUP、forbidden_path_tokens 等字段本插件暂不使用，旧文件可以原样保留作备份。`)
