const $=selector=>document.querySelector(selector);
const data=JSON.parse($('#source-data').textContent);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URL(location.href).searchParams;
const embedded=params.get('embedded')==='1' && window.parent!==window;
if(embedded){
  document.documentElement.classList.add('embedded-reader');
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();window.parent.postMessage({type:'lightlogger-reader-close'},location.origin);}});
}
const study=data.studies.find(s=>s.id===params.get('study'));
const source=study && data.evidence.studies[study.id];
let pdf=null, pdfTask=null, pdfjs=null, selected=null, pageNumber=1, matched=false, renderTask=null, renderSerial=0, loadSerial=0;
const safeLink=value=>{try{const u=new URL(value,location.href);return ['https:','http:','file:'].includes(u.protocol)?u.href:'#';}catch{return '#';}};

async function library(){
  if(!pdfjs){pdfjs=await import('./vendor/pdfjs/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/build/pdf.worker.min.mjs',import.meta.url).href;}
  return pdfjs;
}
function setStatus(text){$('#pdf-status').textContent=text;}
function updatePassage(id,push=false){
  selected=source.passages.find(p=>p.id===id)||source.passages[0];
  if(!selected)return;
  document.querySelectorAll('.passage-option').forEach(b=>b.setAttribute('aria-current',String(b.dataset.passage===selected.id)));
  $('#passage-select').value=selected.id;
  $('#passage-title').textContent=selected.label;
  $('#passage-location').textContent=selected.locator;
  $('#passage-quote').hidden=!selected.quote;
  $('#passage-quote').textContent=selected.quote?`“${selected.quote}”`:'';
  $('#passage-original').href=safeLink(selected.url || source.document.url || study.url);
  $('#jump-passage').disabled=!matched || !selected.pdf;
  if(push){const u=new URL(location.href);u.searchParams.set('passage',selected.id);history.replaceState({},'',u);}
  if(pdf){pageNumber=matched && selected.pdf?selected.pdf.page:pageNumber;renderPage(true);}
}
async function loadPdf(bytes){
  const serial=++loadSerial;
  setStatus('Opening PDF…');
  try{
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    const lib=await library();
    const task=lib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,enableXfa:false,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,wasmUrl:new URL('./vendor/pdfjs/wasm/',import.meta.url).href});
    const doc=await task.promise;
    if(serial!==loadSerial){await task.destroy();return;}
    ++renderSerial;
    if(renderTask){renderTask.cancel();try{await renderTask.promise;}catch{}}
    if(pdfTask)await pdfTask.destroy();
    pdfTask=task;pdf=doc;matched=hash===source.document.sha256;
    pageNumber=matched && selected?.pdf?selected.pdf.page:1;
    $('#pdf-reader').hidden=false;$('#source-no-pdf').hidden=true;
    $('#page-number').max=pdf.numPages;$('#page-total').textContent=`of ${pdf.numPages}`;
    $('#jump-passage').disabled=!matched || !selected?.pdf;
    await renderPage(true);
  }catch(error){if(serial!==loadSerial)return;console.warn('PDF reader:',error);setStatus('This PDF could not be opened. Use the original paper link, or choose another PDF.');$('#source-no-pdf').hidden=false;$('.pdf-tools').hidden=false;}
}
async function renderPage(jump=false){
  if(!pdf)return;
  const serial=++renderSerial;
  if(renderTask){renderTask.cancel();try{await renderTask.promise;}catch{}}
  pageNumber=Math.max(1,Math.min(pdf.numPages,Math.trunc(Number(pageNumber))||1));
  const page=await pdf.getPage(pageNumber);
  if(serial!==renderSerial)return;
  const initial=page.getViewport({scale:1});
  const fit=Math.max(160,$('#pdf-scroll').clientWidth-(innerWidth<=780?14:30))/initial.width;
  const scale=$('#pdf-zoom').value==='fit'?fit:Number($('#pdf-zoom').value);
  const viewport=page.getViewport({scale});const ratio=Math.min(devicePixelRatio||1,2);
  const canvas=$('#pdf-canvas');canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
  $('#pdf-highlights').replaceChildren();
  renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
  try{await renderTask.promise;}catch(e){if(e.name==='RenderingCancelledException')return;throw e;}
  if(serial!==renderSerial)return;
  $('#page-number').value=pageNumber;$('#page-prev').disabled=pageNumber===1;$('#page-next').disabled=pageNumber===pdf.numPages;
  const regions=matched && selected?.pdf?.page===pageNumber?selected.pdf.rects:[];
  for(const [x,y,w,h] of regions){const mark=document.createElement('span');mark.className='pdf-highlight';Object.assign(mark.style,{left:(x*100)+'%',top:(y*100)+'%',width:(w*100)+'%',height:(h*100)+'%'});$('#pdf-highlights').append(mark);}
  setStatus(!matched?(source.document.sha256?'This is a different PDF edition. Saved highlights are hidden to avoid marking the wrong passage.':'Highlights have not yet been prepared for this PDF. Use the section locator above.'):regions.length?`Highlighted passage · PDF page ${pageNumber}.`:'No selected highlight on this page.');
  if(jump){$('#pdf-scroll').scrollTop=regions.length?Math.max(0,regions[0][1]*viewport.height-90):0;$('#pdf-scroll').scrollLeft=0;}
}

if(!study || !source){
  $('#source-title').textContent='Choose a study from the inventory';
  $('.source-layout').hidden=true;$('#source-original').hidden=true;
}else{
  document.title=`${study.authors} (${study.year}) · Source passages`;
  $('#source-title').textContent=study.title;$('#source-citation').textContent=`${study.authors} (${study.year}) · DOI ${study.doi}`;
  $('#source-original').href=safeLink(study.url);
  $('#passage-list').innerHTML=source.passages.map(p=>`<button class="passage-option" type="button" data-passage="${escape(p.id)}" aria-current="false">${escape(p.label)}<span>${escape(p.locator)}</span></button>`).join('');
  $('#passage-list').addEventListener('click',e=>{const b=e.target.closest('[data-passage]');if(b)updatePassage(b.dataset.passage,true);});
  $('#passage-select').innerHTML=source.passages.map(p=>`<option value="${escape(p.id)}">${escape(p.label)}</option>`).join('');
  $('#passage-select').addEventListener('change',event=>updatePassage(event.target.value,true));
  const doc=source.document;
  $('#source-license').innerHTML=`${escape(study.authors)} (${study.year}). ${doc.edition?`${escape(doc.edition)}. `:''}${doc.license?`${doc.licenseUrl?`<a href="${escape(safeLink(doc.licenseUrl))}" target="_blank" rel="noopener noreferrer">${escape(doc.license)}</a>`:escape(doc.license)}.`:''}`;
  updatePassage(params.get('passage'));
  if(!source.passages.length){$('#passage-title').textContent='Source paper';$('#passage-location').textContent='Full text needed to add passage highlights.';$('#passage-original').href=safeLink(study.url);}
  $('#local-pdf').addEventListener('change',async e=>{const file=e.target.files[0];if(file)await loadPdf(await file.arrayBuffer());});
  $('#page-prev').addEventListener('click',()=>{pageNumber--;renderPage(true);});
  $('#page-next').addEventListener('click',()=>{pageNumber++;renderPage(true);});
  $('#page-number').addEventListener('change',e=>{pageNumber=e.target.value;renderPage(true);});
  $('#pdf-zoom').addEventListener('change',()=>renderPage());
  $('#jump-passage').addEventListener('click',()=>{if(matched && selected?.pdf){pageNumber=selected.pdf.page;renderPage(true);}});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if($('#pdf-zoom').value==='fit')renderPage();},180);});
  if(doc.pdfPath){
    $('.pdf-tools').hidden=true;
    setStatus('Loading source PDF…');
    try{const response=await fetch(new URL(doc.pdfPath,location.href));if(!response.ok)throw Error('PDF unavailable');await loadPdf(await response.arrayBuffer());}catch{$('.pdf-tools').hidden=false;setStatus('Use the original paper link or open a copy from your computer.');}
  }else if(doc.sha256){setStatus('Open the original PDF from your computer to see the saved highlights.');}
}
