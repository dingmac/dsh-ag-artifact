/**
 * lib/config.js — 插件配置 schema 与"生效配置"解析。
 *
 * 配置来源（优先级从高到低）：
 *   1. profile patch 里 `id: ag-artifact` 条目的 config（设置页写入的就是这里）；
 *   2. 回退：`agHome` 为空时读旧版 ~/.dsh/.ag-spec/ag_config.json 的 paths.AG_HOME。
 *
 * 关键约束：DSH 设置服务只允许写 **volatile** 字段（settings.mutate 会校验
 * `isVolatilePath`）。所以凡是设置页要改的字段都标了 `.volatile()`；
 * 只读的 `legacyConfigFile` 不标，避免出现在表单里被误改。
 */
import z from '@deepseek-ai/schemastery'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

/** 六个固定大类的默认映射：类型 → 目录名。 */
export const DEFAULT_TYPE_DIRS = {
  脚本: '脚本',
  报告: '报告',
  数据: '数据',
  截图: '截图',
  原型: '原型',
  参考: '参考',
}

/** 各类型默认扩展名。artifact_save 未给 ext 时使用。 */
export const DEFAULT_EXT = {
  脚本: '.py',
  报告: '.md',
  数据: '.csv',
  截图: '.png',
  原型: '.html',
  参考: '.md',
}

/**
 * schemastery `.volatile()` 字段在运行时是带 `.get()` 的引用对象（用于 Settings 热更新），
 * 普通字段是裸值。统一取值。
 * @param {unknown} value
 * @returns {unknown}
 */
export function unref(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    return value.get()
  }
  return value
}

/**
 * 展开 `~` 与 `~/xxx`。
 * @param {unknown} input
 * @returns {string}
 */
export function expandHome(input) {
  const raw = String(input ?? '').trim()
  if (raw === '~') return homedir()
  if (raw.startsWith('~/')) return join(homedir(), raw.slice(2))
  return raw
}

/**
 * 读取旧版 ag_config.json 的原始内容；读取或解析失败返回 undefined。
 * @param {unknown} file
 * @returns {Record<string, any> | undefined}
 */
export function readLegacyConfig(file) {
  const path = expandHome(file)
  if (!path) return undefined
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * 从旧版 ag_config.json 读取 paths.AG_HOME（只读，绝不改写旧文件）。
 * @param {unknown} file
 * @returns {string}
 */
export function loadLegacyAgHome(file) {
  return String(readLegacyConfig(file)?.paths?.AG_HOME ?? '').trim()
}

export const Config = z.object({
  agHome: z
    .string()
    .default('')
    .volatile()
    .description('产出根目录的绝对路径。留空时回退读取 legacyConfigFile 的 paths.AG_HOME。'),

  legacyConfigFile: z
    .string()
    .default('~/.dsh/.ag-spec/ag_config.json')
    .description('旧版 ag_config.json 路径；只在 agHome 留空时用于回退读取，设置页不可编辑。'),

  templateTask: z
    .string()
    .default('{workspace}')
    .volatile()
    .description('第 1 层模板：任务主文件夹。变量 {workspace}。'),

  templateCategory: z
    .string()
    .default('{category}')
    .volatile()
    .description('第 2 层模板：任务分类。变量 {category}。'),

  templateTypeDir: z
    .string()
    .default('{typeDir}')
    .volatile()
    .description('第 3 层模板：大类目录。变量 {typeDir}（由 typeDirs 映射得到）。'),

  templateBatch: z
    .string()
    .default('{topic}_批次{batch}')
    .volatile()
    .description('第 4 层模板：小类（版本容器）。变量 {topic} {batch}。'),

  templateFile: z
    .string()
    .default('{topic}[_{date}]_v{n}{ext}')
    .volatile()
    .description('第 5 层模板：文件名。必须含 {n}；变量 {topic} {date} {n} {ext}；方括号为可选段。'),

  typeDirs: z
    .dict(z.string())
    .default(DEFAULT_TYPE_DIRS)
    .volatile()
    .description('类型 → 大类目录名映射；可加 default 键作为未知类型的兜底目录。'),

  defaultExt: z
    .dict(z.string())
    .default(DEFAULT_EXT)
    .volatile()
    .description('类型 → 默认扩展名（artifact_save 未显式给 ext 时使用）。'),

  dateFormat: z
    .string()
    .default('YYYYMMDD')
    .volatile()
    .description('文件名日期格式，支持 YYYY MM DD HH mm ss。'),

  dateSource: z
    .union([z.const('today'), z.const('file-mtime'), z.const('none')])
    .default('today')
    .volatile()
    .description('文件名日期来源：today=当前时间；file-mtime=源文件修改时间；none=不写日期。'),

  batchPolicy: z
    .union([z.const('reuse'), z.const('new'), z.const('explicit')])
    .default('reuse')
    .volatile()
    .description('批次策略：reuse=复用最新批次；new=每次新建；explicit=必须显式给 batch。'),

  maxDepth: z.number().default(5).volatile().description('最大层级（含文件）。本规范固定为 5。'),

  stagingDir: z
    .string()
    .default('.ag-staging')
    .volatile()
    .description('会话工作区内的暂存目录名；脚本先把产物写这里，再用 artifact_place 移入。'),

  ignoreDirs: z
    .array(z.string())
    .default(['_archive', '_skeleton', '.DS_Store'])
    .volatile()
    .description('artifact_verify 跳过的顶层名称。'),

  verifyMaxIssues: z.number().default(50).volatile().description('artifact_verify 最多返回的问题条数。'),

  strictTypeDir: z
    .boolean()
    .default(true)
    .volatile()
    .description('第 3 层目录必须命中 typeDirs 里的值；关闭后允许任意大类目录名。'),

  confirmed: z
    .boolean()
    .default(false)
    .volatile()
    .description('设置页是否已经完成首次核对确认；未确认时页面处于审阅状态。'),

  importedFrom: z
    .string()
    .default('')
    .volatile()
    .description('首次启用时自动导入的旧配置文件路径（只读元信息）。'),

  importedAt: z
    .string()
    .default('')
    .volatile()
    .description('首次启用时自动导入的时间（ISO 8601，只读元信息）。'),
})

/**
 * 把插件 Config 解析成一份普通对象形式的"生效配置"，并做启动即失败的校验。
 * @param {Record<string, any>} config - Cordis 传入的原始配置（可能含 volatile 引用）。
 * @returns {Record<string, any>}
 */
export function effectiveConfig(config) {
  const cfg = {
    agHome: String(unref(config.agHome) ?? '').trim(),
    legacyConfigFile: unref(config.legacyConfigFile),
    templateTask: unref(config.templateTask),
    templateCategory: unref(config.templateCategory),
    templateTypeDir: unref(config.templateTypeDir),
    templateBatch: unref(config.templateBatch),
    templateFile: unref(config.templateFile),
    // 不在这里合并默认值：schema 的 .default() 已经补过缺省；
    // 用户删掉某个默认类型后，这里必须尊重删除结果（否则工具会继续用旧映射）。
    typeDirs: { ...(unref(config.typeDirs) ?? {}) },
    defaultExt: { ...(unref(config.defaultExt) ?? {}) },
    dateFormat: unref(config.dateFormat),
    dateSource: unref(config.dateSource),
    batchPolicy: unref(config.batchPolicy),
    maxDepth: Number(unref(config.maxDepth)),
    stagingDir: unref(config.stagingDir),
    ignoreDirs: [...(unref(config.ignoreDirs) ?? [])],
    verifyMaxIssues: Number(unref(config.verifyMaxIssues)),
    strictTypeDir: Boolean(unref(config.strictTypeDir)),
    confirmed: Boolean(unref(config.confirmed)),
    importedFrom: String(unref(config.importedFrom) ?? ''),
    importedAt: String(unref(config.importedAt) ?? ''),
  }

  if (!cfg.agHome) cfg.agHome = loadLegacyAgHome(cfg.legacyConfigFile)
  if (!cfg.agHome) {
    throw new Error(
      'ag-artifact: 未配置产出根目录。请在插件设置页填写 agHome，或让 legacyConfigFile 指向现有的 ag_config.json。',
    )
  }
  cfg.agHome = expandHome(cfg.agHome)
  if (!isAbsolute(cfg.agHome)) {
    throw new Error(`ag-artifact: agHome 必须是绝对路径，实际为 "${cfg.agHome}"`)
  }
  if (!Number.isInteger(cfg.maxDepth) || cfg.maxDepth < 5) {
    throw new Error('ag-artifact: maxDepth 必须是 >= 5 的整数（五层结构不可省略中间层）')
  }
  if (!cfg.templateFile.includes('{n}')) {
    throw new Error('ag-artifact: templateFile 必须包含 {n} 版本槽，否则无法分配版本号')
  }
  if (!cfg.templateBatch.includes('{batch}')) {
    throw new Error('ag-artifact: templateBatch 必须包含 {batch} 批次槽')
  }
  return cfg
}
