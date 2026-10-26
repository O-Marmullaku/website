if (window===parent) {
  const destination=new URL('../',location.href),params=new URLSearchParams(location.search);
  destination.hash=location.hash||params.get('id')||'';
  if(params.get('view')==='settings'){destination.searchParams.set('settings','1');destination.searchParams.set('sign-in','1');}
  location.replace(destination);
} else try {
  const response=await fetch('../profile/editor.html?v=revamp-20261026');
  if(!response.ok)throw new Error('Could not load the CV. Please try again.');
  const template=new DOMParser().parseFromString(await response.text(),'text/html');
  const loadStyle=link=>new Promise((resolve,reject)=>{
    const required=new URL(link.href,location.href).origin===location.origin;
    const finish=error=>{clearTimeout(timer);if(error&&required)reject(new Error('Could not load CV styles. Reload and try again.'));else resolve();};
    const timer=setTimeout(()=>finish(true),required?10000:3000);
    link.onload=()=>finish(false);link.onerror=()=>finish(true);document.head.append(link);
  });
  const styles=[...template.head.querySelectorAll('link[rel~="stylesheet"]')].map(link=>{
    const loading=loadStyle(document.importNode(link,true));
    return new URL(link.href,location.href).origin===location.origin?loading:Promise.resolve();
  });
  template.querySelectorAll('script').forEach(script=>script.remove());
  document.body.replaceChildren(...[...template.body.childNodes].map(node=>document.importNode(node,true)));
  const style=document.createElement('link');style.rel='stylesheet';style.href='../main/profile-live.css?v=revamp-20261026';styles.push(loadStyle(style));
  const paperStyle=document.createElement('link');paperStyle.rel='stylesheet';paperStyle.href='../main/cv-paper.css?v=revamp-20261026';styles.push(loadStyle(paperStyle));
  await Promise.all(styles);
  if(parent.MARMULLAKU_MOCKUP) {
    await (await import('../mockup/preview-session.mjs?v=revamp-20261026')).bootstrapPreview({ownerID:new URLSearchParams(location.search).get('id')||'osman'});
  } else if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&parent.MARMULLAKU_LOCAL_PREVIEW) {
    await (await import('./local-preview.mjs?v=revamp-20261026')).bootstrapLocal(new URLSearchParams(location.search).get('id')||'osman');
  } else {
  for(const path of ['../main/backend-config.js','../main/access-api.js?v=revamp-20261026','../admin/session.js?v=revamp-20261026'])await new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=path;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load account services.'));document.body.append(script);
  });
  }
  await import('../profile/editor.js?v=revamp-20261026');
} catch(error){parent.postMessage({type:'marmullaku-error',message:error.message},location.origin);}
