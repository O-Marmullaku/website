import {createProfileMotion} from '../main/profile-motion.mjs?v=smooth-windows-final';
await window.marmullakuServicesReady;
(() => {
  const session=window.siblingSession,identity=document.querySelector('.footer-identity');
  let own,focusBefore,frame,loading,origin,view,closing=false;
  const panel=document.createElement('dialog');panel.className='profile-window';panel.setAttribute('aria-label','CV and settings');
  const notice=document.createElement('div');notice.className='profile-loading';notice.setAttribute('role','status');
  const dismiss=document.createElement('button');dismiss.className='profile-dismiss';dismiss.textContent='Close';dismiss.addEventListener('click',()=>close());
  panel.append(notice,dismiss);document.body.append(panel);
  const motion=createProfileMotion(panel);
  function close(){if(closing)return closing;if(!panel.open)return Promise.resolve();clearTimeout(loading);closing=motion.exit(frame).then(()=>panel.close()).finally(()=>{closing=false;});return closing;}
  panel.addEventListener('cancel',event=>{event.preventDefault();close();});
  panel.addEventListener('close',()=>{if(panel.open)return;clearTimeout(loading);motion.reset();frame?.remove();frame=null;focusBefore?.focus({preventScroll:true});});
  async function open(nextView,id,token,source) {
    if(panel.open)await close();
    view=nextView;origin=source||document.activeElement;focusBefore=document.activeElement;notice.textContent='Opening…';notice.hidden=dismiss.hidden=true;
    frame?.remove();frame=document.createElement('iframe');frame.title=view==='settings'?'Profile settings':'CV';frame.referrerPolicy='no-referrer';frame.className='profile-frame-loading';
    const url=new URL('profile/',location.href);url.searchParams.set('view',view);url.searchParams.set('v','centered-paper');if(id)url.searchParams.set('id',id);if(token)url.hash='invite='+token;
    frame.src=url;panel.classList.toggle('settings-window',view==='settings');panel.append(frame);
    if(!panel.open)panel.showModal();
    clearTimeout(loading);loading=setTimeout(()=>{notice.hidden=dismiss.hidden=false;loading=setTimeout(()=>{notice.textContent='This is taking longer than usual. Close and try again.';},20000);},180);
  }
  function signedFooter() {
    identity.replaceChildren();const text=document.createElement('span');text.textContent=window.MARMULLAKU_LOCAL_PREVIEW?'Local preview · edits stay in this browser · ':'Signed in as ';
    const name=document.createElement('a');name.href='#settings';name.textContent=own.display_name;name.className='footer-account-name';name.addEventListener('click',event=>{event.preventDefault();open('settings',own.id);});
    const settings=document.createElement('button');settings.className='footer-settings';settings.setAttribute('aria-label','Open settings');settings.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.7 4.3.6-2.3h3.4l.6 2.3 2.1 1.2 2.3-.6 1.7 2.9-1.7 1.7v2.5l1.7 1.7-1.7 2.9-2.3-.6-2.1 1.2-.6 2.3h-3.4l-.6-2.3-2.1-1.2-2.3.6-1.7-2.9 1.7-1.7V9.5L3.6 7.8l1.7-2.9 2.3.6z"/><circle cx="12" cy="11" r="3"/></svg>';settings.addEventListener('click',()=>open('settings',own.id));
    identity.append(text,name,settings);
  }
  function ownTitle() {
    document.querySelectorAll('.card-title-edit').forEach(el=>el.remove());
    const role=document.querySelector(`.role[data-i18n="${own.id}"]`);if(!role)return;
    role.textContent=own.role||'';
    const edit=document.createElement('button');edit.className='card-title-edit';edit.setAttribute('aria-label','Edit your title');edit.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>';
    let original,busy=false;
    async function finish(keep=true) {
      if(role.contentEditable!=='plaintext-only'||busy)return;busy=true;role.contentEditable='false';role.removeAttribute('role');edit.setAttribute('aria-pressed','false');
      if(!keep)role.textContent=original;
      else if(role.textContent!==original) {
        try{const current=await session.request('profile');const saved=await session.request('save',{role:role.textContent.slice(0,160),cv:current.profile.cv,updated_at:current.profile.updated_at});own=saved.profile;role.textContent=own.role;}
        catch(error){role.textContent=original;notice.textContent=error.message;window.alert(error.message);}
      }
      busy=false;
    }
    edit.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(busy)return;if(role.isContentEditable){finish();return;}original=role.textContent;role.contentEditable='plaintext-only';role.setAttribute('role','textbox');role.setAttribute('aria-label','Professional title');edit.setAttribute('aria-pressed','true');role.focus();});
    role.addEventListener('input',()=>{if(role.textContent.length>160)role.textContent=role.textContent.slice(0,160);});
    role.addEventListener('click',event=>{if(role.isContentEditable)event.stopPropagation();});
    role.addEventListener('blur',()=>finish());role.addEventListener('keydown',event=>{if(['Enter','Escape'].includes(event.key)){event.preventDefault();event.stopPropagation();finish(event.key!=='Escape');}});
    let field=role.closest('.card-title-field');
    if(!field){field=document.createElement('div');field.className='card-title-field';role.before(field);field.append(role);}
    field.append(edit);
  }
  async function boot() {
    if(!session.active)return;
    try{own=(await session.request('profile')).profile;signedFooter();ownTitle();if(new URLSearchParams(location.search).has('settings'))open('settings',own.id);}
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
    if(data.type==='marmullaku-ready'){clearTimeout(loading);notice.hidden=dismiss.hidden=true;if(!closing)motion.enter(frame,origin,view);}
    if(data.type==='marmullaku-close')close();
    if(data.type==='marmullaku-error'){clearTimeout(loading);notice.hidden=dismiss.hidden=false;notice.textContent=String(data.message).slice(0,300);frame.hidden=true;}
    if(data.type==='marmullaku-saved'&&(window.MARMULLAKU_LOCAL_PREVIEW||own?.id===data.id)){if(own?.id===data.id)own.role=data.role;const role=document.querySelector(`.role[data-i18n="${data.id}"]`);if(role)role.textContent=data.role;}
    if(data.type==='marmullaku-signed-out')close().then(()=>location.assign(new URL('./',location.href)));
  });
  addEventListener('marmullaku-signed-in',boot);boot();
})();
