/**
 * lib/core/text.js — 浏览器与 Node 共用的纯文本规则（零依赖、零 node: 内置模块）。
 *
 * 客户端设置页的"路径试算"与 Host 落盘共用同一套清洗/模板逻辑，
 * 避免预览与真实落盘出现两套行为。
 */

/** 跨平台文件名禁用字符 + 控制字符。 */
const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g

/** 目录段最大长度。 */
const MAX_SEGMENT = 64

/**
 * 取扩展名（浏览器安全版本，替代 node:path.extname）。
 * @param {string} name
 * @returns {string}
 */
export function extnameOf(name) {
  const value = String(name ?? '')
  const index = value.lastIndexOf('.')
  if (index <= 0 || index === value.length - 1) return ''
  return value.slice(index)
}

/**
 * 清洗一个目录段：去禁用字符、空格转下划线、折叠重复下划线、去首尾点/下划线。
 * @param {unknown} input
 * @param {{ fallback?: string, stripSpaces?: boolean }} [options]
 * @returns {string}
 */
export function sanitizeSegment(input, { fallback = '未命名', stripSpaces = true } = {}) {
  let value = String(input ?? '')
    .normalize('NFC')
    .replace(FORBIDDEN, '')
  if (stripSpaces) value = value.replace(/\s+/g, '_')
  value = value
    .replace(/_{2,}/g, '_')
    .replace(/^[.\s_]+|[.\s_]+$/g, '')
  if (!value) value = fallback
  return value.slice(0, MAX_SEGMENT)
}

/**
 * 清洗文件名：保留扩展名，其余同目录段规则。
 * @param {unknown} input
 * @param {{ fallback?: string }} [options]
 * @returns {string}
 */
export function sanitizeFileName(input, { fallback = '未命名' } = {}) {
  const raw = String(input ?? '').normalize('NFC')
  const rawExt = extnameOf(raw)
  const ext = rawExt.replace(FORBIDDEN, '').replace(/\s+/g, '')
  let base = raw.slice(0, raw.length - rawExt.length).replace(FORBIDDEN, '')
  base = base
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[.\s_]+|[.\s_]+$/g, '')
  if (!base) base = fallback
  return (base.slice(0, MAX_SEGMENT) + ext).replace(/\.{2,}/g, '.')
}

/**
 * 渲染模板。支持两种语法：
 *   {name}        —— 必填变量
 *   [{name}...]   —— 可选段：段内引用的变量全部非空时保留，否则整段丢弃
 * 未提供的变量原样保留（便于识别配置错误）。
 * @param {string} template
 * @param {Record<string, unknown>} vars
 * @returns {string}
 */
export function renderTemplate(template, vars = {}) {
  const withOptional = String(template).replace(/\[([^[\]]*)\]/g, (_, inner) => {
    const names = [...inner.matchAll(/\{(\w+)\}/g)].map((match) => match[1])
    const keep = names.every((name) => {
      const value = vars[name]
      return value !== undefined && value !== null && String(value) !== ''
    })
    return keep ? inner : ''
  })
  return withOptional.replace(/\{(\w+)\}/g, (match, name) => {
    const value = vars[name]
    return value === undefined || value === null ? match : String(value)
  })
}

const pad2 = (value) => String(value).padStart(2, '0')

/**
 * 按 YYYY/MM/DD/HH/mm/ss 渲染日期。
 * @param {Date | undefined | null} date
 * @param {string} [format]
 * @returns {string}
 */
export function formatDate(date, format = 'YYYYMMDD') {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return String(format)
    .replace(/YYYY/g, String(date.getFullYear()))
    .replace(/MM/g, pad2(date.getMonth() + 1))
    .replace(/DD/g, pad2(date.getDate()))
    .replace(/HH/g, pad2(date.getHours()))
    .replace(/mm/g, pad2(date.getMinutes()))
    .replace(/ss/g, pad2(date.getSeconds()))
}

/**
 * 归一化扩展名：`md` / `.md` / `.MD` 都变成 `.md`。
 * @param {string | undefined} ext
 * @param {Record<string, string>} defaultExt
 * @param {string} type
 * @returns {string}
 */
export function normalizeExt(ext, defaultExt, type) {
  let value = String(ext ?? '').trim()
  if (!value) value = String(defaultExt?.[type] ?? defaultExt?.default ?? '.dat')
  value = value.replace(/^\.+/, '').replace(/[^A-Za-z0-9]/g, '')
  return value ? `.${value.toLowerCase()}` : '.dat'
}

/**
 * 校验模板字面量是否自洽（供设置页实时提示）。
 * @param {{ templateFile?: string, templateBatch?: string, maxDepth?: number }} cfg
 * @returns {string[]} 错误列表，空数组表示通过
 */
export function validateTemplates(cfg) {
  const errors = []
  if (!String(cfg.templateFile ?? '').includes('{n}')) errors.push('文件名模板必须包含 {n} 版本槽')
  if (!String(cfg.templateBatch ?? '').includes('{batch}')) errors.push('小类模板必须包含 {batch} 批次槽')
  if (!Number.isInteger(cfg.maxDepth) || Number(cfg.maxDepth) < 5) errors.push('层级必须 >= 5')
  return errors
}

/**
 * 把带 `{token}` / `[可选段]` 的模板编译成正则（供 artifact_verify 按实际模板校验）。
 * @param {string} template
 * @param {Record<string, string>} patterns - token → 正则片段，例如 { topic: '.+', batch: '\\d+' }
 * @returns {RegExp}
 */
export function templateToRegex(template, patterns = {}) {
  const escape = (char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const build = (text) => {
    let source = ''
    let index = 0
    while (index < text.length) {
      const char = text[index]
      if (char === '[') {
        const end = text.indexOf(']', index + 1)
        if (end > index) {
          source += `(?:${build(text.slice(index + 1, end))})?`
          index = end + 1
          continue
        }
      }
      if (char === '{') {
        const end = text.indexOf('}', index + 1)
        if (end > index) {
          const token = text.slice(index + 1, end)
          source += patterns[token] ?? '[^/]+'
          index = end + 1
          continue
        }
      }
      source += escape(char)
      index += 1
    }
    return source
  }
  return new RegExp(`^${build(String(template))}$`)
}
