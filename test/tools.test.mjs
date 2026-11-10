/**
 * 工具层单测：用假的 ctx 与 identity defineTool 直接调用 execute，
 * 不加载 DSH 运行时，只验证落盘/搬运/版本递增/自查这些真实行为。
 *   node --test test/tools.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import { registerTools } from '../lib/tools.js'

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
    stagingDir: '.ag-staging',
    ...overrides,
  }
}

/** 跑一个隔离的插件实例，返回按名字索引的工具定义。 */
async function withTools(fn) {
  const home = await mkdtemp(join(tmpdir(), 'ag-home-'))
  const workspace = await mkdtemp(join(tmpdir(), 'ag-ws-'))
  try {
    const defs = new Map()
    const ctx = {
      tools: { register: (definition) => defs.set(definition.name, definition) },
      get: () => undefined,
    }
    registerTools(ctx, baseConfig(home), (definition) => definition)
    const exec = { agent: { session: { header: { cwd: workspace } } }, signal: undefined }
    return await fn({ home, workspace, defs, exec })
  } finally {
    await rm(home, { recursive: true, force: true })
    await rm(workspace, { recursive: true, force: true })
  }
}

test('artifact_save：落到五层路径并自动递增版本', async () => {
  await withTools(async ({ home, workspace, defs, exec }) => {
    const save = defs.get('artifact_save')
    assert.ok(save, 'artifact_save 未注册')

    const first = await save.execute(
      { type: '报告', category: '库存对账', topic: '差异分析', content: '# v1' },
      exec,
    )
    assert.equal(first.version, 1)
    assert.equal(
      first.path,
      join(home, basename(workspace), '库存对账', '报告', '差异分析_批次1', '差异分析_v1.md'),
    )
  })
})

test('artifact_save：两次保存得到 v1/v2，且都真实落盘', async () => {
  await withTools(async ({ defs, exec }) => {
    const save = defs.get('artifact_save')
    const args = { type: '报告', category: '分类', topic: '主题', content: 'x' }
    const first = await save.execute(args, exec)
    const second = await save.execute({ ...args, content: 'y' }, exec)

    assert.equal(first.version, 1)
    assert.equal(second.version, 2)
    assert.equal(await readFile(first.path, 'utf8'), 'x')
    assert.equal(await readFile(second.path, 'utf8'), 'y')
  })
})

test('artifact_save：dry_run 不写盘', async () => {
  await withTools(async ({ defs, exec }) => {
    const out = await defs.get('artifact_save').execute(
      { type: '报告', category: '分类', topic: '主题', content: 'x', dry_run: true },
      exec,
    )
    assert.equal(out.dry_run, true)
    assert.equal(existsSync(out.path), false)
  })
})

test('artifact_place：默认移动，源文件消失、目标出现', async () => {
  await withTools(async ({ home, workspace, defs, exec }) => {
    const source = join(workspace, '.ag-staging', '库存比对.xlsx')
    await mkdir(join(workspace, '.ag-staging'), { recursive: true })
    await writeFile(source, 'binary-ish')

    const out = await defs.get('artifact_place').execute(
      { source_path: source, type: '数据', category: '库存对账', topic: '塞艾斯库存比对' },
      exec,
    )

    assert.equal(out.version, 1)
    assert.equal(out.moved, true)
    assert.equal(existsSync(source), false)
    assert.equal(
      existsSync(join(home, basename(workspace), '库存对账', '数据', '塞艾斯库存比对_批次1', '塞艾斯库存比对_v1.xlsx')),
      true,
    )
  })
})

test('artifact_place：copy=true 保留源文件', async () => {
  await withTools(async ({ workspace, defs, exec }) => {
    const source = join(workspace, 'a.png')
    await writeFile(source, 'png')
    const out = await defs.get('artifact_place').execute(
      { source_path: 'a.png', type: '数据', category: '分类', topic: '主题', copy: true },
      exec,
    )
    assert.equal(out.moved, false)
    assert.equal(existsSync(source), true)
  })
})

test('artifact_verify：工具返回结构合法', async () => {
  await withTools(async ({ defs, exec }) => {
    await defs.get('artifact_save').execute(
      { type: '报告', category: '分类', topic: '主题', content: 'x' },
      exec,
    )
    const result = await defs.get('artifact_verify').execute({}, exec)
    assert.equal(result.ok, true)
    assert.equal(result.files, 1)
    assert.ok(Array.isArray(result.issues))
  })
})

test('artifact_save：未知类型报错', async () => {
  await withTools(async ({ defs, exec }) => {
    await assert.rejects(
      () => defs.get('artifact_save').execute(
        { type: '不存在的类型', category: '分类', topic: '主题', content: 'x' },
        exec,
      ),
      /未知产出类型/,
    )
  })
})
