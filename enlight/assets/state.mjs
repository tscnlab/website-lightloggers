export const STORAGE_KEY = 'tscn-enlight-draft-v1';
export const STATUSES = {reported:'Reported',notAvailable:'Not available',notApplicable:'Not applicable','':'Unanswered'};
export function emptyState(data) {
  const now = new Date();
  const localDate = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  return {format:'enlight-wizard',schemaVersion:1,checklistVersion:data.meta.version,step:0,
    study:{title:'',authors:'',date:localDate,reference:'',notes:''},
    lightSource:{types:[],other:'',spectrum:[],spectrumOther:''},
    responses:Object.fromEntries(data.items.map(i=>[i.id,{status:'',location:'',notes:''}]))};
}
export function isAddressed(response) {
  return !!response && (response.status === 'reported' ? !!response.location.trim() : ['notAvailable','notApplicable'].includes(response.status));
}
export function sourceComplete(state) {
  return state.lightSource.types.length>0 && (!state.lightSource.types.includes('other') || !!state.lightSource.other.trim()) && state.lightSource.spectrum.length>0;
}
export function studyComplete(state) { return ['title','authors','date'].every(k=>!!state.study[k].trim()); }
export function summarize(data,state) {
  const count = {reported:0,notAvailable:0,notApplicable:0,unanswered:0,addressed:0};
  for (const item of data.items) {const r=state.responses[item.id]; if(isAddressed(r)) count[r.status]++; else count.unanswered++;}
  if(sourceComplete(state)) count.reported++; else count.unanswered++;
  count.addressed = 25-count.unanswered;
  return count;
}
export function missingFields(data,state) {
  const result=[];
  for(const key of ['title','authors','date']) if(!state.study[key].trim()) result.push({type:'study',id:key,label:({title:'Manuscript title',authors:'Author names',date:'Checklist date'})[key]});
  if(!sourceComplete(state)) result.push({type:'source',id:'B1.1',label:'Light source type(s) and spectral type'});
  for(const item of data.items) if(!isAddressed(state.responses[item.id])) result.push({type:'item',id:item.id,label:item.title});
  return result;
}
export function parseDraft(raw,data) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw) || raw.format!=='enlight-wizard' || raw.schemaVersion!==1 || raw.checklistVersion!==data.meta.version) throw new Error('Choose an ENLIGHT wizard draft for checklist v'+data.meta.version+'.');
  const state=emptyState(data);
  const text=(value,max=50000)=>{if(typeof value!=='string'||value.length>max) throw new Error('The draft contains an invalid or oversized text field.'); return value;};
  for(const key of Object.keys(state.study)) state.study[key]=text(raw.study?.[key]??'');
  if(state.study.date && (!/^\d{4}-\d{2}-\d{2}$/.test(state.study.date) || Number.isNaN(Date.parse(state.study.date)) || new Date(state.study.date).toISOString().slice(0,10)!==state.study.date)) throw new Error('The draft contains an invalid date.');
  const choices=(values,allowed)=>{if(!Array.isArray(values)||values.some(x=>typeof x!=='string'||!allowed.includes(x))) throw new Error('The draft contains an unrecognised light-source selection.');return [...new Set(values)];};
  state.lightSource.types=choices(raw.lightSource?.types??[],data.lightSourceTypes.map(x=>x.id));
  const spectrum=raw.lightSource?.spectrum??[];
  state.lightSource.spectrum=choices(typeof spectrum==='string'?(spectrum?[spectrum]:[]):spectrum,data.spectrumTypes.map(x=>x.id));
  state.lightSource.other=text(raw.lightSource?.other??'');
  state.lightSource.spectrumOther=text(raw.lightSource?.spectrumOther??'');
  for(const item of data.items){const r=raw.responses?.[item.id]??{status:'',location:'',notes:''}; if(!Object.hasOwn(STATUSES,r.status)|| (item.essential&&r.status==='notApplicable')) throw new Error('The draft contains an invalid response for '+item.title+'.'); state.responses[item.id]={status:r.status,location:text(r.location??''),notes:text(r.notes??'')};}
  state.step=Number.isInteger(raw.step)&&raw.step>=0&&raw.step<=6?raw.step:0;
  return state;
}
