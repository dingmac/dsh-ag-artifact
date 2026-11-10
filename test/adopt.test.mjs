/**
 * Host 侧单元测试：旧配置接管 + 配置 schema 默认值。
 *   node --test test/adopt.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Config, effectiveConfig } from '../lib/config.js'
import { adoptLegacyConfig, legacyToPatch } from '../lib/adopt.js'

async function withLegacyFile(payload, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ag-legacy-'))
  const file = join(dir, 'ag_config.json')
  await writeFile(file, JSON.stringify(payload), 'utf8')
  try {
    return await fn(file)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('Config 默认值：未配置时 agHome 为空、confirmed=false', () => {
  const config = Config({})
  assert.equal(config.agHome.get(), '')
  assert.equal(config.confirmed.get(), false)
  assert.equal(config.templateFile.get(), '{topic}[_{date}]_v{n}{ext}')
  assert.deepEqual(config.typeDirs.get(), {
    脚本: '脚本',
    报告: '报告',
    数据: '数据',
    截图: '截图',
    原型: '原型',
    参考: '参考',
  })
})

test('effectiveConfig：尊重用户在设置页删掉的默认类型', () => {
  const config = Config({ agHome: '/tmp/x', typeDirs: { 报告: '报告' } })
  const cfg = effectiveConfig(config)
  assert.deepEqual(cfg.typeDirs, { 报告: '报告' })

  const empty = effectiveConfig(Config({ agHome: '/tmp/x', typeDirs: {} }))
  assert.deepEqual(empty.typeDirs, {})
})

test('effectiveConfig：旧配置回退读取 paths.AG_HOME', async () => {
  await withLegacyFile({ paths: { AG_HOME: '/tmp/ag-home' }, type_dirs: ['报告'] }, async (file) => {
    const cfg = effectiveConfig({ ...Config({}), legacyConfigFile: file })
    assert.equal(cfg.agHome, '/tmp/ag-home')
  })
})

test('legacyToPatch：映射 agHome / type_dirs / date_format', () => {
  const patch = legacyToPatch({
    paths: { AG_HOME: '/Volumes/x/DSH产出' },
    type_dirs: ['脚本', '报告'],
    naming: { date_format: 'YYYYMMDD' },
  })
  assert.deepEqual(patch, {
    agHome: '/Volumes/x/DSH产出',
    typeDirs: { 脚本: '脚本', 报告: '报告' },
    dateFormat: 'YYYYMMDD',
  })
})

test('legacyToPatch：空配置返回空补丁', () => {
  assert.deepEqual(legacyToPatch(undefined), {})
  assert.deepEqual(legacyToPatch({}), {})
})

test('adoptLegacyConfig：已配置时跳过，不调用 configEditor', async () => {
  const config = { agHome: '/already', legacyConfigFile: '/nope' }
  let called = 0
  const result = await adoptLegacyConfig({
    config,
    entry: {},
    configEditor: {
      edit: async () => {
        called += 1
      },
    },
  })
  assert.equal(result.adopted, false)
  assert.equal(result.reason, 'already-configured')
  assert.equal(called, 0)
})

test('adoptLegacyConfig：无旧配置时跳过', async () => {
  const config = { agHome: '', legacyConfigFile: '/definitely/not/here.json' }
  const result = await adoptLegacyConfig({ config, entry: {}, configEditor: { edit: async () => {} } })
  assert.equal(result.adopted, false)
  assert.equal(result.reason, 'no-legacy-config')
})

test('adoptLegacyConfig：写入补丁 + 导入元信息，confirmed=false', async () => {
  await withLegacyFile({ paths: { AG_HOME: '/legacy/home' }, type_dirs: ['数据'] }, async (file) => {
    let written
    const result = await adoptLegacyConfig({
      config: { agHome: '', legacyConfigFile: file },
      entry: { id: 'ag-artifact' },
      configEditor: {
        edit: async (_entry, change) => {
          written = change({ legacyConfigFile: file }, {})
        },
      },
    })
    assert.equal(result.adopted, true)
    assert.equal(written.agHome, '/legacy/home')
    assert.deepEqual(written.typeDirs, { 数据: '数据' })
    assert.equal(written.confirmed, false)
    assert.equal(written.importedFrom, file)
    assert.match(written.importedAt, /^\d{4}-\d{2}-\d{2}T/)
  })
})

test('adoptLegacyConfig：configEditor 缺失时安全跳过', async () => {
  const result = await adoptLegacyConfig({ config: { agHome: '' } })
  assert.equal(result.adopted, false)
  assert.equal(result.reason, 'unavailable')
})
