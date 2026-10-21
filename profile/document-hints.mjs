export function setupDocumentHints(root) {
  const hint=document.createElement('aside');
  hint.className='cv-document-hint';hint.popover='manual';hint.setAttribute('aria-label','Supporting document');
  hint.innerHTML='<button type="button" tabindex="-1"><span class="document-hint-name"></span><span class="document-hint-action">Open document <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span></button>';
  root.append(hint);
  let source,row,closing;
  const cancelClose=()=>clearTimeout(closing);
  function hide(){
    cancelClose();
    if(hint.matches(':popover-open'))hint.hidePopover();
    source=row=null;
  }
  function show(button){
    cancelClose();
    if(!button?.isConnected||root.querySelector('.document-open')||root.querySelector('[contenteditable="plaintext-only"]'))return hide();
    if(source===button&&hint.matches(':popover-open'))return;
    source=button;row=button.closest('.cv-document-card')||button;
    const name=button.querySelector('span')?.textContent||button.getAttribute('aria-label');
    hint.querySelector('.document-hint-name').textContent=name;
    hint.querySelector('button').setAttribute('aria-label',`Open ${name}`);
    position();
  }
  function position(){
    if(!source?.isConnected)return hide();
    const bounds=row.getBoundingClientRect(),viewport=document.documentElement.clientWidth;
    if(bounds.bottom<12||bounds.top>innerHeight-12)return hide();
    const space=viewport-bounds.right-24,beside=space>=180;
    hint.style.width=`${Math.min(260,beside?space:viewport-24)}px`;
    if(!hint.matches(':popover-open'))hint.showPopover();
    const box=hint.getBoundingClientRect();
    const left=beside?bounds.right+12:Math.max(12,Math.min(viewport-box.width-12,bounds.right-box.width));
    const top=beside?bounds.top+(bounds.height-box.height)/2:bounds.top-box.height-12>=12?bounds.top-box.height-12:bounds.bottom+12;
    hint.style.left=`${left}px`;
    hint.style.top=`${Math.max(12,Math.min(innerHeight-box.height-12,top))}px`;
  }
  const scheduleClose=()=>{cancelClose();closing=setTimeout(hide,140);};
  root.addEventListener('pointerover',event=>{
    if(event.pointerType==='touch')return;
    const card=event.target.closest('.cv-document-card');
    const button=event.target.closest('.document-link')||card?.querySelector('.document-link');
    if(button)show(button);
  });
  root.addEventListener('pointerout',event=>{
    if(source&&!row.contains(event.relatedTarget)&&!hint.contains(event.relatedTarget))scheduleClose();
  });
  hint.addEventListener('pointerenter',cancelClose);
  hint.addEventListener('pointerleave',event=>{if(!row?.contains(event.relatedTarget))scheduleClose();});
  root.addEventListener('focusin',event=>{
    if(hint.contains(event.target))return;
    const button=event.target.closest('.document-link');
    if(button)show(button);else hide();
  });
  root.addEventListener('focusout',event=>{
    if(!hint.contains(event.relatedTarget)&&event.relatedTarget!==source)hide();
  });
  hint.querySelector('button').addEventListener('click',()=>{const button=source;hide();button?.click();});
  root.addEventListener('click',event=>{if(event.target.closest('.document-link'))hide();});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&hint.matches(':popover-open')){event.preventDefault();event.stopPropagation();hide();}
  },true);
  root.addEventListener('scroll',()=>{if(source)position();},true);
  root.addEventListener('close',hide);
  addEventListener('resize',hide);
  addEventListener('beforeprint',hide);
}
