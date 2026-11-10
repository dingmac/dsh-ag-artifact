/**
 * Host 装配测试：用假的 cordis ctx 驱动 lib/index.js，验证注册与首次接管流程。
 *   node --test test/host-load.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Config, apply, inject, name } from '../lib/index.js'

function makeCtx({ entry, configEditor } = {}) {
  const tools = []
  const sections = []
  const configureCalls = []
  const disposers = []

  const scope = {
    settings: {
      configure: (presentation, owner) => {
        configureCalls.push({ presentation, owner })
        return () => {}
      },
    },
    configEditor,
    effect: (fn) => {
      disposers.push(fn())
    },
  }

  const ctx = {
    logger: { info() {}, warn() {} },
    fiber: { entry },
    tools: { register: (definition) => tools.push(definition) },
    systemPrompt: { section: (section) => sections.push(section) },
    inject(services, callback) {
      const ready = services.every(
        (service) =>
          service === 'settings' ||
          (service === 'configEditor' && configEditor !== undefined),
      )
      if (ready) callback(scope)
    },
  }

  return { ctx, tools, sections, configureCalls, disposers }
}

async function withLegacyFile(payload, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ag-host-'))
  const file = join(dir, 'ag_config.json')
  await writeFile(file, JSON.stringify(payload), 'utf8')
  try {
    return await fn(file)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('插件导出：name / inject / Config', () => {
  assert.equal(name, 'ag-artifact')
  assert.ok(inject.includes('tools'))
  assert.ok(Config !== undefined)
})

test('apply：注册三个工具、一段提示、关闭自动表单', () => {
  const { ctx, tools, sections, configureCalls } = makeCtx()
  apply(ctx, Config({ agHome: '/tmp/ag-home' }))

  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    ['artifact_place', 'artifact_save', 'artifact_verify'],
  )
  assert.equal(sections.length, 1)
  assert.equal(sections[0].name, 'ag:artifact-spec')
  assert.equal(sections[0].interpolate, false)
  assert.equal(configureCalls.length, 1)
  assert.deepEqual(configureCalls[0].presentation, { auto: false })
})

test('apply：首次启用时接管旧配置（只写 configEditor，不碰旧文件）', async () => {
  await withLegacyFile({ paths: { AG_HOME: '/legacy/root' }, type_dirs: ['报告', '数据'] }, async (file) => {
    let edited
    const configEditor = {
      edit: async (entry, change) => {
        edited = { entry, next: change({ legacyConfigFile: file }, {}) }
      },
    }
    const { ctx } = makeCtx({ entry: { id: 'ag-artifact' }, configEditor })
    apply(ctx, Config({ legacyConfigFile: file }))
    await new Promise((resolve) => setTimeout(resolve, 10))

    assert.ok(edited, 'configEditor.edit 未被调用')
    assert.equal(edited.next.agHome, '/legacy/root')
    assert.deepEqual(edited.next.typeDirs, { 报告: '报告', 数据: '数据' })
    assert.equal(edited.next.confirmed, false)
  })
})

test('apply：已有 agHome 时不重复接管', async () => {
  await withLegacyFile({ paths: { AG_HOME: '/legacy/root' } }, async (file) => {
    let calls = 0
    const configEditor = {
      edit: async () => {
        calls += 1
      },
    }
    const { ctx } = makeCtx({ entry: { id: 'ag-artifact' }, configEditor })
    apply(ctx, Config({ agHome: '/configured/root', legacyConfigFile: file }))
    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.equal(calls, 0)
  })
})
