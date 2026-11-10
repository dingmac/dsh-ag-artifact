/**
 * client/index.jsx — 浏览器半侧入口。
 *
 * 注册「产出规范」设置页：
 *   - 只在 Host 提供 `ag-artifact` 设置命名空间时出现（whileServed）；
 *   - 通过 configForms 取该命名空间的表单 scope，传给页面组件；
 *   - 页面负责草稿、试算、确认保存。
 */
import { ArtifactPage } from './page.jsx'

/** 词典命名空间（保留给后续 i18n）。 */
export const NS = 'settings.agArtifact'

/** 浏览器插件需要注入的 cordis 服务。 */
export const inject = ['slots', 'configForms']

/**
 * 注册设置分区。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  const scope = ctx.configForms.get('ag-artifact')

  ctx.effect(
    () => () => {
      scope.dispose?.()
    },
    'dsh-ag-artifact: form subscription',
  )

  ctx.effect(
    () =>
      ctx.configForms.whileServed(['ag-artifact'], () =>
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'ag-artifact',
              order: 60,
              label: () => '产出规范',
              inject: () => ({ scope }),
            },
            ArtifactPage,
          ),
        ),
      ),
    'dsh-ag-artifact: page',
  )
}
