/**
 * lib/prompt.js — 注入模型的"产出物规范"系统提示段。
 *
 * 这段文本替代 AGENTS.md 里那段硬规则：内容随插件配置动态生成，
 * 因此改类型目录/批次策略/模板后，模型看到的就是新规则。
 */

/**
 * 渲染系统提示段。
 * @param {object} cfg - effectiveConfig() 的结果。
 * @returns {string}
 */
export function renderPrompt(cfg) {
  const typePairs = Object.entries(cfg.typeDirs)
    .filter(([key]) => key !== 'default')
    .map(([key, value]) => `${key}→${value}`)
    .join('、')
  const policy =
    cfg.batchPolicy === 'new'
      ? '每次落盘新建下一批次'
      : cfg.batchPolicy === 'explicit'
        ? '必须显式指定批次号'
        : '同一主题复用最新批次'
  const staging = cfg.stagingDir
  const dateHint = cfg.dateSource === 'none' ? '文件名不写日期' : `文件名日期格式 ${cfg.dateFormat}`

  const placeholders = '{topic}[_{date}]_v{n}{ext}'
  const structure = '{workspace}/{category}/{typeDir}/{batchDir}/{fileName}'

  return [
    '<artifact-spec>',
    '本会话的产出物必须落在产出根目录下，按固定五层结构落盘。这是硬性规则，不是建议。',
    '',
    `产出根目录：${cfg.agHome}`,
    `五层结构：${structure}`,
    '  第 1 层 任务主文件夹 = 当前会话工作区名',
    '  第 2 层 任务分类 = 业务主题名',
    `  第 3 层 大类 = 类型目录（${typePairs}）`,
    '  第 4 层 小类 = <主题>_批次N，单个交付物的版本容器',
    `  第 5 层 文件 = ${placeholders}，版本号必带，从 _v1 起`,
    `批次策略：${policy}。${dateHint}。`,
    '',
    '落盘方式（按优先级）：',
    `1. 文本产出（.md/.py/.sh/.html/.json/.csv）→ 调 artifact_save，自动清洗段名并分配下一个版本号。`,
    `2. 脚本或二进制产出（.xlsx/.png/.pdf 等）→ 先写到会话工作目录下的 ${staging}/ 暂存目录，再用 artifact_place 移入正式路径（默认移动，不留副本）。`,
    `3. 不要用 write/edit/bash 直接写 ${cfg.agHome}：该目录在会话工作区之外，会被文件沙箱拒绝。`,
    '',
    '铁律：',
    '- 禁止覆盖旧版本，每次修改都另存新版本号。',
    '- 小类目录内只允许"文件名主体相同、只有 _vN 不同"的文件；内容不同就另建一个小类目录。',
    '- 目录名不含空格（用 _ 代替），不使用 \\ / : * ? " < > | 这些字符。',
    '- 不创建空目录；暂存目录在交付前清理掉。',
    '',
    '交付与自查：',
    '- 落盘后立即对最终文件调用 present 交付（单次 1–2 个关键文件）。',
    '- 交付前调用 artifact_verify 自查；只要有 error，先修正再交付。',
    '</artifact-spec>',
  ].join('\n')
}
