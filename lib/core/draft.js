/**
 * lib/core/draft.js — 设置页的"草稿 → 设置操作"纯逻辑（浏览器与 Node 共用）。
 *
 * 设置服务只接受 volatile 字段的 patch 操作：
 *   { op: 'set', path: [field], value }
 *   { op: 'unset', path: [field] }
 * 这里负责把"用户改过的草稿 vs 当前已接受值"折算成最小操作列表，
 * 保证点「保存/确认」时只写真正变化的字段。
 */

/** 设置页可编辑的字段（confirmed / importedFrom / importedAt 是只读元信息，不在此列）。 */
export const EDITABLE_FIELDS = [
  'agHome',
  'templateTask',
  'templateCategory',
  'templateTypeDir',
  'templateBatch',
  'templateFile',
  'typeDirs',
  'defaultExt',
  'dateFormat',
  'dateSource',
  'batchPolicy',
  'maxDepth',
  'stagingDir',
  'ignoreDirs',
  'verifyMaxIssues',
  'strictTypeDir',
]

/**
 * 稳定序列化：对象键排序，便于比较。
 * @param {unknown} value
 * @returns {string}
 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

/**
 * 深比较（按稳定序列化）。
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
export function sameValue(left, right) {
  return stableStringify(left) === stableStringify(right)
}

/**
 * 把设置描述里的 value 归一成草稿形状（补默认值，避免 undefined 输入框）。
 * @param {Record<string, any> | undefined} value
 * @returns {Record<string, any>}
 */
export function normalizeDraft(value) {
  const source = value ?? {}
  return {
    agHome: String(source.agHome ?? ''),
    templateTask: String(source.templateTask ?? '{workspace}'),
    templateCategory: String(source.templateCategory ?? '{category}'),
    templateTypeDir: String(source.templateTypeDir ?? '{typeDir}'),
    templateBatch: String(source.templateBatch ?? '{topic}_批次{batch}'),
    templateFile: String(source.templateFile ?? '{topic}[_{date}]_v{n}{ext}'),
    typeDirs: { ...(source.typeDirs ?? {}) },
    defaultExt: { ...(source.defaultExt ?? {}) },
    dateFormat: String(source.dateFormat ?? 'YYYYMMDD'),
    dateSource: source.dateSource ?? 'today',
    batchPolicy: source.batchPolicy ?? 'reuse',
    maxDepth: Number(source.maxDepth ?? 5),
    stagingDir: String(source.stagingDir ?? '.ag-staging'),
    ignoreDirs: Array.isArray(source.ignoreDirs) ? [...source.ignoreDirs] : [],
    verifyMaxIssues: Number(source.verifyMaxIssues ?? 50),
    strictTypeDir: source.strictTypeDir !== false,
    confirmed: source.confirmed === true,
    importedFrom: String(source.importedFrom ?? ''),
    importedAt: String(source.importedAt ?? ''),
  }
}

/**
 * 折算成设置操作列表。
 * @param {Record<string, any> | undefined} current - 已接受的配置值。
 * @param {Record<string, any>} draft - 草稿。
 * @param {string[]} [fields]
 * @returns {Array<{op: 'set'|'unset', path: string[], value?: unknown}>}
 */
export function diffOps(current, draft, fields = EDITABLE_FIELDS) {
  const ops = []
  for (const field of fields) {
    const before = current?.[field]
    const after = draft?.[field]
    if (sameValue(before, after)) continue
    if (after === undefined) ops.push({ op: 'unset', path: [field] })
    else ops.push({ op: 'set', path: [field], value: after })
  }
  return ops
}

/**
 * 用草稿构造类型目录列表（供表格渲染，保持插入顺序）。
 * @param {Record<string, string>} typeDirs
 * @returns {Array<{ type: string, dir: string }>}
 */
export function typeRows(typeDirs) {
  return Object.entries(typeDirs ?? {}).map(([type, dir]) => ({ type, dir: String(dir) }))
}
