// Warm only public interface files; private profiles and assets stay behind the open action.
export function setupProfilePreload(document) {
  let warmed=false;
  const resources=[
    ['modulepreload','profile/editor.js?v=hover-20261028'],
    ['modulepreload','main/profile-adapter.mjs?v=revamp-20261026'],
    ['modulepreload','main/live-sharing.mjs?v=revamp-20261026'],
    ['preload','profile/editor.html?v=revamp-20261026','fetch'],
    ['preload','profile/editor.css?v=revamp-20261026','style'],
    ['preload','main/profile-live.css?v=revamp-20261026','style'],
    ['preload','main/cv-paper.css?v=hover-20261028','style'],
    ['preload','main/pdf-reader.css?v=revamp-20261026','style'],
    ['preload','main/backend-config.js','script'],
    ['preload','main/access-api.js?v=revamp-20261026','script'],
    ['preload','admin/session.js?v=revamp-20261026','script'],
  ];
  const warm=event=>{
    if(warmed||document.defaultView?.navigator.connection?.saveData||!event.target.closest?.('.card,.footer-account-name,.footer-settings'))return;
    warmed=true;
    for(const [rel,path,as] of resources){
      const link=document.createElement('link');link.rel=rel;link.href=new URL(path,document.baseURI).href;
      if(as)link.as=as;
      if(as==='fetch')link.crossOrigin='anonymous';
      document.head.append(link);
    }
  };
  for(const type of ['pointerover','focusin','pointerdown'])document.addEventListener(type,warm,{passive:true});
}
