/**
 * lib/index.js — 插件入口（Host 半侧）。
 *
 * 职责：
 *   1. 注册 artifact_save / artifact_place / artifact_verify 三个工具；
 *   2. 注入随配置变化的系统提示段；
 *   3. 首次启用时接管旧 ag_config.json（只写插件配置，不改旧文件）；
 *   4. 关闭设置页的自动表单，改由浏览器半侧的「产出规范」页承载。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { adoptLegacyConfig } from './adopt.js'
import { Config, effectiveConfig } from './config.js'
import { renderPrompt } from './prompt.js'
import { registerTools } from './tools.js'

/** Loader 条目身份。 */
export const name = 'ag-artifact'

/** 基础服务：工具注册表、提示词注册表、工作目录。 */
export const inject = ['tools', 'systemPrompt', 'workingDirectory']

export { Config }

/**
 * 装载插件。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Record<string, any>} config - 由 Config schema 解析后的插件配置。
 */
export function apply(ctx, config) {
  registerTools(ctx, config, defineTool)
  registerPrompt(ctx, config)
  useCustomSettingsPage(ctx)
  adoptOnFirstEnable(ctx, config)
}

/**
 * 注入"产出物规范"系统提示段。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Record<string, any>} config
 */
function registerPrompt(ctx, config) {
  ctx.systemPrompt.section({
    name: 'ag:artifact-spec',
    // 2100：位于第一方工具指导之后、交付引用指导（约 9000）之前。
    order: 2100,
    // 规则文本含 {workspace} 这类字面量，必须关闭变量插值。
    interpolate: false,
    text: () => {
      // 未配置（例如刚启用、还没确认根目录）时不向模型注入任何内容：
      // 插件此时本就什么都不做，避免把内部错误文本写进系统提示。
      try {
        return renderPrompt(effectiveConfig(config))
      } catch {
        return ''
      }
    },
  })
}

/**
 * 关闭本条目在「插件」页里的自动表单：改由浏览器侧的 settings.section 页面承载。
 * 没有 settings 服务的组合（如 headless）跳过即可。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
function useCustomSettingsPage(ctx) {
  ctx.inject(['settings'], (scope) => {
    scope.effect(() => {
      try {
        return scope.settings.configure({ auto: false }, ctx.fiber)
      } catch (error) {
        // 同一 fiber 重复配置（例如服务重启）不应让插件整体失败：退回自动表单即可。
        ctx.logger?.warn?.(`ag-artifact: 关闭自动设置表单失败：${error?.message ?? error}`)
        return () => {}
      }
    }, 'dsh-ag-artifact: custom settings page')
  })
}

/**
 * 首次启用：读取旧 ag_config.json 并接管为插件配置（只写 profile patch）。
 * 延后到微任务，避免在 Loader 装载过程中改配置触发重入。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Record<string, any>} config
 */
function adoptOnFirstEnable(ctx, config) {
  const entry = ctx.fiber?.entry
  if (entry === undefined) return
  ctx.inject(['configEditor'], (scope) => {
    scope.effect(() => {
      let cancelled = false
      queueMicrotask(() => {
        if (cancelled) return
        adoptLegacyConfig({
          config,
          entry,
          configEditor: scope.configEditor,
          logger: ctx.logger,
        }).catch((error) => {
          ctx.logger?.warn?.(`ag-artifact: 旧配置自动接管失败：${error?.message ?? error}`)
        })
      })
      return () => {
        cancelled = true
      }
    }, 'dsh-ag-artifact: adopt legacy config')
  })
}
