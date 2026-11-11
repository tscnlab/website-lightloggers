'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let playwright;
try{playwright=require(process.env.PLAYWRIGHT_MODULE || 'playwright');}catch{playwright=require('/Users/mspitschan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const root=path.resolve(__dirname,'..');
const evidence=require('../data/source-evidence.json');
const base=process.env.BASE_URL || 'http://127.0.0.1:4173/lightloggers/';
const out=path.join(root,'preview');
const results=[];
async function main(){
 const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function check(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.stack});console.log('FAIL',name,e.message);}}
 async function open(study,passage){await page.goto(new URL(`source.html?study=${study}&passage=${passage}`,base).href);await page.waitForFunction(()=>document.querySelector('#pdf-status').textContent.startsWith('Highlighted passage'),{},{timeout:30000});}
 async function noOverflow(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await check('Metric references identify studies without expanding the device',async()=>{
  await page.goto(base);
  const row=page.locator('#device-lys-button');const angle=row.locator('[data-evidence-key="Angular response"]');
  await angle.hover();assert.match(await angle.getAttribute('title'),/Kore/);assert.doesNotMatch(await angle.getAttribute('title'),/Stevenson/);
  assert(await angle.locator('.metric-tooltip').isVisible());
  await angle.click();assert.equal(await row.evaluate(n=>n.open),false);
  assert.match(await page.locator('#evidence-content').textContent(),/Photopic illuminance/);
  assert.equal(await page.locator('#evidence-content .indicator-study').count(),1);
  await page.screenshot({path:path.join(out,'metric-sources.png')});
  await page.locator('#evidence-dialog [data-close]').click();
  await page.locator('#search').fill('Stevenson');
  const output=page.locator('[data-evidence-key="Melanopic EDI"]');
  assert(await output.evaluate(n=>n.classList.contains('output-only')));
  await output.focus();await page.keyboard.press('Enter');
  assert.match(await page.locator('#evidence-content').textContent(),/output is described/);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#evidence-dialog').evaluate(n=>n.open),false);
 });
 await check('Study squares wrap after five without changing row width',async()=>{
  await page.goto(base);const squares=page.locator('.study-squares').first();
  await squares.evaluate(n=>{while(n.children.length<12)n.append(n.firstElementChild.cloneNode(true));});
  const boxes=await squares.locator('.evidence-square').evaluateAll(nodes=>nodes.map(n=>({x:n.offsetLeft,y:n.offsetTop})));
  assert.equal(boxes[0].y,boxes[4].y);assert(boxes[5].y>boxes[4].y);assert.equal(boxes[5].x,boxes[0].x);assert(boxes[10].y>boxes[9].y);await noOverflow();
 });
 await check('PDF reader opens exact passage and keeps highlights aligned through zoom and navigation',async()=>{
  await open('stampfli-2023','accuracy');assert.equal(await page.locator('#page-number').inputValue(),'9');
  assert(await page.locator('.pdf-highlight').count()>0);
  const geometry=()=>page.locator('.pdf-highlight').first().evaluate(n=>({left:n.offsetLeft/n.parentElement.clientWidth,top:n.offsetTop/n.parentElement.clientHeight}));
  const before=await geometry();await page.locator('#pdf-zoom').selectOption('1.5');
  await page.waitForFunction(()=>document.querySelector('.pdf-highlight'));
  const after=await geometry();assert(Math.abs(before.top-after.top)<.003);assert(Math.abs(before.left-after.left)<.003);
  await page.locator('#pdf-zoom').selectOption('fit');
  await page.locator('[data-passage="angle"]').click();await page.waitForFunction(()=>document.querySelector('#page-number').value==='10');
  assert.match(await page.locator('#pdf-status').textContent(),/Highlighted/);
  await page.locator('#page-next').click();await page.waitForFunction(()=>document.querySelector('#page-number').value==='11');assert.equal(await page.locator('.pdf-highlight').count(),0);
  await page.locator('#jump-passage').click();await page.waitForFunction(()=>document.querySelector('.pdf-highlight'));
  await noOverflow();await page.screenshot({path:path.join(out,'source-reader.png')});
 });
 await check('Every hosted paper opens with its saved highlight',async()=>{
  for(const [sid,source] of Object.entries(evidence.studies)){
   if(!source.document.pdfPath?.startsWith('sources/'))continue;
   const passage=source.passages.find(p=>p.pdf);await open(sid,passage.id);
   assert.equal(await page.locator('#page-number').inputValue(),String(passage.pdf.page),sid);
   assert.equal(await page.locator('.pdf-highlight').count(),passage.pdf.rects.length,sid);
  }
 });
 await check('Different PDF editions never inherit the saved highlight',async()=>{
  await open('stampfli-2023','accuracy');await page.locator('#local-pdf').setInputFiles(path.join(root,'sources/stone-2020.pdf'));
  await page.waitForFunction(()=>document.querySelector('#pdf-status').textContent.includes('different PDF edition'));
  assert.equal(await page.locator('.pdf-highlight').count(),0);assert.equal(await page.locator('#page-number').inputValue(),'1');
  await page.locator('#local-pdf').setInputFiles(path.join(root,'sources/stampfli-2023.pdf'));
  await page.waitForFunction(()=>document.querySelector('#pdf-status').textContent.startsWith('Highlighted'));
  assert.equal(await page.locator('#page-number').inputValue(),'9');
 });
 await check('Abstract source and mobile PDF reader remain usable',async()=>{
  await page.goto(new URL('source.html?study=markvart-2015',base).href);
  assert.match(await page.locator('#passage-location').textContent(),/Abstract/);assert(await page.locator('#pdf-reader').isHidden());
  assert.match(await page.locator('#passage-quote').textContent(),/48 Actiwatch/);
  await page.setViewportSize({width:390,height:844});await open('stampfli-2023','accuracy');await noOverflow();
  await page.screenshot({path:path.join(out,'source-reader-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await open('pilehchiha-2026','comparison');await page.screenshot({path:path.join(out,'source-reader-pilehchiha.png')});
 });
 await check('No source-reader JavaScript errors',async()=>assert.deepEqual(errors,[]));
 await browser.close();
 fs.writeFileSync(path.join(out,'source-reader-qa.json'),JSON.stringify(results,null,2));
 assert(results.every(r=>r.pass),`${results.filter(r=>!r.pass).length} source reader checks failed`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
