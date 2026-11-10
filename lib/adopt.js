/**
 * lib/adopt.js — 首次启用时"读取当前配置并接管"。
 *
 * 行为契约：
 *   - 只在 agHome 为空、且旧配置里确实有 paths.AG_HOME 时执行一次；
 *   - 只写 profile patch（通过 configEditor），**绝不修改**旧 ag_config.json；
 *   - 写入后把 confirmed 置 false：设置页进入"审阅状态"，用户核对并点确认才算完成接管；
 *   - 任何失败都只记日志，不阻塞插件加载（页面会显示未配置状态）。
 */
import { expandHome, readLegacyConfig, unref } from './config.js'

/**
 * 把旧版 ag_config.json 映射成插件配置补丁。纯函数，便于单测。
 * @param {Record<string, any> | undefined} legacy
 * @returns {Record<string, any>}
 */
export function legacyToPatch(legacy) {
  const patch = {}
  const agHome = legacy?.paths?.AG_HOME
  if (typeof agHome === 'string' && agHome.trim()) patch.agHome = agHome.trim()

  const typeDirs = legacy?.type_dirs
  if (Array.isArray(typeDirs)) {
    const mapped = {}
    for (const name of typeDirs) {
      if (typeof name === 'string' && name.trim()) mapped[name.trim()] = name.trim()
    }
    if (Object.keys(mapped).length > 0) patch.typeDirs = mapped
  }

  const dateFormat = legacy?.naming?.date_format
  if (typeof dateFormat === 'string' && dateFormat.trim()) patch.dateFormat = dateFormat.trim()

  return patch
}

/**
 * 首次启用时把旧配置接管进插件配置。
 * @param {object} options
 * @param {Record<string, any>} options.config - Cordis 传入的解析后配置（含 volatile 引用）。
 * @param {object} [options.entry] - 当前 Loader 条目（`ctx.fiber.entry`）。
 * @param {object} [options.configEditor] - `ctx.configEditor` 服务。
 * @param {{ info?: Function, warn?: Function }} [options.logger]
 * @returns {Promise<{ adopted: boolean, reason?: string, patch?: Record<string, any> }>}
 */
export async function adoptLegacyConfig({ config, entry, configEditor, logger }) {
  if (configEditor === undefined || entry === undefined || entry === null) {
    return { adopted: false, reason: 'unavailable' }
  }
  if (String(unref(config?.agHome) ?? '').trim()) {
    return { adopted: false, reason: 'already-configured' }
  }

  const file = unref(config?.legacyConfigFile)
  const legacy = readLegacyConfig(file)
  const patch = legacyToPatch(legacy)
  if (!patch.agHome) {
    return { adopted: false, reason: 'no-legacy-config' }
  }

  const meta = {
    importedFrom: expandHome(file),
    importedAt: new Date().toISOString(),
    confirmed: false,
  }
  await configEditor.edit(entry, (current) => ({ ...current, ...patch, ...meta }))
  logger?.info?.(`ag-artifact: 已从 ${meta.importedFrom} 接管现有产出配置，等待在设置页确认`)
  return { adopted: true, patch, meta }
}
