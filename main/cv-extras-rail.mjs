export const libraryDocuments=(documents,attachedIDs,previewing)=>previewing?documents.filter(doc=>!attachedIDs.has(doc.id)):documents;

export function setupExtrasRail({editable,onLayout}) {
  const rail=document.getElementById('extras-rail'),toolbar=document.querySelector('.resume-toolbar');
  const button=document.createElement('button');button.className='text-button cv-extras-tool';button.setAttribute('aria-label','More about me');button.setAttribute('aria-controls','extras-rail');button.setAttribute('aria-expanded','false');
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM14 4v16M17 8h1M17 12h1M17 16h1"/></svg>';
  toolbar.insertBefore(button,toolbar.querySelector('.cv-download'));
  const close=document.createElement('button');close.className='icon-button close-extras';close.setAttribute('aria-label','Close extras');close.innerHTML='<svg aria-hidden="true"><use href="#close"/></svg>';rail.querySelector('.extras-heading').append(close);
  rail.setAttribute('popover','auto');
  function sync(){
    const empty=!rail.querySelector('.extra-block,#pdf-list button');
    rail.classList.toggle('extras-empty',empty);
    button.hidden=rail.hidden||(!editable()&&empty);
    if(button.hidden&&rail.matches(':popover-open'))rail.hidePopover();
  }
  button.addEventListener('click',()=>rail.togglePopover());
  close.addEventListener('click',()=>{rail.hidePopover();button.focus({preventScroll:true});});
  rail.addEventListener('toggle',event=>button.setAttribute('aria-expanded',String(event.newState==='open')));
  new MutationObserver(sync).observe(rail,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  sync();requestAnimationFrame(onLayout);return {sync,open(){if(!button.hidden&&!rail.matches(':popover-open'))rail.showPopover();}};
}
