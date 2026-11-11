import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyState,isAddressed,sourceComplete,studyComplete,summarize,missingFields,parseDraft} from '../assets/state.mjs';

const data=JSON.parse(readFileSync(new URL('../data/checklist.json',import.meta.url),'utf8'));
const optional=data.items.filter(item=>!item.essential);
const essential=data.items.filter(item=>item.essential);
function completeState(){
  const state=emptyState(data);
  Object.assign(state.study,{title:'Evening light exposure',authors:'Example authors',date:'2024-02-29'});
  state.lightSource.types=['room']; state.lightSource.spectrum=['polychromatic'];
  for(const item of data.items) state.responses[item.id]={status:'reported',location:'Methods, p. 4; Table S2',notes:''};
  return state;
}
function roundTrip(state){return parseDraft(JSON.parse(JSON.stringify(state)),data);}

test('empty drafts enumerate the entire official checklist and use the local calendar date',()=>{
  const state=emptyState(data),now=new Date();
  const expectedDate=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  assert.equal(state.study.date,expectedDate);
  assert.equal(state.format,'enlight-wizard');
  assert.equal(data.items.length+1,25);
  assert.equal(essential.length,9);
  assert.deepEqual(Object.keys(state.responses),data.items.map(item=>item.id));
  assert.deepEqual(summarize(data,state),{reported:0,notAvailable:0,notApplicable:0,unanswered:25,addressed:0});
  assert.equal(missingFields(data,state).length,27); // Title, authors, and 25 checklist items.
  assert.equal(studyComplete(state),false);
});

test('each new draft has independent arrays, study metadata and response objects',()=>{
  const one=emptyState(data),two=emptyState(data);
  one.study.title='One draft'; one.lightSource.types.push('room'); one.responses['A1.1'].notes='Private note';
  assert.equal(two.study.title,''); assert.deepEqual(two.lightSource.types,[]); assert.equal(two.responses['A1.1'].notes,'');
});

test('reported rows need a nonblank manuscript location; explicit unavailable and applicable exceptions count',()=>{
  for(const location of ['', ' ', '\n\t']) assert.equal(isAddressed({status:'reported',location}),false);
  assert.equal(isAddressed({status:'reported',location:'Methods, p. 5'}),true);
  for(const status of ['notAvailable','notApplicable']) assert.equal(isAddressed({status,location:''}),true);
  for(const status of ['', 'unknown']) assert.equal(isAddressed({status,location:'p. 4'}),false);
  assert.equal(isAddressed(undefined),false);
});

test('light-source completion requires a source and a spectrum and explanation for Other',()=>{
  const state=emptyState(data);
  assert.equal(sourceComplete(state),false);
  state.lightSource.types=['room']; assert.equal(sourceComplete(state),false);
  state.lightSource.spectrum=['polychromatic']; assert.equal(sourceComplete(state),true);
  state.lightSource.types=['other']; assert.equal(sourceComplete(state),false);
  state.lightSource.other='  '; assert.equal(sourceComplete(state),false);
  state.lightSource.other='Custom fibre delivery'; assert.equal(sourceComplete(state),true);
  state.lightSource.types=['room','other']; state.lightSource.other=''; assert.equal(sourceComplete(state),false);
  state.lightSource.types=[]; assert.equal(sourceComplete(state),false);
});

test('all 25 addressed items and required study fields are needed before completed export',()=>{
  const state=completeState();
  assert.equal(studyComplete(state),true);
  assert.equal(sourceComplete(state),true);
  assert.deepEqual(missingFields(data,state),[]);
  assert.deepEqual(summarize(data,state),{reported:25,notAvailable:0,notApplicable:0,unanswered:0,addressed:25});
  for(const key of ['title','authors','date']){
    const variant=structuredClone(state);variant.study[key]=' \t';
    assert.equal(studyComplete(variant),false);
    assert.deepEqual(missingFields(data,variant).map(x=>[x.type,x.id]),[['study',key]]);
  }
});

test('mixed statuses remain distinct and essential rows may be explicitly unavailable',()=>{
  const state=completeState();
  for(const item of essential) state.responses[item.id].status='notAvailable';
  for(const item of optional) state.responses[item.id].status='notApplicable';
  const imported=roundTrip(state);
  assert.deepEqual(summarize(data,imported),{reported:1,notAvailable:9,notApplicable:15,unanswered:0,addressed:25});
  assert.deepEqual(missingFields(data,imported),[]);
});

test('every essential row rejects imported Not applicable',()=>{
  for(const item of essential){
    const state=completeState();state.responses[item.id].status='notApplicable';
    assert.throws(()=>roundTrip(state),/invalid response/,'essential '+item.id);
  }
});

test('clearing a reported location reopens the row without losing notes',()=>{
  const state=completeState();state.responses['A1.1'].location='\n';state.responses['A1.1'].notes='Keep this note';
  const imported=roundTrip(state);
  assert.equal(summarize(data,imported).addressed,24);
  assert.deepEqual(missingFields(data,imported).map(x=>x.id),['A1.1']);
  assert.equal(imported.responses['A1.1'].notes,'Keep this note');
});

test('a complete draft round-trips every field without altering the original',()=>{
  const state=completeState();state.step=6;state.study.reference='DOI: 10.1000/example';state.study.notes='Experiment 2';
  state.study.authors='Müller, Spitschan & colleagues';
  state.lightSource.types=['room','other'];state.lightSource.other='Custom source';state.lightSource.spectrum=['polychromatic','narrowband'];
  state.responses['B2.4'].notes='α-opic EDI 250 lx; λ = 480 ± 10 nm; µW/m²\nSecond line';
  const before=JSON.stringify(state),result=roundTrip(state);
  assert.deepEqual(result,state);assert.equal(JSON.stringify(state),before);
  result.study.title='Changed';result.responses['B2.4'].notes='Changed';result.lightSource.types.push('wearable');
  assert.equal(JSON.stringify(state),before);
});

test('import preserves dormant manuscript locations when unavailable is selected',()=>{
  const state=completeState();state.responses['A1.1']={status:'notAvailable',location:'Methods, p. 4',notes:'Revisit after co-author check'};
  assert.deepEqual(roundTrip(state).responses['A1.1'],state.responses['A1.1']);
});

test('valid partial imports restore absent optional fields and unanswered rows',()=>{
  const partial={format:'enlight-wizard',schemaVersion:1,checklistVersion:data.meta.version,study:{title:'Partial'},responses:{'A1.1':{status:'reported',location:'p. 4'}}};
  const parsed=parseDraft(partial,data);
  assert.equal(parsed.study.title,'Partial');assert.equal(parsed.study.authors,'');assert.equal(parsed.study.date,'');
  assert.equal(parsed.responses['A1.1'].notes,'');assert.equal(parsed.responses['A1.2'].status,'');
  assert.equal(summarize(data,parsed).addressed,1);
});

test('import requires the wizard format and exact schema/checklist versions',()=>{
  for(const raw of [null,undefined,[],false,'text',{}, {format:'unrelated'}, {...completeState(),format:undefined}, {...completeState(),schemaVersion:2}, {...completeState(),checklistVersion:'1.0.1'}])
    assert.throws(()=>parseDraft(raw,data),/Choose an ENLIGHT wizard draft/);
});

test('import validates real ISO calendar dates including leap years',()=>{
  for(const date of ['2024-02-29','2026-11-11','2000-02-29','']){
    const state=completeState();state.study.date=date;assert.equal(roundTrip(state).study.date,date);
  }
  for(const date of ['2023-02-29','1900-02-29','2026-02-30','2026-04-31','2026-13-01','2026-00-01','2026-01-00','11/11/2026','2026-1-1','2026-11-11T00:00:00Z','not-a-date']){
    const state=completeState();state.study.date=date;assert.throws(()=>roundTrip(state),/invalid date/,date);
  }
});

test('import rejects unknown source and spectrum selections instead of claiming completion',()=>{
  for(const key of ['types','spectrum']) for(const invalid of [['unknown'],[23],{},true]){
    const state=completeState();state.lightSource[key]=invalid;
    assert.throws(()=>roundTrip(state),/unrecognised light-source selection/);
  }
});

test('duplicate light-source selections are collapsed and old single-spectrum drafts migrate',()=>{
  const state=completeState();state.lightSource.types=['room','room','wearable'];state.lightSource.spectrum=['narrowband','narrowband','polychromatic'];
  let imported=roundTrip(state);
  assert.deepEqual(imported.lightSource.types,['room','wearable']);assert.deepEqual(imported.lightSource.spectrum,['narrowband','polychromatic']);
  state.lightSource.spectrum='narrowband';assert.deepEqual(roundTrip(state).lightSource.spectrum,['narrowband']);
  state.lightSource.spectrum='';assert.deepEqual(roundTrip(state).lightSource.spectrum,[]);
});

test('unknown and prototype property statuses are rejected',()=>{
  for(const status of ['done','Reported','constructor','toString','__proto__',undefined,17]){
    const state=completeState();state.responses['A1.1'].status=status;
    assert.throws(()=>roundTrip(state),/invalid response/);
  }
});

test('text validation rejects non-text and oversized fields at all entry points',()=>{
  const assignments=[
    (s,v)=>s.study.title=v,
    (s,v)=>s.lightSource.other=v,
    (s,v)=>s.lightSource.spectrumOther=v,
    (s,v)=>s.responses['A1.1'].location=v,
    (s,v)=>s.responses['A1.1'].notes=v
  ];
  for(const assign of assignments) for(const bad of [false,42,{},[], 'x'.repeat(50001)]){
    const state=completeState();assign(state,bad);assert.throws(()=>roundTrip(state),/invalid or oversized text field/);
  }
  const state=completeState();state.responses['A1.1'].notes='x'.repeat(50000);
  assert.equal(roundTrip(state).responses['A1.1'].notes.length,50000);
});

test('text and unusual markup are treated as content and preserved through import',()=>{
  const state=completeState();const literal='<img src=x onerror="alert(1)"> & <script>test</script>';
  state.study.title=literal;state.responses['A1.1'].notes=literal;
  const imported=roundTrip(state);assert.equal(imported.study.title,literal);assert.equal(imported.responses['A1.1'].notes,literal);
});

test('valid step positions survive import; invalid indices safely return to the start',()=>{
  for(let step=0;step<=6;step++){const state=completeState();state.step=step;assert.equal(roundTrip(state).step,step);}
  for(const step of [-1,7,NaN,1.5,'3',null]){const state=completeState();state.step=step;assert.equal(roundTrip(state).step,0);}
});

test('unrecognised top-level and response keys are excluded from restored state',()=>{
  const state=completeState();state.unexpected='ignored';state.responses.fake={status:'reported',location:'x'};
  const imported=roundTrip(state);assert.equal(Object.hasOwn(imported,'unexpected'),false);assert.equal(Object.hasOwn(imported.responses,'fake'),false);
  assert.equal(summarize(data,imported).addressed,25);
});
