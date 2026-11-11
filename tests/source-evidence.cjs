'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const library=require('../data/library.json');
const evidence=require('../data/source-evidence.json');
const {indicatorEvidence,sourcePassages,filterPairs}=require('../assets/app.js');
const indicator=(name,key,kind='property',studies=library.studies)=>indicatorEvidence(library,evidence,library.devices.find(d=>d.name===name),studies,key,kind);

test('every study has source passages, and every highlighted PDF has an identity and valid coordinates',()=>{
  assert.deepEqual(Object.keys(evidence.studies).sort(),library.studies.map(s=>s.id).sort());
  for(const study of library.studies){
    const {document:doc,passages}=evidence.studies[study.id];
    assert(passages.length,study.id);
    assert.equal(new Set(passages.map(p=>p.id)).size,passages.length);
    for(const field of ['protocol','reference','finding'])assert(passages.some(p=>p.fields.includes(field)),`${study.id}: ${field}`);
    if(doc.pdfPath?.startsWith('sources/')){
      const bytes=fs.readFileSync(path.resolve(__dirname,'..',doc.pdfPath));
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),doc.sha256,study.id);
      if(doc.redistribution?.basis==='user-supplied'){
        assert(doc.redistribution.filename?.endsWith('.pdf') && doc.redistribution.date,study.id);
        assert(doc.redistribution.url.startsWith('https://') && doc.redistribution.note,study.id);
      }else{
        assert(doc.license && doc.licenseUrl?.startsWith('https://'),study.id);
      }
      if(doc.license && !doc.license.startsWith('CC BY')){
        assert(['repository-permission','publisher-open-access','public-domain'].includes(doc.redistribution?.basis),study.id);
        assert(doc.redistribution.url.startsWith('https://') && doc.redistribution.note,study.id);
      }
    }
    assert(doc.pdfPath?.startsWith('sources/'),`${study.id}: hosted paper`);
    assert(passages.every(p=>p.pdf),`${study.id}: passage coordinates`);
    for(const p of passages){
      assert(p.url.startsWith('https://'),p.id);
      assert(p.devices.every(d=>study.devices.includes(d)),p.id);
      if(!p.pdf)continue;
      assert.match(doc.sha256,/^[a-f0-9]{64}$/);
      assert(p.pdf.page>=1 && p.pdf.page<=doc.pages,p.id);
      assert(p.pdf.rects.length,p.id);
      for(const [x,y,w,h] of p.pdf.rects){assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=1.00001&&y+h<=1.00001,p.id);}
    }
  }
});
test('comparisons during wear and between units remain included and are labelled',()=>{
  for(const id of ['sah-2026','bhandari-2021']){
    const study=library.studies.find(s=>s.id===id);
    assert.equal(study.evidenceType,'Comparison during wear');
    assert(!evidence.studies[id].passages.some(p=>p.properties.includes('Accuracy')));
    assert(filterPairs(library,{q:study.doi}).length);
  }
  const markvart=library.studies.find(s=>s.id==='markvart-2015');
  assert.equal(markvart.evidenceType,'Between-unit comparison');
  assert.match(markvart.finding,/60%/);
});
test('property evidence remains specific to the tested model and measurement',()=>{
  assert.equal(indicator('Daysimeter-S','Accuracy').status,'none');
  assert.equal(indicator('Daysimeter-D','Accuracy').status,'examined');
  assert.equal(indicator('Actiwatch Spectrum Pro','Accuracy').status,'none');
  assert(sourcePassages(evidence,'kore-2026','LYS Button','Angular response').every(p=>p.scope.includes('Photopic')));
  assert(sourcePassages(evidence,'mohammadian-2024','SpectraWear','Angular response').every(p=>p.scope.includes('Melanopic')));
  assert.equal(sourcePassages(evidence,'kore-2026','Actiwatch Spectrum Plus','Melanopic EDI').length,0);
});
test('measurement range requires a range test, not just several light levels',()=>{
  assert.equal(indicator('ActLumus','Dynamic range','property',library.studies.filter(s=>s.id==='gemici-2026')).status,'none');
  assert.equal(indicator('ActLumus','Dynamic range','property',library.studies.filter(s=>s.id==='ishihara-2025')).status,'examined');
});
test('combined metric columns distinguish output only from examined',()=>{
  const selected=library.studies.filter(s=>s.id==='stevenson-2025');
  assert.equal(indicator('LYS Button','Melanopic EDI','metric',selected).status,'output');
  assert.equal(indicator('LYS Button','Illuminance','metric',selected).status,'examined');
  assert.equal(indicator('ActTrust2','Melanopic EDI','metric').status,'none');
  assert.equal(indicator('SpectraWear','Illuminance','metric').status,'examined');
  assert.equal(indicator('lido','Melanopic EDI','metric',library.studies.filter(s=>s.id==='stampfli-2023')).status,'examined');
});
