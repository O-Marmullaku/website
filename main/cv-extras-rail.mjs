export const libraryDocuments=(documents,attachedIDs,previewing)=>previewing?documents.filter(doc=>!attachedIDs.has(doc.id)):documents;

export function setupExtrasRail({editable}) {
  const rail=document.getElementById('extras-rail'),toolbar=document.querySelector('.resume-toolbar');
  const button=document.createElement('button');button.className='text-button cv-extras-tool';button.setAttribute('aria-label','Links & documents');button.setAttribute('aria-controls','extras-rail');button.setAttribute('aria-expanded','false');
  button.textContent='Links & documents';
  toolbar.insertBefore(button,toolbar.querySelector('.cv-download'));
  const close=document.createElement('button');close.className='icon-button close-extras';close.setAttribute('aria-label','Close links and documents');close.innerHTML='<svg aria-hidden="true"><use href="#close"/></svg>';rail.querySelector('.extras-heading').append(close);
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
  sync();return {sync,open(){if(!button.hidden&&!rail.matches(':popover-open'))rail.showPopover();}};
}
