#!/usr/bin/env node
/**
 * scripts/screenshot.mjs — 用无头 Chromium 把 preview/*.html 截成 PNG。
 *
 * 本地：npm run screenshot（需要 playwright chromium）。
 * CI：PW_CHANNEL=chrome 时直接复用 GitHub Runner 预装的 Chrome，不下载浏览器。
 */
import { chromium } from 'playwright'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const channel = process.env.PW_CHANNEL || undefined
const targets = [
  ['settings-light.html', 'settings-light.png'],
  ['settings-dark.html', 'settings-dark.png'],
]

const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) })
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
