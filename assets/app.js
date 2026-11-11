(function () {
  'use strict';
  const unique = values => [...new Set(values)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalized = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function filterPairs(library, state) {
    const tokens = normalized(state.q || '').trim().split(/\s+/).filter(Boolean);
    return library.studies.flatMap(study => {
      if (state.status && study.status !== state.status) return [];
      if (state.setting && !study.setting.toLowerCase().includes(state.setting.toLowerCase())) return [];
      return study.devices.flatMap(name => {
        const device = library.devices.find(item => item.name === name);
        const metrics = study.deviceMetrics[name] || [];
        if (state.type && device.deviceType !== state.type) return [];
        if (state.metric && !metrics.includes(state.metric)) return [];
        const haystack = normalized([name, ...(device.aliases || []), device.maker, device.family, study.title, study.authors, study.doi, ...metrics].join(' '));
        if (!tokens.every(token => haystack.includes(token))) return [];
        return [{device, study, metrics}];
      });
    });
  }
  const columns = [['Illuminance','Photopic illuminance','metric'],['Melanopic EDI','Melanopic EDI','metric'],['Accuracy','Accuracy','property'],['Dynamic range','Measurement range','property'],['Angular response','Angle dependence','property']];
  const relationship = (study, name) => study.developerRelationship?.[name] || {category:'Unclear',reason:'Not assessed.'};
  const relationshipClass = label => label==='Developer involved'?'developer':'study';
  function coverageStudies(studies, name, metric) {
    return unique(studies.filter(s => (s.deviceMetrics[name] || []).some(m => m===metric)));
  }
  function sourcePassages(evidence, studyId, name, field) {
    return (evidence?.studies?.[studyId]?.passages || []).filter(p =>
      (!name || !p.devices?.length || p.devices.includes(name)) &&
      (!field || (p.fields || []).includes(field) || (p.metrics || []).includes(field) || (p.properties || []).includes(field)));
  }
  function indicatorEvidence(library, evidence, device, studies, key, kind) {
    const examined=kind==='metric'?coverageStudies(studies,device.name,key):studies.filter(s=>sourcePassages(evidence,s.id,device.name,key).length);
    const output=device.reportedOutputs?.[key];
    const outputStudies=output?.status==='yes'?unique((output.sources || []).map(s=>library.studies.find(p=>p.id===s.studyId)).filter(Boolean)):[];
    return {status:examined.length?'examined':kind==='metric' && output?.status==='yes'?'output':'none',studies:examined.length?examined:outputStudies};
  }
  function sortDevices(devices, pairs, sort) {
    const counts = new Map();
    for (const {device, study} of pairs) {
      if (!counts.has(device.id)) counts.set(device.id, new Set());
      counts.get(device.id).add(study.id);
    }
    return [...devices].sort((a,b) => {
      const difference=(counts.get(a.id)?.size || 0)-(counts.get(b.id)?.size || 0);
      if (difference && sort==='most') return -difference;
      if (difference && sort==='fewest') return difference;
      return a.name.localeCompare(b.name);
    });
  }
  function sourceIsValid(value) {
    const source = value.trim();
    if (/^10\.\d{4,9}\/\S+$/i.test(source)) return true;
    try { const url = new URL(source); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; }
  }
  function submissionText(values) {
    return ['Suggested validation for Light Logger Inventory', '', `Paper: ${values.title.trim()}`, `DOI / URL: ${values.source.trim()}`, `Device and model: ${values.device.trim()}`, `Publication status: ${values.status}`, '', 'Validation details / correction:', values.notes.trim() || 'Not provided.', '', `Suggested by: ${values.name.trim() || 'Not provided.'}`, '', 'Please review the source and model-specific evidence before inclusion.'].join('\n');
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {filterPairs, coverageStudies, sourcePassages, indicatorEvidence, sortDevices, sourceIsValid, submissionText};
  if (typeof document === 'undefined') return;

  const $ = selector => document.querySelector(selector);
  const library = JSON.parse($('#library-data').textContent);
  const config = JSON.parse($('#site-config').textContent);
  const evidence = library.evidence || {studies:{}};
  let state = {q:'',metric:'',type:'',view:'devices',sort:'manufacturer'}, lastSubmission='';
  const plural = (n,word) => `${n} ${n===1?word:word==='study'?'studies':word+'s'}`;
  const studySort = (a,b) => b.year-a.year || a.authors.localeCompare(b.authors);
  function venueDisplay(study) {
    const venue = library.venues?.[study.venue];
    if (!venue) return '';
    return `<p class="venue"><a href="${escape(venue.url)}" target="_blank" rel="noopener noreferrer">${venue.logo?`<img class="venue-logo ${venue.logoKind?.toLowerCase().includes('cover')?'cover':''} ${venue.logoTheme==='dark'?'dark':''}" src="${escape(venue.logo)}" alt="${escape(venue.logoKind?.toLowerCase().includes('publisher')?(venue.publisher||'Wiley')+' publisher logo':venue.name+' logo')}" loading="lazy">`:''}<span class="venue-name">${escape(venue.name)}</span></a></p>`;
  }
  function sourceLinks(study) {
    const sourceLabel = study.status==='Preprint' ? 'Preprint' : study.url.includes('pmc.ncbi.nlm.nih.gov') ? 'Full text' : 'Paper';
    const links = [];
    if(study.pubmedUrl) links.push(`<a href="${escape(study.pubmedUrl)}" target="_blank" rel="noopener noreferrer">PubMed ↗</a>`);
    if(study.url!==study.pubmedUrl) links.push(`<a href="${escape(study.url)}" target="_blank" rel="noopener noreferrer">${sourceLabel} ↗</a>`);
    if(study.fullTextUrl && study.fullTextUrl!==study.url) links.push(`<a href="${escape(study.fullTextUrl)}" target="_blank" rel="noopener noreferrer">Full text ↗</a>`);
    links.push(`<a href="https://doi.org/${escape(study.doi)}" target="_blank" rel="noopener noreferrer">DOI ↗</a>`);
    return links.join('');
  }
  function passageLink(study,device,field,label='Read source sections') {
    let passages=sourcePassages(evidence,study.id,device?.name,field);
    if(!passages.length)passages=sourcePassages(evidence,study.id,null,field);
    if(!passages.length)return '';
    return ` <a class="claim-source source-section-link" aria-haspopup="dialog" href="source.html?study=${encodeURIComponent(study.id)}&amp;passage=${encodeURIComponent(passages[0].id)}" title="${escape(passages.map(p=>p.locator).join('; '))}">${label}</a>`;
  }
  function studyRecord(study,device=null,pairs=null) {
    const key = device ? `${device.id}-${study.id}` : study.id;
    const fields = [['Reference',study.reference,'reference'],['Protocol',study.protocol,'protocol']];
    const coverage = device ? `${device.name}: ${study.deviceMetrics[device.name].join(', ')}` : study.devices.map(name=>`${name}: ${study.deviceMetrics[name].join(', ')}`).join('; ');
    fields.push(['Measurements',coverage]);
    const reviewed=(device?[device.name]:study.devices).filter(name=>relationship(study,name).category!=='Unclear');
    if(reviewed.length)fields.push(['Developer involvement',reviewed.map(name=>{const r=relationship(study,name);return `${name}: ${r.category}. ${r.reason} Source: ${r.sourceLocator || 'Not assessed.'}`;}).join(' ')]);

    const matching = pairs ? unique(pairs.filter(p=>p.study.id===study.id).map(p=>p.device.name)) : study.devices;
    const findings=study.findings?.length?study.findings:[{text:study.finding,field:'finding'}];
    return `<article class="study-record" id="${escape(key)}"><div class="study-main">${venueDisplay(study)}<p class="study-meta"><span>${escape(study.authors)} · ${study.year}</span><span>${escape(study.evidenceType)}</span>${study.status!=='Peer reviewed'?`<span class="status-preprint">${escape(study.status)}</span>`:''}</p><h3><a href="${escape(study.url)}" target="_blank" rel="noopener noreferrer">${escape(study.title)}</a></h3>${device && relationship(study,device.name).category!=='Unclear'?`<p class="relationship-label"><span class="evidence-square ${relationshipClass(relationship(study,device.name).category)}" aria-hidden="true"></span> ${escape(relationship(study,device.name).category)}</p>`:''}${device?'':`<p class="study-devices">Devices: ${study.devices.map(escape).join(' · ')}</p>`}${state.metric && !device && matching.length<study.devices.length?`<p class="study-devices matching-devices">Matching this measurement: ${matching.map(escape).join(' · ')}</p>`:''}<div class="study-links"><a class="source-section-link" aria-haspopup="dialog" href="source.html?study=${encodeURIComponent(study.id)}">Read source sections</a>${sourceLinks(study)}</div><details class="study-detail"><summary>Study details</summary><div class="study-details">${findings.map(f=>`<p>${escape(f.text)}${passageLink(study,device,f.field || 'finding')}</p>`).join('')}<dl class="details-grid">${fields.map(([label,value,field])=>`<dt>${escape(label)}</dt><dd>${escape(value)}${field?passageLink(study,device,field):''}</dd>`).join('')}</dl></div></details></div></article>`;
  }
  function deviceRecord(device,pairs) {
    const studies=unique(pairs.filter(p=>p.device.id===device.id).map(p=>p.study)).sort(studySort);
    const squares=studies.map(s=>`<span tabindex="0" class="evidence-square ${relationshipClass(relationship(s,device.name).category)}" aria-label="${escape(`${s.authors} (${s.year})`)}" title="${escape(`${s.authors} (${s.year}) · ${s.status}${relationship(s,device.name).category==='Unclear'?'':' · '+relationship(s,device.name).category}`)}"></span>`).join('');
    const checkCell=(metric,label,kind)=>{
      const result=indicatorEvidence(library,evidence,device,studies,metric,kind);
      const meaning=result.status==='examined'?'Examined':result.status==='output'?'Output available; not examined in these studies':'No examination indexed';
      const tooltip=[`${label}: ${meaning}`,...result.studies.map(s=>`${s.authors} (${s.year})${kind==='property'?': '+sourcePassages(evidence,s.id,device.name,metric).map(p=>p.scope || p.label).filter(Boolean).join('; '):''}`)].join('\n');
      const symbol=result.status==='examined'?'✓':result.status==='output'?'●':'—';
      return `<span class="metric-check-cell ${kind}" data-label="${label}" data-metric="${escape(metric)}">${result.status==='none'?`<span class="no-check" title="${escape(tooltip)}" aria-label="${escape(tooltip)}">—</span>`:`<button type="button" class="metric-indicator ${result.status==='examined'?'confirmed-check':'output-only'}" data-evidence-device="${escape(device.id)}" data-evidence-key="${escape(metric)}" data-evidence-kind="${kind}" aria-label="${escape(tooltip)}" title="${escape(tooltip)}">${symbol}<span class="metric-tooltip" aria-hidden="true">${escape(tooltip)}</span></button>`}</span>`;
    };
    const checks=columns.map(([m,l,k])=>checkCell(m,l,k)).join('');
    return `<details class="device-record" id="device-${escape(device.id)}"><summary><div><h3 class="device-name">${escape(device.name)}</h3>${state.sort!=='manufacturer'?`<span class="device-maker">${escape(device.manufacturerGroup || device.maker)}</span>`:''}</div><span class="device-count"><span>${plural(studies.length,'study')}</span><span class="study-squares" aria-label="${plural(studies.length,'study')}">${squares}</span></span><span class="coverage-grid">${checks}</span></summary><div class="device-studies"><p class="device-note">${escape(device.deviceType)}</p>${studies.map(s=>studyRecord(s,device)).join('')}</div></details>`;
  }
  function listHeading() {
    return `<div class="list-heading"><span>Device</span><span>Studies</span><div class="coverage-grid">${columns.map(([m,l,k])=>`<span class="${k}">${l}</span>`).join('')}</div><span></span></div>`;
  }
  function groupedRecords(devices,pairs) {
    const groups=new Map();
    for(const d of devices){const name=d.manufacturerGroup || d.maker || 'Manufacturer not identified';if(!groups.has(name))groups.set(name,[]);groups.get(name).push(d);}
    return [...groups].sort(([a],[b])=>a.localeCompare(b)).flatMap(([name,items])=>[
      `<div class="family-heading"><h2>${escape(name)}</h2></div>`, ...items.map(d=>deviceRecord(d,pairs))]);
  }

  function syncUrl() {
    const url=new URL(location.href);
    ['q','metric','type','view','sort'].forEach(k=>state[k] && !(k==='view'&&state[k]==='devices') && !(k==='sort'&&state[k]==='manufacturer')?url.searchParams.set(k,state[k]):url.searchParams.delete(k));
    ['device','study','status','setting','compare'].forEach(k=>url.searchParams.delete(k));
    try{history.replaceState({},'',url);}catch{}
  }
  function render() {
    const pairs=filterPairs(library,state), devices=sortDevices(unique(pairs.map(p=>p.device)),pairs,state.sort), studies=unique(pairs.map(p=>p.study)).sort(studySort);
    $('#devices-tab').setAttribute('aria-pressed',String(state.view==='devices'));
    $('#studies-tab').setAttribute('aria-pressed',String(state.view==='studies'));
    $('#result-count').textContent=`${devices.length} device ${devices.length===1?'entry':'entries'} · ${plural(studies.length,'study')}`;
    $('#reset').hidden=!state.q&&!state.metric&&!state.type;
    const entries=state.view==='devices'?(devices.length?[listHeading(),...(state.sort==='manufacturer'?groupedRecords(devices,pairs):devices.map(d=>deviceRecord(d,pairs)))]:[]):studies.map(s=>studyRecord(s,null,pairs));
    $('#sort-control').hidden=state.view!=='devices';
    $('#coverage-legend').hidden=state.view!=='devices';
    $('#results').innerHTML=entries.length?entries.join(''):'<div class="empty"><h3>No matching records</h3><p>Change the search terms or clear the filters.</p><button class="button" data-reset>Clear search</button></div>';
  }
  function readUrl() {
    const params=new URL(location.href).searchParams;
    state={q:params.get('q')||'',metric:params.get('metric')||'',type:params.get('type')||'',sort:params.get('sort')||'manufacturer',view:params.get('view')==='studies'||params.has('study')?'studies':'devices'};
    if(![...$('#metric').options].some(o=>o.value===state.metric))state.metric='';
    if(![...$('#device-type').options].some(o=>o.value===state.type))state.type='';
    if(![...$('#sort').options].some(o=>o.value===state.sort))state.sort='manufacturer';
    $('#search').value=state.q;$('#metric').value=state.metric;$('#device-type').value=state.type;$('#sort').value=state.sort;render();
    const requestedDevice=params.get('device'),deviceId=library.devices.find(d=>d.aliasIds?.includes(requestedDevice))?.id||requestedDevice,studyId=params.get('study');
    if(deviceId){const target=document.getElementById('device-'+deviceId);if(target)target.open=true;}
    if(studyId){const target=document.getElementById(studyId);if(target)target.querySelector('details').open=true;}
  }
  function reset(){state.q='';state.metric='';state.type='';$('#device-type').value='';$('#search').value='';$('#metric').value='';syncUrl();render();}
  function showEvidence(deviceId,key,kind) {
    const device=library.devices.find(d=>d.id===deviceId);
    const studies=unique(filterPairs(library,state).filter(p=>p.device===device).map(p=>p.study)).sort(studySort);
    const result=indicatorEvidence(library,evidence,device,studies,key,kind);
    const label=columns.find(c=>c[0]===key)?.[1] || key;
    $('#evidence-title').textContent=`${device.name} · ${label}`;
    $('#evidence-content').innerHTML=`<p class="evidence-meaning">${result.status==='output'?'This output is described in the literature; no examination is indexed in the matching studies.':'Examined in the following studies. A check indicates that a test was performed; it does not rate the result.'}</p>${result.studies.map(s=>{
      const passages=sourcePassages(evidence,s.id,device.name,key);
      return `<article class="indicator-study"><h3>${escape(s.authors)} (${s.year})</h3><p>${escape(s.title)}</p>${passages.map(p=>`<div class="indicator-passage"><p>${escape(p.scope || p.label)} · ${escape(p.locator)}</p><a class="source-section-link" aria-haspopup="dialog" href="source.html?study=${encodeURIComponent(s.id)}&amp;passage=${encodeURIComponent(p.id)}">Read source sections</a></div>`).join('') || `<a class="source-section-link" aria-haspopup="dialog" href="source.html?study=${encodeURIComponent(s.id)}">Read source sections</a>`}</article>`;
    }).join('')}`;
    $('#evidence-dialog').showModal();document.body.style.overflow='hidden';
  }
  async function copyText(value){try{if(!navigator.clipboard?.writeText)return false;await navigator.clipboard.writeText(value);return true;}catch{return false;}}
  function validateForm(){const source=$('#paper-source');source.setCustomValidity(sourceIsValid(source.value)?'':'Enter a DOI beginning with 10. or a full https:// paper URL.');return $('#submission-form').reportValidity();}
  function values(){return Object.fromEntries(new FormData($('#submission-form')));}
  function showDraft(message,text){lastSubmission=text;$('#submission-result').hidden=false;$('#submission-status').textContent=message;$('#submission-preview').textContent=text;}
  $('#submission-form').addEventListener('submit',event=>{event.preventDefault();if(!validateForm())return;const v=values(),text=submissionText(v);showDraft('Email draft prepared. This website has not sent your submission. If your mail app does not open, copy or download the text below.',text);const a=document.createElement('a');a.href=`mailto:${config.submissionEmail}?subject=${encodeURIComponent('Validation suggestion: '+v.device.trim())}&body=${encodeURIComponent(text)}`;a.click();});
  $('#paper-source').addEventListener('input',()=>$('#paper-source').setCustomValidity(''));
  $('#copy-submission').addEventListener('click',async()=>{if(!validateForm())return;const text=submissionText(values()),copied=await copyText(text);showDraft(copied?'Copied. Paste the text into an email to the address above.':'Copy is unavailable. Select or download the text below.',text);});
  $('#download-submission').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([lastSubmission],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='light-logger-validation-submission.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('#search').addEventListener('input',()=>{state.q=$('#search').value;syncUrl();render();});
  $('#metric').addEventListener('change',()=>{state.metric=$('#metric').value;syncUrl();render();});
  $('#device-type').addEventListener('change',()=>{state.type=$('#device-type').value;syncUrl();render();});
  $('#sort').addEventListener('change',()=>{state.sort=$('#sort').value;syncUrl();render();});
  $('#reset').addEventListener('click',reset);
  document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-evidence-device')){event.preventDefault();event.stopPropagation();showEvidence(button.dataset.evidenceDevice,button.dataset.evidenceKey,button.dataset.evidenceKind);}else if(button.hasAttribute('data-view')){state.view=button.dataset.view;syncUrl();render();}else if(button.hasAttribute('data-reset'))reset();else if(button.hasAttribute('data-submit')){$('#submit-dialog').showModal();document.body.style.overflow='hidden';}else if(button.hasAttribute('data-close'))button.closest('dialog').close();});
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>{
    document.body.style.overflow=document.querySelector('dialog[open]')?'hidden':'';
  }));
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();$('#search').focus();}});
  window.addEventListener('popstate',readUrl);
  readUrl();
})();
