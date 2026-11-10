#!/usr/bin/env node
/**
 * scripts/build-client.mjs — 把 client/ 下的 React 源码打成 DSH 浏览器插件 bundle。
 *
 * DSH 的浏览器插件不是普通 ESM：宿主用 window.__ModuleLoader__.load({ id, factory })
 * 注册一个惰性 factory，factory 里以 CJS 语义 require() 平台共享模块
 *（react、@deepseek-ai/dsh-client-ui-primitives 等）。
 *
 * 本脚本用 esbuild 把源码打成 CJS，再套上这层外壳；externals 必须与平台模块表对齐。
 * 用法：node scripts/build-client.mjs [--minify]
 */
import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const minify = process.argv.includes('--minify')

/** 平台共享模块表里、本插件会用到的请求。这些不打包，运行时由宿主 require 注入。 */
const PLATFORM_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots',
]

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

const result = await build({
  entryPoints: [join(root, 'client/index.jsx')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: PLATFORM_EXTERNALS,
  minify,
  sourcemap: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
})

const code = result.outputFiles[0].text
const indented = code
  .split('\n')
  .map((line) => (line.length > 0 ? `\t\t${line}` : line))
  .join('\n')

const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkg.name)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
${indented}
\t\treturn module.exports;
\t}
});
`

await writeFile(join(root, 'lib/client.js'), wrapped, 'utf8')
console.log(
  `built lib/client.js (${(Buffer.byteLength(wrapped) / 1024).toFixed(1)} KiB${minify ? ', minified' : ''})`,
)
