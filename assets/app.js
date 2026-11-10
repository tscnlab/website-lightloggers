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
  const columns = [['Illuminance','Photopic illuminance'],['Melanopic EDI','Melanopic EDI'],['Angular response','Angle dependence']];
  const relationship = (study, name) => study.developerRelationship?.[name] || {category:'Unclear',reason:'Not assessed.'};
  const relationshipClass = label => label==='Developer involved'?'developer':'study';
  function coverageStudies(studies, name, metric) {
    return unique(studies.filter(s => (s.deviceMetrics[name] || []).some(m => m===metric)));
  }
  function sourceIsValid(value) {
    const source = value.trim();
    if (/^10\.\d{4,9}\/\S+$/i.test(source)) return true;
    try { const url = new URL(source); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; }
  }
  function submissionText(values) {
    return ['Suggested validation for Light Logger Evidence', '', `Paper: ${values.title.trim()}`, `DOI / URL: ${values.source.trim()}`, `Device and model: ${values.device.trim()}`, `Publication status: ${values.status}`, '', 'Validation details / correction:', values.notes.trim() || 'Not provided.', '', `Suggested by: ${values.name.trim() || 'Not provided.'}`, '', 'Please review the source and model-specific evidence before inclusion.'].join('\n');
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {filterPairs, coverageStudies, sourceIsValid, submissionText};
  if (typeof document === 'undefined') return;

  const $ = selector => document.querySelector(selector);
  const library = JSON.parse($('#library-data').textContent);
  const config = JSON.parse($('#site-config').textContent);
  let state = {q:'',metric:'',type:'',view:'devices'}, lastSubmission='';
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
  function studyRecord(study,device=null,pairs=null) {
    const key = device ? `${device.id}-${study.id}` : study.id;
    const fields = [['Evidence type',study.evidenceType],['Reference',study.reference],['Protocol',study.protocol],['Limitations',study.limitations]];
    const coverage = device ? `${device.name}: ${study.deviceMetrics[device.name].join(', ')}` : study.devices.map(name=>`${name}: ${study.deviceMetrics[name].join(', ')}`).join('; ');
    fields.push(['Measurements',coverage]);
    const reviewed=(device?[device.name]:study.devices).filter(name=>relationship(study,name).category!=='Unclear');
    if(reviewed.length)fields.push(['Developer involvement',reviewed.map(name=>{const r=relationship(study,name);return `${name}: ${r.category}. ${r.reason} Source: ${r.sourceLocator || 'Not assessed.'}`;}).join(' ')]);

    const matching = pairs ? unique(pairs.filter(p=>p.study.id===study.id).map(p=>p.device.name)) : study.devices;
    return `<article class="study-record" id="${escape(key)}"><div class="study-main">${venueDisplay(study)}<p class="study-meta"><span>${escape(study.authors)} · ${study.year}</span><span>${escape(study.evidenceType)}</span>${study.status!=='Peer reviewed'?`<span class="status-preprint">${escape(study.status)}</span>`:''}</p><h3><a href="${escape(study.url)}" target="_blank" rel="noopener noreferrer">${escape(study.title)}</a></h3>${device && relationship(study,device.name).category!=='Unclear'?`<p class="relationship-label"><span class="evidence-square ${relationshipClass(relationship(study,device.name).category)}" aria-hidden="true"></span> ${escape(relationship(study,device.name).category)}</p>`:''}${device?'':`<p class="study-devices">Devices: ${study.devices.map(escape).join(' · ')}</p>`}${state.metric && !device && matching.length<study.devices.length?`<p class="study-devices matching-devices">Matching this measurement: ${matching.map(escape).join(' · ')}</p>`:''}<div class="study-links">${sourceLinks(study)}</div><details class="study-detail"><summary>Study details</summary><div class="study-details"><p>${escape(study.finding)}</p><dl class="details-grid">${fields.map(([label,value])=>`<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}</dl></div></details></div></article>`;
  }
  function deviceRecord(device,pairs) {
    const studies=unique(pairs.filter(p=>p.device.id===device.id).map(p=>p.study)).sort(studySort);
    const allStudies=library.studies.filter(s=>s.devices.includes(device.name));
    const squares=studies.map(s=>`<span class="evidence-square ${relationshipClass(relationship(s,device.name).category)}" title="${escape(`${s.authors} (${s.year}) · ${s.status}${relationship(s,device.name).category==='Unclear'?'':' · '+relationship(s,device.name).category}`)}"></span>`).join('');
    const checks=columns.map(([metric,label])=>{
      const confirmed=metric==='Angular response'?coverageStudies(allStudies,device.name,metric).length>0:device.reportedOutputs?.[metric]?.status==='yes';
      const meaning=metric==='Angular response'?'tested':'reported';
      return `<span class="metric-check-cell" data-label="${label}"><span class="${confirmed?'confirmed-check':'no-check'}" aria-label="${escape(label)}: ${confirmed?meaning:'not established in the listed studies'}" title="${escape(label)} ${confirmed?meaning:'not established in the listed studies'}">${confirmed?'✓':'—'}</span></span>`;
    }).join('');
    return `<details class="device-record" id="device-${escape(device.id)}"><summary><div><h3 class="device-name">${escape(device.name)}</h3></div><span class="device-count"><span>${plural(studies.length,'validation')}</span><span class="study-squares" aria-label="${plural(studies.length,'validation')}">${squares}</span></span><span class="coverage-grid">${checks}</span></summary><div class="device-studies"><p class="device-note">${escape(device.deviceType)}</p>${studies.map(s=>studyRecord(s,device)).join('')}</div></details>`;
  }
  function groupedRecords(devices,pairs) {
    const groups=new Map();
    for(const d of devices){const name=d.manufacturerGroup || d.maker || 'Manufacturer not identified';if(!groups.has(name))groups.set(name,[]);groups.get(name).push(d);}
    return [...groups].sort(([a],[b])=>a.localeCompare(b)).flatMap(([name,items])=>[
      `<div class="family-heading"><h2>${escape(name)}</h2><span class="validation-heading">Validations</span><div class="coverage-grid">${columns.map(([metric,label])=>`<span title="${escape(metric==='Other'?'All remaining indexed measurements; expand a row for details':metric)}">${label}</span>`).join('')}</div><span></span></div>`, ...items.map(d=>deviceRecord(d,pairs))]);
  }

  function syncUrl() {
    const url=new URL(location.href);
    ['q','metric','type','view'].forEach(k=>state[k] && !(k==='view'&&state[k]==='devices')?url.searchParams.set(k,state[k]):url.searchParams.delete(k));
    ['device','study','status','setting','sort','compare'].forEach(k=>url.searchParams.delete(k));
    try{history.replaceState({},'',url);}catch{}
  }
  function render() {
    const pairs=filterPairs(library,state), devices=unique(pairs.map(p=>p.device)).sort((a,b)=>a.name.localeCompare(b.name)), studies=unique(pairs.map(p=>p.study)).sort(studySort);
    $('#devices-tab').setAttribute('aria-pressed',String(state.view==='devices'));
    $('#studies-tab').setAttribute('aria-pressed',String(state.view==='studies'));
    $('#result-count').textContent=`${devices.length} device ${devices.length===1?'entry':'entries'} · ${plural(studies.length,'study')}`;
    $('#reset').hidden=!state.q&&!state.metric&&!state.type;
    const entries=state.view==='devices'?groupedRecords(devices,pairs):studies.map(s=>studyRecord(s,null,pairs));
    $('#coverage-legend').hidden=state.view!=='devices';
    $('#results').innerHTML=entries.length?entries.join(''):'<div class="empty"><h3>No matching records</h3><p>Change the search terms or clear the filters.</p><button class="button" data-reset>Clear search</button></div>';
  }
  function readUrl() {
    const params=new URL(location.href).searchParams;
    state={q:params.get('q')||'',metric:params.get('metric')||'',type:params.get('type')||'',view:params.get('view')==='studies'||params.has('study')?'studies':'devices'};
    if(![...$('#metric').options].some(o=>o.value===state.metric))state.metric='';
    if(![...$('#device-type').options].some(o=>o.value===state.type))state.type='';
    $('#search').value=state.q;$('#metric').value=state.metric;$('#device-type').value=state.type;render();
    const requestedDevice=params.get('device'),deviceId=library.devices.find(d=>d.aliasIds?.includes(requestedDevice))?.id||requestedDevice,studyId=params.get('study');
    if(deviceId){const target=document.getElementById('device-'+deviceId);if(target)target.open=true;}
    if(studyId){const target=document.getElementById(studyId);if(target)target.querySelector('details').open=true;}
  }
  function reset(){state.q='';state.metric='';state.type='';$('#device-type').value='';$('#search').value='';$('#metric').value='';syncUrl();render();}
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
  $('#reset').addEventListener('click',reset);
  document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-view')){state.view=button.dataset.view;syncUrl();render();}else if(button.hasAttribute('data-reset'))reset();else if(button.hasAttribute('data-submit')){$('#submit-dialog').showModal();document.body.style.overflow='hidden';}else if(button.hasAttribute('data-close'))$('#submit-dialog').close();});
  $('#submit-dialog').addEventListener('close',()=>{document.body.style.overflow='';});
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)&&!$('#submit-dialog').open){event.preventDefault();$('#search').focus();}});
  window.addEventListener('popstate',readUrl);
  readUrl();
})();
