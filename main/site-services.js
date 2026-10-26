(() => {
  const script=path=>new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=path;el.onload=resolve;el.onerror=()=>reject(new Error('Could not load account services.'));document.head.append(el);});
  window.marmullakuServicesReady=(async()=>{
    if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&(!location.hash.startsWith('#invite=')||new URLSearchParams(location.search).get('local')==='1')) {
      await (await import('./local-preview.mjs?v=revamp-20261026')).bootstrapLocal();
    } else {
      for(const path of ['main/backend-config.js','main/access-api.js?v=revamp-20261026','admin/session.js?v=revamp-20261026','main/sign-in.js?v=revamp-20261026'])await script(path);
    }
    await script('main/private-access.js?v=revamp-20261026');
    if(document.readyState==='complete') {
      if(new URLSearchParams(location.search).has('sign-in'))window.showSignIn?.();
      if(location.hash.startsWith('#invite='))window.requestPrivateCV(null);
    }
  })();
  window.marmullakuRequest=(...args)=>window.marmullakuServicesReady.then(()=>window.marmullakuRequest(...args));
})();
