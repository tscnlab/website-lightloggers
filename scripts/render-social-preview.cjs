/* Rebuild the checked-in social preview from its HTML/CSS source.
 * Requires Playwright and Chrome; uses the same overrides as tests/browser.cjs.
 * Run: node scripts/render-social-preview.cjs
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
} catch (error) {
  if (process.env.PLAYWRIGHT_MODULE) throw error;
  playwright = require('/Users/mspitschan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
}
const root = path.resolve(__dirname, '..');
(async () => {
  const options = {headless: true};
  const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(chrome)) options.executablePath = chrome;
  const browser = await playwright.chromium.launch(options);
  try {
    const page = await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
    await page.goto(pathToFileURL(path.join(root,'assets/social-preview.html')).href);
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const img of document.images) await img.decode();
    });
    const output = path.join(root,'assets/social-preview.png');
    await page.screenshot({path:output});
    process.stdout.write(`Created ${output} (1200 × 630)\n`);
  } finally {
    await browser.close();
  }
})().catch(error => {process.stderr.write(error.stack+'\n');process.exitCode=1;});
