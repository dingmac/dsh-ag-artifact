/**
 * lib/verify.js — 产出物结构自查（artifact_verify 的实现核心）。
 *
 * 只读，不修改任何文件。返回 error/warn 两类问题，error 会阻止"自查通过"。
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { templateToRegex } from './core/text.js'

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/
const DEFAULT_BATCH_DIR = /^.+_批次\d+$/
const DEFAULT_VERSIONED_FILE = /^.+_v\d+\.[A-Za-z0-9]+$/
const MAX_FILES = 20000

const LEVEL = {
  TASK: 1,
  CATEGORY: 2,
  TYPE: 3,
  BATCH: 4,
  FILE: 5,
}

/**
 * 扫描产出根目录并检查五层规范。
 * @param {object} cfg - effectiveConfig() 的结果。
 * @param {string} [scopePath] - 只检查这个子树（绝对路径）；缺省检查整个 agHome。
 * @returns {{ root: string, ok: boolean, files: number, dirs: number, issues: Array<{level: string, path: string, message: string}>, truncated: boolean }}
 */
export function verifyTree(cfg, scopePath) {
  const root = scopePath || cfg.agHome
  const issues = []
  const stats = { files: 0, dirs: 0, scanned: 0 }
  const ignore = new Set(cfg.ignoreDirs ?? [])
  // 按用户实际配置的模板校验，而不是写死默认模板（用户改过模板时不会误报）。
  const batchPattern = cfg.templateBatch
    ? templateToRegex(cfg.templateBatch, { topic: '.+', batch: '\\d+', workspace: '.+', category: '.+', typeDir: '.+' })
    : DEFAULT_BATCH_DIR
  const filePattern = cfg.templateFile
    ? templateToRegex(cfg.templateFile, {
      topic: '.+?', date: '[^_]+?', n: '\\d+', ext: '\\.[A-Za-z0-9]+',
      workspace: '.+', category: '.+', typeDir: '.+', batch: '\\d+',
    })
    : DEFAULT_VERSIONED_FILE
  const knownTypeDirs = new Set(
    Object.entries(cfg.typeDirs ?? {})
      .filter(([key]) => key !== 'default')
      .map(([, value]) => value),
  )

  const report = (level, path, message) => {
    issues.push({ level, path, message })
  }

  /**
   * @param {string} dirPath 绝对路径
   * @param {string[]} relSegments 相对 agHome 的段
   * @param {number} depth 目录层级（1 起）
   */
  const walk = (dirPath, relSegments, depth) => {
    let entries
    try {
      entries = readdirSync(dirPath, { withFileTypes: true })
    } catch (error) {
      report('error', dirPath, `无法读取目录：${error.message}`)
      return
    }
    stats.dirs += 1
    if (entries.length === 0 && depth > 0) {
      report('warn', dirPath, '空目录（规范禁止创建空目录）')
    }
    for (const entry of entries) {
      const name = entry.name
      const nextPath = join(dirPath, name)
      const nextRel = [...relSegments, name]
      if (depth === 0 && ignore.has(name)) continue

      if (entry.isDirectory()) {
        if (FORBIDDEN.test(name)) report('error', nextPath, '目录名含禁用字符')
        if (/\s/.test(name)) report('error', nextPath, '目录名含空格（应使用 _）')
        if (name.length > 64) report('warn', nextPath, '目录名过长（>64）')
        if (depth + 1 === LEVEL.TYPE && cfg.strictTypeDir && !knownTypeDirs.has(name)) {
          report('error', nextPath, `第 3 层大类 "${name}" 不在 typeDirs 配置中`)
        }
        if (depth + 1 === LEVEL.BATCH && !batchPattern.test(name)) {
          report('error', nextPath, `第 4 层小类 "${name}" 不符合配置的模板 ${cfg.templateBatch ?? '<主题>_批次N'}`)
        }
        walk(nextPath, nextRel, depth + 1)
        continue
      }

      if (!entry.isFile()) continue

      stats.files += 1
      stats.scanned += 1
      if (stats.scanned > MAX_FILES) {
        report('error', root, `文件数超过 ${MAX_FILES}，已停止扫描`)
        return
      }

      const fileDepth = nextRel.length
      if (fileDepth !== LEVEL.FILE) {
        report(
          fileDepth < LEVEL.FILE ? 'error' : 'warn',
          nextPath,
          `文件层级为 ${fileDepth}，规范要求恰好 5 层（根/任务/分类/大类/小类/文件）`,
        )
      }
      if (FORBIDDEN.test(name)) report('error', nextPath, '文件名含禁用字符')
      if (/\s/.test(name)) report('error', nextPath, '文件名含空格')
      if (name !== name.trim()) report('error', nextPath, '文件名首尾有空格')
      if (!filePattern.test(name)) {
        report('error', nextPath, `文件名不符合配置的模板 ${cfg.templateFile ?? '<主题>_vN.<ext>'}`)
      }
      if (fileDepth >= LEVEL.BATCH) {
        const batchDir = nextRel[LEVEL.BATCH - 1]
        if (!batchPattern.test(batchDir)) report('error', nextPath, `所在小类目录 "${batchDir}" 不符合配置的模板`)
      }
    }
  }

  walk(root, [], 0)

  issues.sort((left, right) => (left.level === right.level ? 0 : left.level === 'error' ? -1 : 1))
  const limit = Number.isSafeInteger(cfg.verifyMaxIssues) ? cfg.verifyMaxIssues : 50
  return {
    root,
    ok: !issues.some((issue) => issue.level === 'error'),
    files: stats.files,
    dirs: stats.dirs,
    issues: issues.slice(0, limit),
    truncated: issues.length > limit,
  }
}
