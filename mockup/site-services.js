(() => {
  window.MARMULLAKU_MOCKUP=true;
  const script=path=>new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src=path;el.onload=resolve;
    el.onerror=()=>reject(new Error('Could not load account services.'));document.head.append(el);
  });
  window.marmullakuServicesReady=(async()=>{
    await (await import('./preview-session.mjs?v=revamp-20261026')).bootstrapPreview();
    await script('main/sign-in.js?v=revamp-20261026');
    await script('main/private-access.js?v=revamp-20261026');
    if(document.readyState==='complete') {
      if(new URLSearchParams(location.search).has('sign-in'))window.showSignIn();
      if(location.hash.startsWith('#invite='))window.requestPrivateCV(null);
    }
  })();
  window.marmullakuRequest=(...args)=>window.marmullakuServicesReady.then(()=>window.marmullakuRequest(...args));
})();
