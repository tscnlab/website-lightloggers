/* Rebuild the static 1200 x 630 social image from its SVG layout and official
 * logos. The ENLIGHT wordmark is clipped to its existing lightbulb symbol.
 * Requires sharp (0.35.5 used) and Georgia/Arial or their named fallback fonts.
 * Run: node scripts/render-social-preview.cjs
 * Set SHARP_MODULE to an absolute module path when sharp is not installed here.
 * Normal Quarto builds copy the checked-in image and need no image dependencies.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '..');
const embed = name => 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets', name)).toString('base64');
let svg = fs.readFileSync(path.join(root, 'assets/social-preview.svg'), 'utf8');
svg = svg.replace('xlink:href="enlight-logo.png"', 'xlink:href="' + embed('enlight-logo.png') + '"').replace('xlink:href="tscn-logo.png"', 'xlink:href="' + embed('tscn-logo.png') + '"');
const output = path.join(root, 'assets/social-preview.png');
sharp(Buffer.from(svg), {density:144}).resize(1200,630).png({compressionLevel:9}).toFile(output)
  .then(info=>{ if(info.width!==1200||info.height!==630||info.size>=5_000_000) throw new Error('Unexpected social image dimensions or size.'); console.log('Created social-preview.png (1200 × 630; '+info.size+' bytes).'); })
  .catch(error=>{ console.error(error); process.exitCode=1; });
