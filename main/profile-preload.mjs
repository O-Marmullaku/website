// Warm only public interface files; private profiles and assets stay behind the open action.
export function setupProfilePreload(document) {
  let warmed=false;
  const resources=[
    ['modulepreload','profile/editor.js?v=fast-open-1'],
    ['modulepreload','main/profile-adapter.mjs?v=parallel-media-1'],
    ['modulepreload','main/live-sharing.mjs?v=sharing-recovery-1'],
    ['preload','profile/editor.html?v=fast-open-1','fetch'],
    ['preload','profile/editor.css?v=aligned-logos','style'],
    ['preload','main/profile-live.css?v=reader-toolbar-1','style'],
    ['preload','main/cv-paper.css?v=mobile-entries-1','style'],
    ['preload','main/pdf-reader.css?v=reader-docked-1','style'],
    ['preload','main/backend-config.js','script'],
    ['preload','main/access-api.js?v=accounts-2','script'],
    ['preload','admin/session.js?v=cleanup','script'],
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
