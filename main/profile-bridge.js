import {createProfileMotion} from '../main/profile-motion.mjs?v=aligned-logos';
await window.marmullakuServicesReady;
(() => {
  const session=window.siblingSession,identity=document.querySelector('.footer-identity');
  let own,focusBefore,frame,loading,origin,view,closing=false,generation=0,expectedCloses=0;
  const panel=document.createElement('dialog');panel.className='profile-window';panel.setAttribute('aria-label','CV and settings');
  const notice=document.createElement('div');notice.className='profile-loading';notice.setAttribute('role','status');
  const dismiss=document.createElement('button');dismiss.className='profile-dismiss';dismiss.textContent='Close';dismiss.addEventListener('click',()=>close());
  panel.append(notice,dismiss);document.body.append(panel);
  const motion=createProfileMotion(panel);
  function close({settled=false}={}){
    generation++;
    if(closing)return closing;
    clearTimeout(loading);
    if(!panel.open){panel.classList.remove('preparing');origin?.removeAttribute('aria-busy');frame?.remove();frame=null;return Promise.resolve(true);}
    const departing=frame;
    closing=(async()=>{
      if(departing)departing.inert=true;
      try{
        if(!settled&&await departing?.contentWindow?.flushProfile?.()===false)return false;
        await motion.exit(departing);
        if(panel.open){expectedCloses++;panel.close();}
        motion.reset();departing?.remove();
        if(frame===departing){frame=null;focusBefore?.focus({preventScroll:true});}
        return true;
      }catch(error){
        const status=departing?.contentDocument?.querySelector('#settings-panel[open] #settings-status, #resume[open] #resume-status');
        if(status)status.textContent=error.message;
        else{notice.textContent=error.message;notice.hidden=false;}
        return false;
      }finally{if(departing)departing.inert=false;}
    })().finally(()=>{closing=false;});
    return closing;
  }
  panel.addEventListener('cancel',event=>{event.preventDefault();close();});
  panel.addEventListener('close',()=>{
    if(expectedCloses){expectedCloses--;return;}
    if(panel.open||!frame)return;
    // A native close (including repeated Escape) must still settle unsaved edits.
    panel.showModal();close();
  });
  async function open(nextView,id,token,source) {
    const previous=panel.open||frame?close():null,current=++generation;
    if(previous&&await previous===false)return;
    if(current!==generation)return;
    view=nextView;origin=source||document.activeElement;focusBefore=document.activeElement;origin?.setAttribute('aria-busy','true');notice.hidden=dismiss.hidden=true;
    frame?.remove();frame=document.createElement('iframe');frame.title=view==='settings'?'Profile settings':'CV';frame.referrerPolicy='no-referrer';frame.className='profile-frame-loading';
    const url=new URL('profile/',document.baseURI);url.searchParams.set('view',view);url.searchParams.set('v','pdf-reader-9');if(id)url.searchParams.set('id',id);if(token)url.hash='invite='+token;
    frame.src=url;panel.classList.toggle('settings-window',view==='settings');panel.append(frame);panel.classList.add('preparing');
    clearTimeout(loading);loading=setTimeout(()=>{origin?.removeAttribute('aria-busy');panel.classList.remove('preparing');notice.textContent='Could not open this page. Close and try again.';notice.hidden=dismiss.hidden=false;if(!panel.open)panel.showModal();},20000);
  }
  function signedFooter() {
    identity.replaceChildren();const text=document.createElement('span');text.textContent='Signed in as ';
    const name=document.createElement('a');name.href='#settings';name.textContent=own.display_name;name.className='footer-account-name';name.addEventListener('click',event=>{event.preventDefault();open('settings',own.id);});
    const settings=document.createElement('button');settings.className='footer-settings';settings.setAttribute('aria-label','Open settings');settings.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.7 4.3.6-2.3h3.4l.6 2.3 2.1 1.2 2.3-.6 1.7 2.9-1.7 1.7v2.5l1.7 1.7-1.7 2.9-2.3-.6-2.1 1.2-.6 2.3h-3.4l-.6-2.3-2.1-1.2-2.3.6-1.7-2.9 1.7-1.7V9.5L3.6 7.8l1.7-2.9 2.3.6z"/><circle cx="12" cy="11" r="3"/></svg>';settings.addEventListener('click',()=>open('settings',own.id));
    identity.append(text,name,settings);
  }
  const publishRole=profile=>document.dispatchEvent(new CustomEvent('marmullaku-profile-updated',{detail:{id:profile.id,role:profile.role}}));
  async function boot() {
    if(!session.active)return;
    try{own=(await session.request('profile')).profile;signedFooter();publishRole(own);if(new URLSearchParams(location.search).has('settings'))open('settings',own.id);}
    catch(error){if([401,403].includes(error.status))await session.signOut();}
  }
  const guestRequest=window.requestPrivateCV;
  window.requestPrivateCV=card=>{
    const token=location.hash.match(/^#invite=([A-Za-z0-9_-]{43})$/)?.[1];
    if(!token&&session.active){open('cv',card?.querySelector('.role').dataset.i18n||own?.id,undefined,card);return;}
    return guestRequest(card);
  };
  window.openPrivateCV=(card,profile)=>open('cv',profile.id,location.hash.match(/^#invite=([A-Za-z0-9_-]{43})$/)?.[1],card);
  addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
    const data=event.data;if(!data||typeof data!=='object')return;
    if(data.type==='marmullaku-ready'){clearTimeout(loading);notice.hidden=dismiss.hidden=true;if(!closing){origin?.removeAttribute('aria-busy');panel.classList.remove('preparing');if(!panel.open)panel.showModal();motion.enter(frame,origin,view);}}
    if(data.type==='marmullaku-close')close();
    if(data.type==='marmullaku-error'){clearTimeout(loading);notice.hidden=dismiss.hidden=false;notice.textContent=String(data.message).slice(0,300);frame.hidden=true;origin?.removeAttribute('aria-busy');panel.classList.remove('preparing');if(!panel.open)panel.showModal();}
    if(data.type==='marmullaku-saved'&&typeof data.id==='string'&&typeof data.role==='string'&&(window.MARMULLAKU_LOCAL_PREVIEW||own?.id===data.id)){
      if(own?.id===data.id)own.role=data.role;
      publishRole(data);
    }
    if(data.type==='marmullaku-signed-out')close({settled:true}).then(()=>location.assign(new URL('./',location.href)));
  });
  addEventListener('marmullaku-signed-in',boot);boot();
})();
