#!/usr/bin/env node
/**
 * scripts/check-client.mjs — 不启动浏览器，校验 lib/client.js 的 bundle 契约。
 *
 * 检查项：
 *   1. bundle 能在最小化 __ModuleLoader__ 环境里执行；
 *   2. factory 返回 `{ apply, inject }` 且类型正确；
 *   3. apply 会订阅 configForms 并注册 settings.section；
 *   4. 页面组件能用 react-dom/server 渲染出真实字段。
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import vm from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as react from 'react'
import * as jsxRuntime from 'react/jsx-runtime'

const root = fileURLToPath(new URL('..', import.meta.url))
const code = await readFile(join(root, 'lib/client.js'), 'utf8')

let captured
const sandbox = {
  window: {
    __ModuleLoader__: {
      load: (entry) => {
        captured = entry
      },
    },
  },
  console,
}
vm.runInNewContext(code, sandbox, { filename: 'lib/client.js' })
if (!captured) throw new Error('bundle 没有调用 window.__ModuleLoader__.load')
if (captured.id !== 'dsh-ag-artifact') throw new Error(`bundle id 不对：${captured.id}`)

const required = []
const requireStub = (name) => {
  required.push(name)
  if (name === 'react') return react
  if (name === 'react/jsx-runtime') return jsxRuntime
  throw new Error(`check-client: 未提供模块 ${name} 的桩（按需补充）`)
}

const mod = captured.factory(requireStub)
const problems = []
if (typeof mod.apply !== 'function') problems.push('缺少 apply')
if (!Array.isArray(mod.inject)) problems.push('缺少 inject 数组')
if (problems.length > 0) throw new Error(`bundle 导出不合法：${problems.join('、')}`)
if (!mod.inject.includes('configForms')) throw new Error('inject 缺少 configForms')

const snapshot = {
  status: 'ready',
  writable: true,
  revision: 3,
  value: {
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
    stagingDir: '.ag-staging',
    ignoreDirs: ['_archive'],
    verifyMaxIssues: 50,
    strictTypeDir: true,
    confirmed: false,
    importedFrom: '/Users/demo/.dsh/.ag-spec/ag_config.json',
    importedAt: '2026-11-10T00:00:00.000Z',
  },
  user: { agHome: '/Volumes/NASData/dingmac/DSH产出' },
}
const scope = {
  subscribe: () => () => {},
  getSnapshot: () => snapshot,
  mutate: async () => true,
  dispose() {},
}

let registered
const ctx = {
  effect(fn) {
    fn()
  },
  slots: {
    inject(name, callback) {
      return callback()
    },
    register(config, Component) {
      registered = { config, Component }
      return () => {}
    },
  },
  configForms: {
    get: (namespace) => {
      if (namespace !== 'ag-artifact') throw new Error(`configForms.get 命名空间不对：${namespace}`)
      return scope
    },
    whileServed: (namespaces, callback) => {
      if (!Array.isArray(namespaces) || namespaces[0] !== 'ag-artifact') throw new Error('whileServed 命名空间不对')
      return callback()
    },
  },
}
mod.apply(ctx)
if (!registered) throw new Error('apply 没有注册任何 slot 组件')
if (registered.config.name !== 'settings.section') throw new Error(`注册的 slot 不对：${registered.config.name}`)
if (registered.config.id !== 'ag-artifact') throw new Error(`注册的 id 不对：${registered.config.id}`)
const label = typeof registered.config.label === 'function' ? registered.config.label() : registered.config.label
if (typeof label !== 'string' || label.length === 0) throw new Error('slot label 不合法')

const props = { ...(registered.config.inject ? registered.config.inject() : {}) }
const html = renderToStaticMarkup(createElement(registered.Component, props))
for (const expected of ['当前状态', '目录规则（固定五层）', '类型目录', '路径试算', '确认并启用', 'DSH产出']) {
  if (!html.includes(expected)) throw new Error(`页面渲染缺少「${expected}」：${html.slice(0, 400)}`)
}

console.log('client bundle OK')
console.log(`  id: ${captured.id}`)
console.log(`  inject: ${JSON.stringify(mod.inject)}`)
console.log(`  slot: ${registered.config.name} / id=${registered.config.id} / order=${registered.config.order} / label=${label}`)
console.log(`  required at runtime: ${[...new Set(required)].join(', ')}`)
console.log(`  rendered ${(html.length / 1024).toFixed(1)} KiB html, fields present`)
