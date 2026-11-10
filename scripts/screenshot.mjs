#!/usr/bin/env node
/**
 * scripts/screenshot.mjs — 用无头 Chromium 把 preview/*.html 截成 PNG。
 * 本地：npm run screenshot；CI 在 build-client 工作流里自动生成并提交截图。
 */
import { chromium } from 'playwright'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const targets = [
  ['settings-light.html', 'settings-light.png'],
  ['settings-dark.html', 'settings-dark.png'],
]

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 })
  for (const [html, png] of targets) {
    const url = pathToFileURL(join(root, 'preview', html)).href
    await page.goto(url, { waitUntil: 'load' })
    await page.addStyleTag({
      content: '.agx-foot{position:static !important;backdrop-filter:none !important;background:none !important;padding-top:8px !important}',
    })
    await page.waitForTimeout(250)
    await page.screenshot({ path: join(root, 'preview', png), fullPage: true })
    console.log('captured', png)
  }
} finally {
  await browser.close()
}
