if (window===parent) {
  const destination=new URL('../',location.href),params=new URLSearchParams(location.search);
  destination.hash=location.hash||params.get('id')||'';
  if(params.get('view')==='settings'){destination.searchParams.set('settings','1');destination.searchParams.set('sign-in','1');}
  location.replace(destination);
} else try {
  const response=await fetch('../profile/editor.html',{cache:'no-store'});
  if(!response.ok)throw new Error('Could not load the CV. Please try again.');
  const template=new DOMParser().parseFromString(await response.text(),'text/html');
  for(const link of template.head.querySelectorAll('link'))document.head.append(document.importNode(link,true));
  template.querySelectorAll('script').forEach(script=>script.remove());
  document.body.replaceChildren(...[...template.body.childNodes].map(node=>document.importNode(node,true)));
  const style=document.createElement('link');style.rel='stylesheet';style.href='../main/profile-live.css?v=cv-view-switch';document.head.append(style);
  if(parent.MARMULLAKU_MOCKUP) {
    await (await import('../mockup/preview-session.mjs?v=cv-view-switch')).bootstrapPreview({ownerID:new URLSearchParams(location.search).get('id')||'osman'});
  } else if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&parent.MARMULLAKU_LOCAL_PREVIEW) {
    await (await import('./local-preview.mjs?v=cv-view-switch')).bootstrapLocal(new URLSearchParams(location.search).get('id')||'osman');
  } else {
  for(const path of ['../main/backend-config.js','../main/access-api.js?v=accounts-2','../admin/session.js?v=accounts-2'])await new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=path;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load account services.'));document.body.append(script);
  });
  }
  await import('../profile/editor.js?v=cv-view-switch');
} catch(error){parent.postMessage({type:'marmullaku-error',message:error.message},location.origin);}
