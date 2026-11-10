#!/usr/bin/env node
/**
 * scripts/preview.mjs — 用真实组件生成 UI 预览 HTML（不需要浏览器）。
 *
 * 做法：加载已构建的 lib/client.js → 取注册到 settings.section 的组件 →
 * 用 react-dom/server 渲染 → 套上模拟的 DSH 设置页外壳（浅色/深色各一份）。
 * 产物：preview/settings-light.html、preview/settings-dark.html
 * 之后可用 scripts/screenshot.mjs（或任意无头浏览器）截成 PNG。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import vm from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as react from 'react'
import * as jsxRuntime from 'react/jsx-runtime'

const root = fileURLToPath(new URL('..', import.meta.url))
const code = await readFile(join(root, 'lib/client.js'), 'utf8')

let loaderEntry
const sandbox = {
  window: { __ModuleLoader__: { load: (entry) => { loaderEntry = entry } } },
  console,
}
vm.runInNewContext(code, sandbox, { filename: 'lib/client.js' })
if (!loaderEntry) throw new Error('bundle 没有注册 ModuleLoader 入口')

const mod = loaderEntry.factory((name) => {
  if (name === 'react') return react
  if (name === 'react/jsx-runtime') return jsxRuntime
  throw new Error(`preview: 缺少模块 ${name}`)
})

const baseValue = {
  agHome: '/Volumes/NASData/dingmac/DSH产出',
  templateTask: '{workspace}',
  templateCategory: '{category}',
  templateTypeDir: '{typeDir}',
  templateBatch: '{topic}_批次{batch}',
  templateFile: '{topic}[_{date}]_v{n}{ext}',
  typeDirs: { 脚本: '脚本', 报告: '报告', 数据: '数据', 截图: '截图', 原型: '原型', 参考: '参考' },
  defaultExt: { 脚本: '.py', 报告: '.md', 数据: '.csv', 截图: '.png', 原型: '.html', 参考: '.md' },
  dateFormat: 'YYYYMMDD',
  dateSource: 'today',
  batchPolicy: 'reuse',
  maxDepth: 5,
  stagingDir: '.ag-staging',
  ignoreDirs: ['_archive', '_skeleton', '.DS_Store'],
  verifyMaxIssues: 50,
  strictTypeDir: true,
  confirmed: false,
  importedFrom: '/Users/dingmac/.dsh/.ag-spec/ag_config.json',
  importedAt: '2026-11-10T04:00:34.792Z',
}

let registered
const ctx = {
  effect: (fn) => fn(),
  slots: {
    inject: (_name, callback) => callback(),
    register: (config, Component) => {
      registered = { config, Component }
      return () => {}
    },
  },
  configForms: {
    get: () => makeScope(baseValue),
    whileServed: (_namespaces, callback) => callback(),
  },
}

function makeScope(value) {
  const snapshot = { status: 'ready', writable: true, revision: 7, value, user: { agHome: value.agHome } }
  return {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    mutate: async () => true,
    dispose() {},
  }
}

mod.apply(ctx)

/** SSR 会把 <style> 文本里的 > 转义成 &gt;，导致 CSS 选择器失效；预览时还原。 */
function unescapeStyle(html) {
  return html.replace(/<style>([\s\S]*?)<\/style>/g, (_match, css) =>
    `<style>${css.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')}</style>`,
  )
}

function renderMarkup(value) {
  const scopedCtx = { ...ctx, configForms: { get: () => makeScope(value), whileServed: (_n, cb) => cb() } }
  mod.apply(scopedCtx)
  const scopedProps = { ...(registered.config.inject ? registered.config.inject() : {}) }
  return unescapeStyle(renderToStaticMarkup(createElement(registered.Component, scopedProps)))
}

const SHELL = (theme) => `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>产出规范 · 设置预览</title>
<style>
  :root { color-scheme: ${theme === 'dark' ? 'dark' : 'light'}; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif;
    background: ${theme === 'dark' ? '#14161a' : '#f4f5f7'};
    color: ${theme === 'dark' ? '#e6e8ec' : '#1f2328'};
    min-height: 100vh;
  }
  .shell { display: flex; min-height: 100vh; }
  .side {
    width: 208px; flex: none; padding: 22px 14px;
    background: ${theme === 'dark' ? '#181b20' : '#ffffff'};
    border-right: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)'};
  }
  .side .brand { font-size: 13px; font-weight: 700; letter-spacing: .3px; padding: 0 10px 16px; opacity: .9; }
  .side nav { display: flex; flex-direction: column; gap: 2px; }
  .side .item {
    display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px;
    border-radius: 8px; font-size: 13px; opacity: .72; text-decoration: none; color: inherit;
  }
  .side .item::before { content: ""; width: 6px; height: 6px; border-radius: 2px; background: currentColor; opacity: .35; }
  .side .item.active {
    background: ${theme === 'dark' ? 'rgba(79,124,247,.18)' : 'rgba(79,124,247,.1)'};
    color: #4f7cf7; opacity: 1; font-weight: 600;
  }
  .side .item.active::before { opacity: 1; }
  .main { flex: 1; min-width: 0; padding: 28px 32px 48px; }
  .head { max-width: 1040px; margin: 0 auto 16px; }
  .head h1 { margin: 0 0 4px; font-size: 20px; font-weight: 700; letter-spacing: .2px; }
  .head p { margin: 0; font-size: 12.5px; opacity: .55; }
  .panel {
    max-width: 1040px; margin: 0 auto; padding: 22px 24px 8px;
    background: ${theme === 'dark' ? '#1b1e24' : '#ffffff'};
    border: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)'};
    border-radius: 14px;
    box-shadow: ${theme === 'dark' ? 'none' : '0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.05)'};
  }
  .agx { max-width: 100%; }
</style>
</head>
<body>
  <div class="shell">
    <aside class="side">
      <div class="brand">设置</div>
      <nav>
        <a class="item">通用</a>
        <a class="item">模型</a>
        <a class="item">插件</a>
        <a class="item active">产出规范</a>
      </nav>
    </aside>
    <main class="main">
      <header class="head">
        <h1>产出规范</h1>
        <p>AG 产出物路径与交付规范 · dsh-ag-artifact</p>
      </header>
      <div class="panel">
        ${'__MARKUP__'}
      </div>
    </main>
  </div>
</body>
</html>
`

const outDir = join(root, 'preview')
await mkdir(outDir, { recursive: true })

const lightMarkup = renderMarkup(baseValue)
const darkMarkup = renderMarkup({ ...baseValue, confirmed: true })

await writeFile(join(outDir, 'settings-light.html'), SHELL('light').replace('__MARKUP__', lightMarkup), 'utf8')
await writeFile(join(outDir, 'settings-dark.html'), SHELL('dark').replace('__MARKUP__', darkMarkup), 'utf8')

console.log(`preview HTML written to ${outDir}`)
console.log(`  settings-light.html  ${(lightMarkup.length / 1024).toFixed(1)} KiB markup`)
console.log(`  settings-dark.html   ${(darkMarkup.length / 1024).toFixed(1)} KiB markup`)
