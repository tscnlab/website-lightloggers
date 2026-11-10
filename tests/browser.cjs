/* Browser QA for the rendered, entirely static directory.
 * Run after `quarto render`:
 *   PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser.cjs
 * Optional: BASE_URL=http://127.0.0.1:4173/, CHROME_PATH=/path/to/chrome
 * This script never sends an email or opens a mail client.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL, fileURLToPath} = require('node:url');
let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
} catch (error) {
  if (process.env.PLAYWRIGHT_MODULE) throw error;
  playwright = require('/Users/mspitschan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
}

const root = path.resolve(__dirname, '..');
const site = path.join(root, '_site');
const preview = path.join(root, 'preview');
const library = JSON.parse(fs.readFileSync(path.join(root, 'data/library.json'), 'utf8'));
const checks = [];
const consoleErrors = [];
const pageErrors = [];
const blockedMailto = [];
fs.mkdirSync(preview, {recursive: true});

async function check(name, operation) {
  try {
    const detail = await operation();
    checks.push({name, pass: true, ...(detail ? {detail} : {})});
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    checks.push({name, pass: false, error: error.stack || String(error)});
    process.stdout.write(`FAIL ${name}: ${error.message}\n`);
  }
}

function pageUrl(base, relative = 'index.html') {
  return new URL(relative, base).href;
}

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert(dimensions.document <= dimensions.viewport + 1, JSON.stringify(dimensions));
  assert(dimensions.body <= dimensions.viewport + 1, JSON.stringify(dimensions));
  return dimensions;
}

async function assertVisibleImagesLoaded(page) {
  const images = page.locator('img:visible');
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(node => new Promise((resolve, reject) => {
      if (node.complete) return node.naturalWidth > 0 ? resolve() : reject(new Error('Image did not load: ' + node.src));
      const timeout = setTimeout(() => reject(new Error('Image timed out: ' + node.src)), 10000);
      node.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, {once: true});
      node.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Image failed: ' + node.src)); }, {once: true});
    }));
  }
}

async function main() {
  const options = {headless: true};
  const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(chrome)) options.executablePath = chrome;
  const browser = await playwright.chromium.launch(options);
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1, acceptDownloads: true, reducedMotion: 'reduce'});
    // Capture clipboard text locally and suppress every mailto path. No external
    // mail handler or submission service is exercised by this test.
    await context.addInitScript(() => {
      window.__qaClipboard = [];
      window.__qaMailto = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {writeText: async text => { window.__qaClipboard.push(text); }},
      });
      const anchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.href.startsWith('mailto:')) { window.__qaMailto.push(this.href); return; }
        return anchorClick.call(this);
      };
      document.addEventListener('click', event => {
        const anchor = event.target.closest?.('a[href^="mailto:"]');
        if (anchor) { event.preventDefault(); window.__qaMailto.push(anchor.href); }
      }, true);
    });
    const page = await context.newPage();
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', error => pageErrors.push(error.message));
    let base = process.env.BASE_URL || 'http://127.0.0.1:4173/';
    try {
      const response = await page.goto(pageUrl(base), {waitUntil: 'load', timeout: 10000});
      if (response) assert(response.ok(), `HTTP ${response.status()} for ${response.url()}`);
      await page.locator('#results > .device-record').first().waitFor({timeout: 10000});
    } catch (error) {
      if (process.env.BASE_URL) throw error;
      base = pathToFileURL(site + path.sep).href;
      await page.goto(pageUrl(base), {waitUntil: 'load'});
      await page.locator('#results > .device-record').first().waitFor();
    }
    const fresh = async (relative = 'index.html') => {
      await page.goto(pageUrl(base, relative), {waitUntil: 'load'});
      if (relative.startsWith('index.html')) await page.locator('#results').waitFor();
    };
    const closeDialog = async id => {
      await page.locator(`${id} [data-close]`).click();
      await page.waitForFunction(selector => !document.querySelector(selector).open, id);
    };

    await check('Desktop: text-only device records and native disclosure controls', async () => {
      await fresh();
      assert.equal(await page.locator('#results > details.device-record').count(), library.devices.length);
      assert.equal(await page.locator('#results > details.device-record[open]').count(), 0);
      assert.equal(await page.locator('#result-count').textContent(), `${library.devices.length} device entries · ${library.studies.length} studies`);
      assert.equal(await page.locator('main').count(), 1, 'Exactly one main landmark');
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)');
      assert(await page.locator('#page-title').isVisible(), 'Page title is visible');
      assert.equal(await page.locator('#page-title').textContent(), 'Wearable light logger validations');
      for (const device of library.devices) {
        const record = page.locator(`#device-${device.id}`);
        assert.equal(await record.locator(':scope > summary').count(), 1, device.name + ' native disclosure summary');
        assert.equal(await record.locator(':scope > summary img, :scope > summary svg').count(), 0, device.name + ' text-only record');
        assert.equal(await record.locator('.device-name').textContent(), device.name);
      }
      assert.equal(await page.locator('.output-sources').count(), 0);
      const spectra=page.locator('#device-spectrawear > summary');
      assert.equal(await spectra.locator('.feature[data-metric="Illuminance"] .confirmed-check').count(),1);
      assert.equal(await spectra.locator('.examined[data-metric="Illuminance"] .confirmed-check').count(),0);
      assert.equal(await spectra.locator('.examined[data-metric="Melanopic EDI"] .confirmed-check').count(),1);
      assert.equal(await spectra.locator('.evidence-square').count(),library.studies.filter(s=>s.devices.includes('SpectraWear')).length);
      assert.equal(await page.locator('#device-higgins-wrist').count(),0);

      assert.equal(await page.locator('#device-aarts-anonymised').count(), 0);
      const condor=await page.locator('.family-heading').evaluateAll(nodes=>{const h=nodes.find(n=>n.textContent.includes('Condor Instruments'));const ids=[];for(let n=h?.nextElementSibling;n?.classList.contains('device-record');n=n.nextElementSibling)ids.push(n.id);return ids;});
      assert.deepEqual(condor,['device-actlumus','device-acttrust','device-acttrust2']);
      const dimensions = await assertNoHorizontalOverflow(page);
      await assertVisibleImagesLoaded(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({path: path.join(preview, 'desktop.png'), fullPage: true});
      await page.screenshot({path: path.join(preview, 'website-preview.png'), fullPage: false});
      return {...dimensions, devices: library.devices.length, studies: library.studies.length};
    });

    await check('Device search expands the ActLumus papers with original, DOI and PubMed links', async () => {
      await fresh();
      await page.locator('#search').fill('ActLumus');
      assert.equal(await page.locator('#results > .device-record').count(), 1);
      const record = page.locator('#device-actlumus');
      assert.equal(await record.evaluate(node => node.open), false);
      await record.locator(':scope > summary').click();
      assert.equal(await record.evaluate(node => node.open), true);
      const expected = library.studies.filter(study => study.devices.includes('ActLumus'));
      assert(expected.length >= 3, 'ActLumus retains the three original records');
      assert.equal(await record.locator('.study-record').count(), expected.length);
      for (const study of expected) {
        const article = record.locator(`#actlumus-${study.id}`);
        const links = await article.locator('.study-links a').evaluateAll(nodes => nodes.map(node => node.href));
        assert(links.includes(study.url), study.url);
        assert(links.includes(`https://doi.org/${study.doi}`), study.doi);
        if (study.pubmedUrl) {
          assert(links.includes(study.pubmedUrl), study.pubmedUrl);
          assert.equal(await article.locator('.study-links a', {hasText: 'PubMed'}).getAttribute('href'), study.pubmedUrl);
        } else {
          assert.equal(await article.locator('.study-links a', {hasText: 'PubMed'}).count(), 0);
        }
      }
      await record.locator('.study-detail').first().locator('summary').click();
      assert((await record.textContent()).includes(expected[0].protocol));
      await assertVisibleImagesLoaded(page);
      await assertNoHorizontalOverflow(page);
      assert.equal(await page.locator('dialog[open]').count(), 0, 'Evidence expands inline');
    });

    await check('Legacy LYS link opens the merged device', async () => {
      await fresh('index.html?device=lys');
      assert(await page.locator('#device-lys-button').evaluate(node => node.open));
      assert.equal(await page.locator('#device-lys').count(), 0);
    });

    await check('Measurement filtering excludes ActTrust2 from melanopic EDI', async () => {
      await fresh();
      await page.locator('#search').fill('ActTrust2');
      assert.equal(await page.locator('#results > .device-record').count(), 1);
      await page.locator('#metric').selectOption('Melanopic EDI');
      assert.equal(await page.locator('#results > .device-record').count(), 0);
      assert.equal(await page.locator('#results .empty').count(), 1);
      assert.equal(await page.locator('#result-count').textContent(), '0 device entries · 0 studies');
      await page.locator('#reset').click();
      assert.equal(await page.locator('#metric').inputValue(), '');
      assert.equal(await page.locator('#search').inputValue(), '');
      assert.equal(await page.locator('#results > .device-record').count(), library.devices.length);
    });

    await check('Studies tab shows every paper, journal logos and sources', async () => {
      await fresh();
      await page.locator('#studies-tab').click();
      assert.equal(await page.locator('#studies-tab').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#devices-tab').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('#results > .study-record').count(), library.studies.length);
      assert.equal(await page.locator('#results > .study-record .study-detail[open]').count(), 0);
      for (const study of library.studies) {
        const record = page.locator(`#results > #${study.id}`);
        const venue = library.venues?.[study.venue];
        assert(venue, study.id + ' venue metadata');
        assert.equal(await record.locator('.venue-name').textContent(), venue.name);
        assert.equal(await record.locator('.venue a').getAttribute('href'), venue.url);
        if (venue.logo) assert.equal(await record.locator('.venue-logo').getAttribute('src'), venue.logo);
        if (study.pubmedUrl) assert.equal(await record.locator(`.study-links a[href="${study.pubmedUrl}"]`).count(), 1);
      }
      await assertVisibleImagesLoaded(page);
      await assertNoHorizontalOverflow(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({path: path.join(preview, 'studies-preview.png'), fullPage: false});
      await page.locator('#devices-tab').click();
      assert.equal(await page.locator('#results > .device-record').count(), library.devices.length);
    });

    await check('Study measurement match names exclude nonmatching co-tested devices', async () => {
      await fresh();
      await page.locator('#studies-tab').click();
      await page.locator('#search').fill('Kore');
      await page.locator('#metric').selectOption('Melanopic EDI');
      assert.equal(await page.locator('#results > .study-record').count(), 1);
      const record = page.locator('#kore-2026');
      const matching = await record.locator('.matching-devices').textContent();
      assert(matching.includes('Blue Iris Speck v1.0'));
      assert(matching.includes('LYS Button'));
      assert(!matching.includes('Actiwatch'), 'Actiwatch was not tested for this endpoint');
      assert((await record.locator('.study-devices').first().textContent()).includes('Actiwatch Spectrum Plus'), 'Full paper device list remains visible separately');
      await record.locator('.study-detail summary').click();
      assert(await record.locator('.study-detail').evaluate(node => node.open));
      assert((await record.locator('.study-details').textContent()).includes('Actiwatch Spectrum Plus: Illuminance, Angular response'));
    });

    await check('No-match state and clear-search recovery', async () => {
      await fresh();
      await page.locator('#search').fill('zzzz_nonexistent_light_logger_987');
      assert.equal(await page.locator('#result-count').textContent(), '0 device entries · 0 studies');
      assert.equal(await page.locator('#results .empty').count(), 1);
      await page.locator('#results [data-reset]').click();
      assert.equal(await page.locator('#search').inputValue(), '');
      assert.equal(await page.locator('#results > .device-record').count(), library.devices.length);
      assert(await page.locator('#reset').isHidden());
    });

    await check('Submission validation, clipboard and text download without sending', async () => {
      await fresh();
      await page.locator('[data-submit]').first().click();
      assert(await page.locator('#submit-dialog').evaluate(node => node.open));
      await page.locator('#copy-submission').click();
      assert(await page.locator('#submission-result').isHidden());
      assert.equal(await page.evaluate(() => window.__qaClipboard.length), 0);
      await page.locator('#paper-source').fill('javascript:alert(1)');
      await page.locator('#paper-title').fill('A browser QA validation suggestion');
      await page.locator('#paper-device').fill('QA sensor model');
      await page.locator('#copy-submission').click();
      assert.equal(await page.locator('#paper-source').evaluate(node => node.validity.valid), false);
      assert(await page.locator('#submission-result').isHidden());
      await page.locator('#paper-source').fill('10.1093/sleep/zsaf358');
      await page.locator('#paper-status').selectOption('Peer reviewed');
      await page.locator('#paper-notes').fill('Reference-instrument comparison; QA only.');
      await page.locator('#paper-name').fill('Automated local QA');
      await page.locator('#copy-submission').click();
      await page.locator('#submission-result').waitFor({state: 'visible'});
      const draft = await page.locator('#submission-preview').textContent();
      assert(draft.includes('10.1093/sleep/zsaf358'));
      assert(draft.includes('QA sensor model'));
      assert(draft.includes('Reference-instrument comparison; QA only.'));
      assert.equal(await page.evaluate(() => window.__qaClipboard.at(-1)), draft);
      const downloadEvent = page.waitForEvent('download');
      await page.locator('#download-submission').click();
      const download = await downloadEvent;
      assert.equal(download.suggestedFilename(), 'light-logger-validation-submission.txt');
      assert.equal(fs.readFileSync(await download.path(), 'utf8'), draft);
      assert.equal(await page.evaluate(() => window.__qaMailto.length), 0);
      // Test the encoded draft while suppressing the browser's mail handler.
      await page.locator('#submission-form button[type="submit"]').click();
      const outgoing = await page.evaluate(() => window.__qaMailto.at(-1));
      const mail = new URL(outgoing);
      const config = await page.locator('#site-config').evaluate(node => JSON.parse(node.textContent));
      assert.equal(mail.pathname, config.submissionEmail);
      assert.equal(mail.searchParams.get('body'), draft);
      assert(mail.searchParams.get('subject').includes('QA sensor model'));
      assert((await page.locator('#submission-status').textContent()).includes('has not sent'));
      blockedMailto.push(outgoing);
      await closeDialog('#submit-dialog');
    });

    await check('Legacy device and study links open the corresponding native details', async () => {
      await fresh('index.html?device=actlumus');
      assert(await page.locator('#device-actlumus').evaluate(node => node.open));
      assert.equal(await page.locator('#device-actlumus .study-record').count(), library.studies.filter(study => study.devices.includes('ActLumus')).length);
      assert.equal(await page.locator('#results > .device-record[open]').count(), 1);
      assert.equal(new URL(page.url()).searchParams.get('device'), 'actlumus');
      await fresh('index.html?study=kore-2026');
      assert.equal(await page.locator('#studies-tab').getAttribute('aria-pressed'), 'true');
      assert(await page.locator('#kore-2026 .study-detail').evaluate(node => node.open));
      assert.equal(await page.locator('#results .study-detail[open]').count(), 1);
      assert.equal(await page.locator('dialog[open]').count(), 0);
    });

    await check('Evidence notebook: complete inventory, source links and one main landmark', async () => {
      await fresh('evidence.html');
      assert.equal(await page.locator('.evidence-record').count(), library.studies.length);
      assert.equal(await page.locator('main').count(), 1, 'No nested main landmarks');
      const text = await page.locator('.doc-content').textContent();
      assert(text.includes(library.yearPolicy));
      for (const study of library.studies) {
        const record = page.locator(`#${study.id}`);
        assert.equal(await record.count(), 1);
        assert(text.replace(/\s+/g,' ').includes(study.sourceLocator.replace(/\s+/g,' ')), study.id + ' source locator');
        assert(await record.locator(`a[href="${study.url}"]`).count() >= 1, study.id + ' original source');
        assert(await record.locator(`a[href="https://doi.org/${study.doi}"]`).count() >= 1, study.id + ' DOI');
        if (study.pubmedUrl) assert(await record.locator(`a[href="${study.pubmedUrl}"]`).count() >= 1, study.id + ' PubMed');
      }
      const sourceDownloads = await page.locator('a[download]').evaluateAll(nodes => nodes.map(node => new URL(node.href).pathname));
      assert(sourceDownloads.some(name => name.endsWith('/index.qmd')));
      assert(sourceDownloads.some(name => name.endsWith('/evidence.qmd')));
      const dimensions = await assertNoHorizontalOverflow(page);
      await assertVisibleImagesLoaded(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({path: path.join(preview, 'evidence.png'), fullPage: false});
      return dimensions;
    });

    await check('Rendered internal links and image assets exist', async () => {
      const missing = [];
      for (const filename of ['index.html', 'evidence.html']) {
        await fresh(filename);
        const refs = await page.locator('a[href],script[src],link[href],img[src]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href') || node.getAttribute('src')));
        for (const ref of refs) {
          if (!ref || /^(https?:|mailto:|data:|blob:|javascript:)/i.test(ref)) continue;
          const url = new URL(ref, pathToFileURL(path.join(site, filename)));
          if (!fs.existsSync(fileURLToPath(url))) missing.push(`${filename} → ${ref}`);
          if (url.hash && url.pathname.endsWith(filename)) {
            const id = decodeURIComponent(url.hash.slice(1));
            assert(await page.evaluate(id => !!document.getElementById(id), id), `Missing anchor ${filename}${url.hash}`);
          }
        }
      }
      assert.deepEqual(missing, []);
    });

    await check('Mobile layout, expanded evidence, form and screenshots', async () => {
      await page.setViewportSize({width: 390, height: 844});
      await fresh();
      const dimensions = await assertNoHorizontalOverflow(page);
      assert.equal(await page.locator('#results > .device-record').count(), library.devices.length);
      await assertVisibleImagesLoaded(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({path: path.join(preview, 'mobile.png'), fullPage: true});
      await page.screenshot({path: path.join(preview, 'mobile-preview.png'), fullPage: false});
      await page.locator('#search').fill('ActLumus');
      assert.equal(await page.locator('#results > .device-record').count(), 1);
      await page.locator('#device-actlumus > summary').click();
      assert(await page.locator('#device-actlumus').evaluate(node => node.open));
      await assertVisibleImagesLoaded(page);
      await assertNoHorizontalOverflow(page);
      await page.locator('#device-actlumus').scrollIntoViewIfNeeded();
      await page.screenshot({path: path.join(preview, 'mobile-detail.png'), fullPage: true});
      await page.locator('[data-submit]').first().click();
      assert(await page.locator('#paper-source').isVisible());
      await assertNoHorizontalOverflow(page);
      await closeDialog('#submit-dialog');
      await fresh('index.html?view=studies');
      await assertVisibleImagesLoaded(page);
      await assertNoHorizontalOverflow(page);
      await fresh('evidence.html');
      await assertNoHorizontalOverflow(page);
      return dimensions;
    });

    blockedMailto.push(...await page.evaluate(() => window.__qaMailto || []));
    await check('No browser JavaScript or console errors', async () => {
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(consoleErrors, []);
    });
    const result = {base, checkedAt: new Date().toISOString(), checks, pageErrors, consoleErrors, blockedMailto, passed: checks.every(c => c.pass)};
    fs.writeFileSync(path.join(preview, 'browser-qa.json'), JSON.stringify(result, null, 2) + '\n');
    process.stdout.write(`${checks.filter(c=>c.pass).length}/${checks.length} browser checks passed. Report: preview/browser-qa.json\n`);
    if (!result.passed) process.exitCode = 1;
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  fs.writeFileSync(path.join(preview, 'browser-qa.json'), JSON.stringify({passed: false, fatal: error.stack || String(error), checks}, null, 2) + '\n');
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
