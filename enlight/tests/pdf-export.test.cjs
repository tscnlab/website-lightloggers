const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
global.PDFLib = require('../assets/vendor/pdf-lib.min.js');
global.fontkit = require('../assets/vendor/fontkit.umd.min.js');
const exporter = require('../assets/pdf-export.js');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/checklist.json'), 'utf8'));
const loadAsset = async filename => new Uint8Array(fs.readFileSync(path.join(root, filename)));

function sample() {
  return {
    format:'enlight-wizard', schemaVersion: 1, checklistVersion: data.meta.version, step:6,
    study: {title:'Example study: evening light and melatonin', authors:'Example authors (demonstration only)', date:'2026-11-11', reference:'Fictional example for testing the wizard', notes:'These entries illustrate the workflow and do not describe a real study.'},
    lightSource: {types:['room','emissive'],other:'',spectrum:['polychromatic','narrowband'],spectrumOther:''},
    responses:Object.fromEntries(data.items.map((item,i)=>[item.id,{status:'reported',location:'p. '+(3+Math.floor(i/3))+', Table '+(1+i%3),notes:''}]))
  };
}
test('all official fields and checkbox branches retain values and appearances', async()=>{
  const state=sample();
  const optional=data.items.find(item=>!item.essential);
  state.responses[optional.id]={status:'notApplicable',location:'',notes:'No pre-laboratory recording was part of this example.'};
  const unavailable=data.items.find(item=>item.essential);
  state.responses[unavailable.id]={status:'notAvailable',location:'',notes:'This information was not recorded.'};
  const bytes=await exporter.exportPdf(data,state,{loadAsset});
  const doc=await PDFLib.PDFDocument.load(bytes), form=doc.getForm();
  assert.equal(form.getFields().length,76);
  assert.ok(doc.getPageCount()>2);
  for(const [key,name] of Object.entries(data.generalFields)) assert.equal(form.getTextField(name).getText(),state.study[key]);
  for(const item of data.items){
    const answer=state.responses[item.id];
    assert.equal(form.getTextField(item.pdf.location).getText()||'',answer.status==='reported'?answer.location:'');
    assert.equal(form.getCheckBox(item.pdf.notAvailable).isChecked(),answer.status==='notAvailable');
    if(item.pdf.notApplicable) assert.equal(form.getCheckBox(item.pdf.notApplicable).isChecked(),answer.status==='notApplicable');
  }
  for(const type of data.lightSourceTypes) assert.equal(form.getCheckBox(type.pdfField).isChecked(),state.lightSource.types.includes(type.id));
  for(const type of data.spectrumTypes) assert.equal(form.getCheckBox(type.pdfField).isChecked(),true);
  for(const field of form.getFields()) for(const widget of field.acroField.getWidgets()) assert.ok(widget.getAppearances()?.normal,field.getName()+' appearance missing');
  fs.mkdirSync(path.join(root,'output/pdf'),{recursive:true});
  fs.writeFileSync(path.join(root,'output/pdf/enlight-example-completed.pdf'),bytes);
  fs.writeFileSync(path.join(root,'output/pdf/enlight-example-draft.json'),JSON.stringify(state,null,2));
});
test('long and Unicode scientific responses are preserved in the appendix',async()=>{
  const state=sample();
  state.study.title='Melanopic α-opic quantities: 250 µW/m²; Δλ = 20 nm; Müller et al. - a long title to test reliable continuation into the response appendix';
  state.responses['B2.4'].location='Supplementary methods, pp. 12–18; Figure S4; Tables S1 and S3; additional data';
  state.responses['B2.4'].notes=('α-opic EDI = 250 lx; luminance 85 cd/m²; λ = 480 ± 10 nm.\n').repeat(90)+'UNIQUE-END-OF-LONG-RESPONSE';
  const bytes=await exporter.exportPdf(data,state,{loadAsset});
  const doc=await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getForm().getTextField('fill_23').getText(),'See appendix: B2.4');
  assert.equal(doc.getForm().getTextField('Manuscript title').getText(),'See appendix: title');
  assert.ok(doc.getPageCount()>=5);
  fs.mkdirSync(path.join(root,'tmp/pdfs'),{recursive:true});
  fs.writeFileSync(path.join(root,'tmp/pdfs/long-unicode.pdf'),bytes);
});
test('blank draft exports without claiming completion',async()=>{
  const bytes=await exporter.exportPdf(data,{schemaVersion:1,checklistVersion:data.meta.version,study:{},lightSource:{types:[],spectrum:[]},responses:{}},{loadAsset,draft:true});
  const doc=await PDFLib.PDFDocument.load(bytes);
  assert.ok(doc.getPageCount()>2);
  assert.equal(doc.getForm().getCheckBox('Check Box1').isChecked(),false);
  fs.writeFileSync(path.join(root,'output/pdf/enlight-blank-draft.pdf'),bytes);
});
test('invalid essential N/A and incomplete completed exports fail explicitly',async()=>{
  const state=sample(); state.responses['A1.1'].status='notApplicable';
  await assert.rejects(exporter.exportPdf(data,state,{loadAsset,draft:true}),/applies to all studies/);
  state.responses['A1.1']={status:'reported',location:'',notes:''};
  await assert.rejects(exporter.exportPdf(data,state,{loadAsset}),/Complete the response/);
  state.responses['A1.1']={status:'reported',location:'p. 4',notes:''};
  state.lightSource.types=['invalid'];
  await assert.rejects(exporter.exportPdf(data,state,{loadAsset}),/unrecognised/);
  state.lightSource.types=['room']; state.responses['A1.1'].status='__proto__';
  await assert.rejects(exporter.exportPdf(data,state,{loadAsset,draft:true}),/Invalid status/);
});
test('deselected Other source text is excluded from the official field',async()=>{
  const state=sample();state.lightSource.other='Inactive older source description';
  state.responses['A1.1']={status:'notAvailable',location:'INACTIVE-LOCATION-SENTINEL',notes:''};
  const bytes=await exporter.exportPdf(data,state,{loadAsset});
  const doc=await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getForm().getTextField('Other').getText()||'','');
  assert.equal(doc.getForm().getCheckBox('Check Box21').isChecked(),false);
  fs.writeFileSync(path.join(root,'tmp/pdfs/inactive-fields.pdf'),bytes);
});
test('unavailable characters cause a useful error instead of data loss',async()=>{
  const state=sample();state.study.title='Unsupported character 🧙';
  await assert.rejects(exporter.exportPdf(data,state,{loadAsset}),/font cannot display.*U\+1F9D9/);
});
