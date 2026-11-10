/**
 * lib/path.js — Host 侧路径逻辑：在 core 纯规则之上增加目录扫描（批次/版本）与目标解析。
 *
 * 浏览器设置页复用 lib/core/ 里的同名规则，因此预览与真实落盘行为一致。
 */
import { readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { formatDate, normalizeExt, renderTemplate, sanitizeFileName, sanitizeSegment } from './core/text.js'

export { formatDate, normalizeExt, renderTemplate, sanitizeFileName, sanitizeSegment }

/**
 * 在目录里扫描某个模板槽位的最大数字。
 * 例：模板 `{topic}_批次{batch}`、slot=batch，返回已有最大批次号；目录不存在返回 0。
 * @param {string} dir
 * @param {string} template
 * @param {string} slot
 * @param {Record<string, unknown>} vars
 * @returns {number}
 */
export function scanMaxSlot(dir, template, slot, vars) {
  const token = `{${slot}}`
  const index = template.indexOf(token)
  if (index < 0) throw new Error(`模板必须包含 ${token}：${template}`)
  const pre = renderTemplate(template.slice(0, index), vars)
  const postTemplate = template.slice(index + token.length)

  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return 0
  }

  let max = 0
  for (const name of entries) {
    if (!name.startsWith(pre)) continue
    const rest = name.slice(pre.length)
    const matched = /^(\d+)(.*)$/.exec(rest)
    if (!matched) continue
    const post = renderTemplate(postTemplate, { ...vars, ext: extname(name) })
    if (matched[2] !== post) continue
    const value = Number(matched[1])
    if (Number.isSafeInteger(value) && value > max) max = value
  }
  return max
}

/**
 * 版本号按"同一个小类目录内的同一个主题"递增，与日期无关。
 * @param {string} dir
 * @param {string} topic
 * @returns {number}
 */
export function nextVersionForTopic(dir, topic) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return 1
  }
  let max = 0
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const name = entry.name
    const sameTopic =
      name === topic ||
      name.startsWith(`${topic}_`) ||
      name.startsWith(`${topic}-`) ||
      name.startsWith(`${topic}.`) ||
      name.startsWith(`${topic}（`)
    if (!sameTopic) continue
    const matched = /_v(\d+)(?:\.[^.]+)?$/.exec(name)
    if (matched) max = Math.max(max, Number(matched[1]))
  }
  return max + 1
}

/**
 * 决定文件名里的日期串。
 * @param {{ dateSource: string, dateFormat: string }} cfg
 * @param {string} [sourcePath]
 * @returns {string}
 */
export function dateFor(cfg, sourcePath) {
  if (cfg.dateSource === 'none') return ''
  let date = new Date()
  if (cfg.dateSource === 'file-mtime' && sourcePath) {
    try {
      const mtime = statSync(sourcePath).mtime
      if (mtime instanceof Date && !Number.isNaN(mtime.getTime())) date = mtime
    } catch {
      /* 源文件不可 stat 时退回当前时间 */
    }
  }
  return formatDate(date, cfg.dateFormat)
}

/**
 * 解析一次落盘请求的最终目标路径与版本号（Host 侧，会读目录）。
 * @param {object} cfg - effectiveConfig() 的结果。
 * @param {object} req
 * @returns {{
 *   workspace: string, category: string, typeDir: string, topic: string,
 *   batch: number, batchDirName: string, dir: string, fileName: string,
 *   filePath: string, version: number, date: string, ext: string, warnings: string[]
 * }}
 */
export function resolveTarget(cfg, req) {
  const warnings = []

  const typeKey = String(req.type ?? '').trim()
  if (!typeKey) throw new Error('artifact: 缺少 type（产出类型）')
  const mappedTypeDir = cfg.typeDirs?.[typeKey] ?? cfg.typeDirs?.default
  if (cfg.strictTypeDir && mappedTypeDir === undefined) {
    const known = Object.keys(cfg.typeDirs ?? {}).filter((key) => key !== 'default').join('/')
    throw new Error(`artifact: 未知产出类型 "${typeKey}"。已配置类型：${known}；也可在 typeDirs.default 指定兜底目录。`)
  }

  const workspaceName = sanitizeSegment(renderTemplate(cfg.templateTask, {
    workspace: sanitizeSegment(req.task),
    task: sanitizeSegment(req.task),
  }))
  const categoryName = sanitizeSegment(renderTemplate(cfg.templateCategory, {
    category: sanitizeSegment(req.category),
  }))
  const typeDirName = sanitizeSegment(renderTemplate(cfg.templateTypeDir, {
    typeDir: sanitizeSegment(mappedTypeDir ?? typeKey),
  }))
  const topic = sanitizeSegment(req.topic)
  const typeRoot = join(cfg.agHome, workspaceName, categoryName, typeDirName)

  let batch
  if (req.batch !== undefined && req.batch !== null) {
    batch = Number(req.batch)
    if (!Number.isSafeInteger(batch) || batch < 1) throw new Error('artifact: batch 必须是 >= 1 的整数')
  } else {
    const maxBatch = scanMaxSlot(typeRoot, cfg.templateBatch, 'batch', { topic })
    if (cfg.batchPolicy === 'new') batch = Math.max(1, maxBatch + 1)
    else if (cfg.batchPolicy === 'explicit') throw new Error('artifact: batchPolicy=explicit 时必须显式提供 batch')
    else batch = Math.max(1, maxBatch)
  }

  const batchDirName = sanitizeSegment(renderTemplate(cfg.templateBatch, { topic, batch }))
  const dir = join(typeRoot, batchDirName)
  const ext = normalizeExt(req.ext, cfg.defaultExt, typeKey)
  const date = req.date !== undefined && req.date !== null ? String(req.date) : dateFor(cfg, req.sourcePath)

  let version
  if (req.version !== undefined && req.version !== null) {
    version = Number(req.version)
  } else if (cfg.templateFile.includes('{topic}')) {
    version = nextVersionForTopic(dir, topic)
  } else {
    // 文件名模板不含主题时退回模板精确匹配（日期参与匹配）。
    version = scanMaxSlot(dir, cfg.templateFile, 'n', { topic, date, ext }) + 1
  }
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('artifact: version 必须是 >= 1 的整数')

  const fileName = sanitizeFileName(renderTemplate(cfg.templateFile, { topic, date, n: version, ext }))
  if (!fileName || fileName.startsWith('.')) throw new Error(`artifact: 文件名模板渲染结果非法："${fileName}"`)

  const segments = [workspaceName, categoryName, typeDirName, batchDirName, fileName]
  if (segments.some((segment) => /\s/.test(segment))) {
    throw new Error('artifact: 路径段仍含空格，请检查模板')
  }

  return {
    workspace: workspaceName,
    category: categoryName,
    typeDir: typeDirName,
    topic,
    batch,
    batchDirName,
    dir,
    fileName,
    filePath: join(dir, fileName),
    version,
    date,
    ext,
    warnings,
  }
}

/** 供设置页与 Host 共用的模板自检。 */
export { validateTemplates } from './core/text.js'
