/**
 * 回归测试：模板可配置后的自查、版本冲突拒绝覆盖。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { verifyTree } from '../lib/verify.js'
import { registerTools } from '../lib/tools.js'

function baseConfig(agHome, overrides = {}) {
  return {
    agHome,
    templateTask: '{workspace}',
    templateCategory: '{category}',
    templateTypeDir: '{typeDir}',
    templateBatch: '{topic}_批次{batch}',
    templateFile: '{topic}[_{date}]_v{n}{ext}',
    typeDirs: { 报告: '报告' },
    defaultExt: { 报告: '.md' },
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

test('verifyTree：自定义模板不误报（旧版写死规则会误报）', async () => {
  const home = await mkdtemp(join(tmpdir(), 'ag-verify-custom-'))
  try {
    const cfg = baseConfig(home, {
      templateBatch: '{topic}-B{batch}',
      templateFile: '{topic}_V{n}{ext}',
    })
    const dir = join(home, '任务', '分类', '报告', '主题-B1')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, '主题_V1.md'), 'x')

    const result = verifyTree(cfg)
    assert.equal(result.ok, true, JSON.stringify(result.issues))
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('verifyTree：默认模板下错误小类仍被抓住', async () => {
  const home = await mkdtemp(join(tmpdir(), 'ag-verify-bad-'))
  try {
    const cfg = baseConfig(home)
    const dir = join(home, '任务', '分类', '报告', '主题_B1')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, '主题_v1.md'), 'x')

    const result = verifyTree(cfg)
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((issue) => /小类/.test(issue.message)))
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

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

test('artifact_save：显式版本号已存在时拒绝覆盖', async () => {
  await withTools(async ({ defs, exec }) => {
    const save = defs.get('artifact_save')
    await save.execute({ type: '报告', category: '分类', topic: '主题', content: 'v1' }, exec)
    await assert.rejects(
      () => save.execute({ type: '报告', category: '分类', topic: '主题', content: '覆盖', version: 1 }, exec),
      /拒绝覆盖/,
    )
  })
})

test('artifact_place：显式版本号已存在时拒绝覆盖，且源文件保留', async () => {
  await withTools(async ({ workspace, defs, exec }) => {
    await defs.get('artifact_save').execute(
      { type: '报告', category: '分类', topic: '主题', content: 'v1' },
      exec,
    )
    const source = join(workspace, '源.md')
    await writeFile(source, 'new')
    await assert.rejects(
      () => defs.get('artifact_place').execute(
        { source_path: source, type: '报告', category: '分类', topic: '主题', version: 1 },
        exec,
      ),
      /拒绝覆盖/,
    )
    // 源文件没有被删掉
    await assert.doesNotReject(() => import('node:fs/promises').then(({ stat }) => stat(source)))
  })
})

test('artifact_save：自动版本在已有 v1 后递增为 v2（不覆盖）', async () => {
  await withTools(async ({ defs, exec }) => {
    const save = defs.get('artifact_save')
    const first = await save.execute({ type: '报告', category: '分类', topic: '主题', content: 'one' }, exec)
    const second = await save.execute({ type: '报告', category: '分类', topic: '主题', content: 'two' }, exec)
    assert.equal(first.version, 1)
    assert.equal(second.version, 2)
    const { readFile } = await import('node:fs/promises')
    assert.equal(await readFile(first.path, 'utf8'), 'one')
    assert.equal(await readFile(second.path, 'utf8'), 'two')
  })
})
