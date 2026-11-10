// Reproduce the PDF snapshot after `quarto render`.
const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require(process.env.PLAYWRIGHT_MODULE || 'playwright');}catch{pw=require('/Users/mspitschan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
(async()=>{
 const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(root,'output/pdf'),{recursive:true});
 const chrome=process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 const browser=await pw.chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
 try{
  const page=await browser.newPage();await page.goto(require('node:url').pathToFileURL(path.join(root,'_site/evidence.html')).href);
  await page.addStyleTag({content:'body{font-family:Arial,sans-serif;font-size:10pt}.doc-content p,.doc-content li{font-size:10pt;line-height:1.5}.doc-content h1,.doc-content h2,.doc-content h3{font-family:Arial,sans-serif}.doc-content h2,.doc-content h3{break-after:avoid}.evidence-record{break-inside:avoid;padding:12pt 0}.evidence-record dl{font-size:9pt;line-height:1.4}.evidence-record dt{margin-top:5pt}.doc-content{width:100%;max-width:none;margin:0}.audit-disclosure{display:none}.doc-shell{width:100%}a{overflow-wrap:anywhere}'});
  await page.pdf({path:path.join(root,'output/pdf/lightlogger-evidence.pdf'),format:'A4',printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="width:100%;font:8px Arial;text-align:center;color:#54686e">Light logger evidence · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',margin:{top:'16mm',bottom:'18mm',left:'17mm',right:'17mm'}});
 }finally{await browser.close();}
})();
