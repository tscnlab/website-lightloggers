/* Derive browser and touch icons from the official ENLIGHT lightbulb.
 * Requires sharp 0.35.5; SHARP_MODULE may point to an installed module.
 * Original logo file is preserved. Run: node scripts/render-favicons.cjs
 */
'use strict';
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets/enlight-logo.png');
const outputs = [['favicon-lightbulb.png',64],['favicon.png',64],['apple-touch-icon.png',180]];
(async()=>{
  for(const [name,size] of outputs){
    await sharp(source).extract({left:8,top:2,width:108,height:108}).resize(size,size).png({compressionLevel:9}).toFile(path.join(root,'assets',name));
    console.log('Created '+name+' ('+size+' × '+size+').');
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
