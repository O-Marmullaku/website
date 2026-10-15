if (window===parent) {
  const destination=new URL('../',location.href),params=new URLSearchParams(location.search);
  destination.hash=location.hash||params.get('id')||'';
  if(params.get('view')==='settings'){destination.searchParams.set('settings','1');destination.searchParams.set('sign-in','1');}
  location.replace(destination);
} else try {
  const response=await fetch('../mockup/profile.html',{cache:'no-store'});
  if(!response.ok)throw new Error('Could not load the CV. Please try again.');
  const template=new DOMParser().parseFromString(await response.text(),'text/html');
  for(const link of template.head.querySelectorAll('link'))document.head.append(document.importNode(link,true));
  template.querySelectorAll('script').forEach(script=>script.remove());
  document.body.replaceChildren(...[...template.body.childNodes].map(node=>document.importNode(node,true)));
  const style=document.createElement('link');style.rel='stylesheet';style.href='../main/profile-live.css?v=accounts-2';document.head.append(style);
  for(const path of ['../main/backend-config.js','../main/access-api.js?v=accounts-2','../admin/session.js?v=accounts-2'])await new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=path;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load account services.'));document.body.append(script);
  });
  await import('../mockup/profile.js?v=accounts-2');
} catch(error){parent.postMessage({type:'marmullaku-error',message:error.message},location.origin);}
