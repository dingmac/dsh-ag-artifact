/**
 * 纯逻辑单测：不依赖 DSH 运行时，用 node --test 直接跑。
 *   node --test test/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveTarget, renderTemplate, sanitizeSegment, sanitizeFileName, scanMaxSlot } from '../lib/path.js'
import { verifyTree } from '../lib/verify.js'

/** 构造一份测试用生效配置。 */
function baseConfig(agHome, overrides = {}) {
  return {
    agHome,
    templateTask: '{workspace}',
    templateCategory: '{category}',
    templateTypeDir: '{typeDir}',
    templateBatch: '{topic}_批次{batch}',
    templateFile: '{topic}[_{date}]_v{n}{ext}',
    typeDirs: { 脚本: '脚本', 报告: '报告', 数据: '数据' },
    defaultExt: { 报告: '.md', 数据: '.csv', 脚本: '.py' },
    dateFormat: 'YYYYMMDD',
    dateSource: 'none',
    batchPolicy: 'reuse',
    maxDepth: 5,
    strictTypeDir: true,
    ignoreDirs: [],
    verifyMaxIssues: 50,
    ...overrides,
  }
}

async function withTemp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ag-artifact-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('sanitizeSegment：去禁用字符、空格转下划线、折叠下划线', () => {
  assert.equal(sanitizeSegment('塞艾斯 库存/比对'), '塞艾斯_库存比对')
  assert.equal(sanitizeSegment('  a::b  '), 'ab')
  assert.equal(sanitizeSegment('***'), '未命名')
})

test('sanitizeFileName：保留扩展名，清洗主体', () => {
  assert.equal(sanitizeFileName('差异 分析:v1.md'), '差异_分析v1.md')
  assert.equal(sanitizeFileName('报告.md'), '报告.md')
})

test('renderTemplate：可选段在变量为空时整段丢弃', () => {
  const tpl = '{topic}[_{date}]_v{n}{ext}'
  assert.equal(renderTemplate(tpl, { topic: '主题', date: '', n: 1, ext: '.md' }), '主题_v1.md')
  assert.equal(renderTemplate(tpl, { topic: '主题', date: '20261105', n: 2, ext: '.md' }), '主题_20261105_v2.md')
})

test('resolveTarget：首次落盘是 v1，已存在 v1 后自动 +1', async () => {
  await withTemp(async (home) => {
    const cfg = baseConfig(home)
    const request = { task: '范式转移', category: '库存对账', type: '报告', topic: '差异分析' }

    const first = resolveTarget(cfg, request)
    assert.equal(first.version, 1)
    assert.equal(first.batch, 1)
    assert.equal(
      first.filePath,
      join(home, '范式转移', '库存对账', '报告', '差异分析_批次1', '差异分析_v1.md'),
    )

    await mkdir(first.dir, { recursive: true })
    await writeFile(first.filePath, '# v1')

    const second = resolveTarget(cfg, request)
    assert.equal(second.version, 2)
    assert.equal(second.dir, first.dir)
  })
})

test('resolveTarget：版本号跨日期仍然递增（同一批次内按主题计）', async () => {
  await withTemp(async (home) => {
    const cfg = baseConfig(home)
    const dir = join(home, '任务', '分类', '报告', '主题_批次1')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, '主题_20261105_v1.md'), 'old')

    const plan = resolveTarget(cfg, { task: '任务', category: '分类', type: '报告', topic: '主题', date: '20261106' })
    assert.equal(plan.version, 2)
    assert.equal(plan.fileName, '主题_20261106_v2.md')
  })
})

test('resolveTarget：dateSource=today 时文件名带日期', async () => {
  await withTemp(async (home) => {
    const cfg = baseConfig(home, { dateSource: 'today', dateFormat: 'YYYYMMDD' })
    const plan = resolveTarget(cfg, { task: '任务', category: '分类', type: '报告', topic: '周报' })
    assert.match(plan.fileName, /^周报_\d{8}_v1\.md$/)
  })
})

test('resolveTarget：批次复用 vs 新建', async () => {
  await withTemp(async (home) => {
    const cfg = baseConfig(home)
    const request = { task: '任务', category: '分类', type: '数据', topic: '比对' }

    const first = resolveTarget(cfg, request)
    await mkdir(first.dir, { recursive: true })
    await writeFile(first.filePath, 'x')

    assert.equal(resolveTarget(cfg, request).batch, 1)
    assert.equal(resolveTarget(baseConfig(home, { batchPolicy: 'new' }), request).batch, 2)
    assert.throws(() => resolveTarget(baseConfig(home, { batchPolicy: 'explicit' }), request), /必须显式提供 batch/)
    assert.equal(resolveTarget(cfg, { ...request, batch: 7 }).batch, 7)
  })
})

test('resolveTarget：未知类型在 strictTypeDir 下报错', async () => {
  await withTemp(async (home) => {
    const cfg = baseConfig(home)
    assert.throws(
      () => resolveTarget(cfg, { task: '任务', category: '分类', type: '未知', topic: 'x' }),
      /未知产出类型/,
    )
    const loose = baseConfig(home, { strictTypeDir: false })
    assert.equal(resolveTarget(loose, { task: '任务', category: '分类', type: '未知', topic: 'x' }).typeDir, '未知')
  })
})

test('scanMaxSlot：目录不存在返回 0', async () => {
  await withTemp(async (home) => {
    assert.equal(scanMaxSlot(join(home, '不存在'), '{topic}_批次{batch}', 'batch', { topic: 'x' }), 0)
  })
})

test('verifyTree：合规结构通过', async () => {
  await withTemp(async (home) => {
    const cfg = baseConfig(home)
    const plan = resolveTarget(cfg, { task: '范式转移', category: '库存对账', type: '报告', topic: '差异分析' })
    await mkdir(plan.dir, { recursive: true })
    await writeFile(plan.filePath, '# v1')

    const result = verifyTree(cfg)
    assert.equal(result.ok, true, JSON.stringify(result.issues))
    assert.equal(result.files, 1)
  })
})

test('verifyTree：目录含空格、缺版本号、小类命名错误都被抓出来', async () => {
  await withTemp(async (home) => {
    const cfg = baseConfig(home)
    const badDir = join(home, '任务', '分类 三', '报告', '主题_批次1')
    await mkdir(badDir, { recursive: true })
    await writeFile(join(badDir, '没有版本.md'), 'x')

    const badBatchDir = join(home, '任务', '分类三', '报告', '主题_批次')
    await mkdir(badBatchDir, { recursive: true })
    await writeFile(join(badBatchDir, '主题_v1.md'), 'x')

    const result = verifyTree(cfg)
    assert.equal(result.ok, false)
    const messages = result.issues.map((issue) => issue.message).join('\n')
    assert.match(messages, /目录名含空格/)
    assert.match(messages, /文件名不符合配置的模板/)
    assert.match(messages, /小类.*不符合配置的模板/)
  })
})

test('verifyTree：空目录给 warn', async () => {
  await withTemp(async (home) => {
    const cfg = baseConfig(home)
    await mkdir(join(home, '任务', '分类', '报告'), { recursive: true })
    const result = verifyTree(cfg)
    assert.ok(result.issues.some((issue) => issue.level === 'warn' && /空目录/.test(issue.message)))
  })
})
