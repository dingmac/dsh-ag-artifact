/**
 * 浏览器/Node 共用纯逻辑测试：路径试算 + 草稿差分。
 *   node --test test/core.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { previewPath } from '../lib/core/preview.js'
import { validateTemplates } from '../lib/core/text.js'
import { diffOps, normalizeDraft, sameValue, stableStringify, typeRows } from '../lib/core/draft.js'

const CFG = {
  agHome: '/Volumes/NASData/dingmac/DSH产出',
  templateTask: '{workspace}',
  templateCategory: '{category}',
  templateTypeDir: '{typeDir}',
  templateBatch: '{topic}_批次{batch}',
  templateFile: '{topic}[_{date}]_v{n}{ext}',
  typeDirs: { 报告: '报告', 数据: '数据' },
  defaultExt: { 报告: '.md', 数据: '.csv' },
  dateFormat: 'YYYYMMDD',
  dateSource: 'none',
  batchPolicy: 'reuse',
  maxDepth: 5,
}

test('previewPath：生成五层路径并清洗段名', () => {
  const result = previewPath(CFG, { task: '范式转移', category: '库存 对账', type: '报告', topic: '差异分析' })
  assert.equal(
    result.path,
    '/Volumes/NASData/dingmac/DSH产出/范式转移/库存_对账/报告/差异分析_批次1/差异分析_v1.md',
  )
  assert.deepEqual(result.segments, ['范式转移', '库存_对账', '报告', '差异分析_批次1', '差异分析_v1.md'])
})

test('previewPath：dateSource=none 时不写日期；today 时写日期', () => {
  const none = previewPath(CFG, { task: 't', category: 'c', type: '报告', topic: 'x' })
  assert.equal(none.fileName, 'x_v1.md')

  const today = previewPath({ ...CFG, dateSource: 'today' }, {
    task: 't',
    category: 'c',
    type: '报告',
    topic: 'x',
    now: new Date(2026, 10, 10),
  })
  assert.equal(today.fileName, 'x_20261110_v1.md')
})

test('previewPath：agHome 为空时给出相对路径', () => {
  const result = previewPath({ ...CFG, agHome: '' }, { task: 't', category: 'c', type: '报告', topic: 'x' })
  assert.equal(result.path, 't/c/报告/x_批次1/x_v1.md')
})

test('validateTemplates：缺 {n} / {batch} / 层级不足时报错', () => {
  assert.deepEqual(validateTemplates(CFG), [])
  assert.equal(validateTemplates({ ...CFG, templateFile: 'no-version' }).length, 1)
  assert.equal(validateTemplates({ ...CFG, templateBatch: 'no-batch' }).length, 1)
  assert.equal(validateTemplates({ ...CFG, maxDepth: 3 }).length, 1)
})

test('stableStringify：键顺序无关', () => {
  assert.equal(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }))
  assert.ok(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 }))
  assert.ok(!sameValue([1, 2], [2, 1]))
})

test('diffOps：只产出真正变化的字段', () => {
  const current = { agHome: '/a', templateTask: '{workspace}', typeDirs: { 报告: '报告' }, maxDepth: 5 }
  const draft = { ...current, templateTask: '{workspace}_x', typeDirs: { 报告: '报告', 数据: '数据' } }
  const ops = diffOps(current, draft)
  assert.deepEqual(ops, [
    { op: 'set', path: ['templateTask'], value: '{workspace}_x' },
    { op: 'set', path: ['typeDirs'], value: { 报告: '报告', 数据: '数据' } },
  ])
})

test('diffOps：草稿缺字段时产出 unset', () => {
  const ops = diffOps({ agHome: '/a', stagingDir: '.ag-staging' }, { agHome: '/a', stagingDir: undefined })
  assert.deepEqual(ops, [{ op: 'unset', path: ['stagingDir'] }])
})

test('diffOps：完全一致时为空', () => {
  const value = normalizeDraft({ agHome: '/a' })
  assert.deepEqual(diffOps(value, value), [])
})

test('normalizeDraft：补默认值并保留只读元信息', () => {
  const draft = normalizeDraft({ agHome: '/a', importedFrom: '/x', confirmed: false })
  assert.equal(draft.agHome, '/a')
  assert.equal(draft.templateFile, '{topic}[_{date}]_v{n}{ext}')
  assert.equal(draft.importedFrom, '/x')
  assert.equal(draft.confirmed, false)
  assert.deepEqual(draft.typeDirs, {})
  assert.deepEqual(draft.ignoreDirs, [])
})

test('typeRows：保持插入顺序', () => {
  assert.deepEqual(typeRows({ 报告: '报告', 数据: '数据' }), [
    { type: '报告', dir: '报告' },
    { type: '数据', dir: '数据' },
  ])
})
