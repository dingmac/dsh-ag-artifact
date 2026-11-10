/**
 * lib/core/preview.js — 浏览器与 Node 共用的"路径试算"（不访问文件系统）。
 *
 * 设置页用它实时预览一条产出会落到哪里；Host 侧真正的 resolveTarget 还会
 * 扫描目录得到批次号与下一个版本号，预览则用占位值（批次 1 / 版本 1）。
 */
import {
  formatDate,
  normalizeExt,
  renderTemplate,
  sanitizeFileName,
  sanitizeSegment,
} from './text.js'

const trimTrailingSlashes = (value) => String(value ?? '').replace(/[\\/]+$/, '')

/**
 * 试算目标路径。
 * @param {Record<string, any>} cfg - 与 effectiveConfig 同形状的普通对象。
 * @param {{
 *   task?: string, category?: string, type?: string, topic?: string,
 *   batch?: number, version?: number, date?: string, ext?: string, now?: Date
 * }} [req]
 * @returns {{
 *   root: string, workspace: string, category: string, typeDir: string,
 *   batchDir: string, fileName: string, segments: string[], path: string, relative: string
 * }}
 */
export function previewPath(cfg, req = {}) {
  const typeDirs = cfg.typeDirs ?? {}
  const type = String(req.type ?? Object.keys(typeDirs).find((key) => key !== 'default') ?? '报告')
  const typeDir = sanitizeSegment(renderTemplate(cfg.templateTypeDir ?? '{typeDir}', {
    typeDir: sanitizeSegment(typeDirs[type] ?? typeDirs.default ?? type),
  }))
  const workspaceName = sanitizeSegment(req.task ?? '当前工作区')
  const workspace = sanitizeSegment(renderTemplate(cfg.templateTask ?? '{workspace}', {
    workspace: workspaceName,
    task: workspaceName,
  }))
  const category = sanitizeSegment(renderTemplate(cfg.templateCategory ?? '{category}', {
    category: sanitizeSegment(req.category ?? '任务分类'),
  }))
  const topic = sanitizeSegment(req.topic ?? '交付主题')
  const batch = Number.isSafeInteger(req.batch) && req.batch > 0 ? req.batch : 1
  const batchDir = sanitizeSegment(renderTemplate(cfg.templateBatch ?? '{topic}_批次{batch}', { topic, batch }))
  const date =
    req.date ??
    (cfg.dateSource === 'none' ? '' : formatDate(req.now ?? new Date(), cfg.dateFormat ?? 'YYYYMMDD'))
  const ext = normalizeExt(req.ext, cfg.defaultExt ?? {}, type)
  const version = Number.isSafeInteger(req.version) && req.version > 0 ? req.version : 1
  const fileName = sanitizeFileName(
    renderTemplate(cfg.templateFile ?? '{topic}[_{date}]_v{n}{ext}', { topic, date, n: version, ext }),
  )

  const segments = [workspace, category, typeDir, batchDir, fileName]
  const root = trimTrailingSlashes(cfg.agHome)
  const relative = segments.join('/')
  return {
    root,
    workspace,
    category,
    typeDir,
    batchDir,
    fileName,
    segments,
    relative,
    path: root ? `${root}/${relative}` : relative,
  }
}
