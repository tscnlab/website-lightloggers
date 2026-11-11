/* Keep source passages on the current page; ordinary links remain shareable. */
(() => {
  if(location.pathname.endsWith('/source.html'))return;
  const dialog=document.createElement('dialog');
  dialog.id='source-dialog';
  dialog.setAttribute('aria-labelledby','source-dialog-title');
  dialog.innerHTML='<div class="dialog-header"><h2 id="source-dialog-title">Source paper</h2><button class="close-dialog" aria-label="Close PDF reader" autofocus>×</button></div><iframe id="source-frame" title="Source paper and highlighted passages"></iframe>';
  document.body.append(dialog);
  const frame=dialog.querySelector('iframe');
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="source.html?"]');
    if(!link || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    event.preventDefault();
    const url=new URL(link.href);
    url.searchParams.set('embedded','1');
    frame.src=url.href;
    dialog.showModal();
    document.body.style.overflow='hidden';
  });
  dialog.addEventListener('close',()=>{
    frame.removeAttribute('src');
    document.body.style.overflow=document.querySelector('dialog[open]')?'hidden':'';
  });
  window.addEventListener('message',event=>{
    if(event.origin===location.origin && event.source===frame.contentWindow && event.data?.type==='lightlogger-reader-close')dialog.close();
  });
})();
