'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const library = require('../data/library.json');
const {filterPairs, sortDevices, sourceIsValid, submissionText} = require('../assets/app.js');

const search = state => filterPairs(library, state);
const names = pairs => [...new Set(pairs.map(pair => pair.device.name))].sort();
const studyIds = pairs => [...new Set(pairs.map(pair => pair.study.id))].sort();

test('validation sorting counts distinct papers, breaks ties by name and preserves the input', () => {
  const alpha={id:'a',name:'Alpha'}, beta={id:'b',name:'Beta'}, gamma={id:'c',name:'Gamma'};
  const devices=[gamma,alpha,beta];
  const pairs=[
    {device:alpha,study:{id:'paper-1'}},
    {device:alpha,study:{id:'paper-1'}},
    {device:beta,study:{id:'paper-1'}},
    {device:beta,study:{id:'paper-2'}},
    {device:gamma,study:{id:'paper-2'}},
    {device:gamma,study:{id:'paper-3'}}
  ];
  assert.deepEqual(sortDevices(devices,pairs,'most').map(d=>d.name),['Beta','Gamma','Alpha']);
  assert.deepEqual(sortDevices(devices,pairs,'fewest').map(d=>d.name),['Alpha','Beta','Gamma']);
  assert.deepEqual(sortDevices(devices,pairs,'name').map(d=>d.name),['Alpha','Beta','Gamma']);
  assert.deepEqual(devices,[gamma,alpha,beta]);
});

test('validation sorting follows matching studies after a measurement filter', () => {
  const pairs=search({metric:'Melanopic EDI'});
  const devices=[...new Set(pairs.map(p=>p.device))];
  const sorted=sortDevices(devices,pairs,'most');
  assert.deepEqual(sorted.slice(0,2).map(d=>d.name),['ActLumus','SpectraWear']);
  for(const device of sorted) {
    const expected=library.studies.filter(s=>s.deviceMetrics[device.name]?.includes('Melanopic EDI'));
    assert.equal(new Set(pairs.filter(p=>p.device===device).map(p=>p.study.id)).size,expected.length);
  }
});

// These are scientific regression checks against the curated literature snapshot.
// If new evidence changes an expectation, review the source before updating it.
test('melanopic EDI is never inherited from another device in the same study', () => {
  const kore = search({q: 'Kore', metric: 'Melanopic EDI'});
  assert.deepEqual(names(kore), ['Blue Iris Speck v1.0', 'LYS Button']);
  assert.deepEqual(studyIds(kore), ['kore-2026']);
  assert.equal(search({q: 'Actiwatch Spectrum Plus', metric: 'Melanopic EDI'}).length, 0);
  assert.ok(search({q: 'Actiwatch Spectrum Plus', metric: 'Illuminance'}).length > 0);
});

test('ActTrust2 does not inherit ActLumus melanopic endpoints in Gemici', () => {
  const gemici = search({q: 'Gemici', metric: 'Melanopic EDI'});
  assert.deepEqual(names(gemici), ['ActLumus']);
  assert.equal(search({q: 'ActTrust2', metric: 'Melanopic EDI'}).length, 0);
  assert.deepEqual(studyIds(search({q: 'ActTrust2', metric: 'Illuminance'})), ['gemici-2026']);
});

test('status and metric must be supported by the same device-study pair', () => {
  assert.ok(search({q: 'ActLumus', status: 'Peer reviewed'}).length > 0);
  assert.ok(search({q: 'ActLumus', metric: 'Melanopic EDI'}).length > 0);
  assert.equal(search({q: 'ActLumus', status: 'Peer reviewed', metric: 'Melanopic EDI'}).length, 0);
  assert.deepEqual(
    studyIds(search({q: 'ActLumus', status: 'Preprint', metric: 'Melanopic EDI'})),
    ['gemici-2026', 'pilehchiha-2026']
  );
});

test('historical melanopic illuminance remains distinct from explicitly indexed EDI', () => {
  assert.equal(search({q: 'Ishihara', metric: 'Other circadian metrics'}).length, 0);
  assert.equal(search({q: 'Ishihara', metric: 'Melanopic EDI'}).length, 0);
});

test('laboratory and field filters include mixed studies without conflating single settings', () => {
  const lab = studyIds(search({setting: 'Laboratory'}));
  const field = studyIds(search({setting: 'Field'}));
  assert.ok(lab.includes('price-2017'));
  assert.ok(!field.includes('price-2017'));
  assert.ok(field.includes('gemici-2026'));
  assert.ok(!lab.includes('gemici-2026'));
  assert.ok(lab.includes('kore-2026'));
  assert.ok(field.includes('kore-2026'));
});

test('combined setting, status, metric and query keep only matching evidence', () => {
  const pairs = search({q: 'ActLumus', setting: 'Laboratory', status: 'Preprint', metric: 'Melanopic EDI'});
  assert.deepEqual(studyIds(pairs), ['pilehchiha-2026']);
  assert.deepEqual(names(pairs), ['ActLumus']);
});

test('DOI search ignores surrounding whitespace and case', () => {
  assert.deepEqual(
    studyIds(search({q: '  10.1364/josaa.34.000545  '})),
    ['price-2017']
  );
});

test('author and device query terms combine within one matching pair', () => {
  assert.deepEqual(names(search({q: '  kOrE   sPeCk  '})), ['Blue Iris Speck v1.0']);
  assert.deepEqual(studyIds(search({q: 'Kore Speck'})), ['kore-2026']);
  assert.equal(search({q: 'Gemici Speck'}).length, 0);
});

test('unknown queries return an empty collection', () => {
  assert.deepEqual(search({q: 'not-an-indexed-device-938271'}), []);
});

test('source input accepts bare DOI and complete HTTPS paper links', () => {
  for (const source of [
    '10.1093/sleep/zsaf358',
    ' 10.48550/arXiv.2606.20719 ',
    'https://doi.org/10.1111/opo.13457',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC13396946/?pdf=1#Methods'
  ]) assert.equal(sourceIsValid(source), true, source);
});

test('source input rejects script schemes, local files, credentials and incomplete sources', () => {
  for (const source of [
    '', '   ', '10.1234/', '10.1234/a b', 'www.example.org/paper',
    'javascript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'http://example.org/paper',
    'https://user:password@example.org/paper',
    'https://user@example.org/paper',
    '//example.org/paper',
    'https://'
  ]) assert.equal(sourceIsValid(source), false, source);
});

test('submission output is deterministic plain text and preserves user details', () => {
  const values = {
    title: '  Light & spectrum: <pilot>  ',
    source: '  https://doi.org/10.1111/opo.13457  ',
    device: '  Vivior Mark 3+  ',
    status: 'Peer reviewed',
    notes: '  Test α-opic output; 10% error.\nKeep "quoted" units & context.  ',
    name: '  Zoë Example  '
  };
  const expected = [
    'Suggested validation for Light Logger Evidence',
    '',
    'Paper: Light & spectrum: <pilot>',
    'DOI / URL: https://doi.org/10.1111/opo.13457',
    'Device and model: Vivior Mark 3+',
    'Publication status: Peer reviewed',
    '',
    'Validation details / correction:',
    'Test α-opic output; 10% error.',
    'Keep "quoted" units & context.',
    '',
    'Suggested by: Zoë Example',
    '',
    'Please review the source and model-specific evidence before inclusion.'
  ].join('\n');
  assert.equal(submissionText(values), expected);
  assert.equal(submissionText(values), submissionText({...values}));
  assert.equal(values.title, '  Light & spectrum: <pilot>  ');
});

test('blank optional submission fields produce explicit missing-value text', () => {
  const result = submissionText({
    title: 'Study', source: '10.1111/opo.13457', device: 'Clouclip',
    status: 'Peer reviewed', notes: ' \n ', name: '  '
  });
  assert.match(result, /Validation details \/ correction:\nNot provided\./);
  assert.match(result, /Suggested by: Not provided\./);
  assert.ok(!result.includes('undefined'));
});




test('LYS and LYS Button share one catalogue entry', () => {
  assert.deepEqual(names(search({q: 'LYS'})), ['LYS Button']);
  assert.ok(studyIds(search({q: 'LYS'})).includes('stevenson-2025'));
  assert.ok(!library.devices.some(d => d.id === 'lys'));
});

test('only the three requested measurement categories remain', () => {
  for(const s of library.studies)assert.ok(s.metrics.every(m=>['Illuminance','Melanopic EDI','Angular response'].includes(m)));
  for(const id of ['flynn-2014','dharani-2012','ye-2019','rhudy-2020','liu-2026','okudaira-1983'])assert.ok(!library.studies.some(s=>s.id===id));
});

test('coverage counts papers once per device endpoint', () => {
  const {coverageStudies}=require('../assets/app.js');
  const kore=library.studies.filter(s=>s.id==='kore-2026');
  assert.equal(coverageStudies(kore,'Actiwatch Spectrum Plus','Melanopic EDI').length,0);
  assert.equal(coverageStudies(kore,'Blue Iris Speck v1.0','Angular response').length,1);
});
test('device type filters are model-specific and Okudaira is removed', () => {
  assert.equal(search({q:'Actiwatch',type:'Research device'}).length,0);
  assert.ok(search({q:'Daysimeter',type:'Research device'}).length>0);
  assert.equal(search({q:'Okudaira'}).length,0);
  assert.equal(library.devices.find(d=>d.id==='acttrust2').family,'ActTrust');
});
test('developer coding is explicit per device and unknown is not independent', () => {
  const fig=library.studies.find(s=>s.id==='figueiro-2013').developerRelationship;
  assert.equal(fig['Daysimeter-D'].category,'Developer involved');
  assert.equal(fig['Actiwatch Spectrum'].category,'Unclear');
  assert.equal(library.studies.find(s=>s.id==='kore-2026').developerRelationship['LYS Button'].category,'Independent');
});
