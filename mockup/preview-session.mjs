import {createPreviewAPI} from './preview-api.mjs?v=paper-documents';
import {createAssetStore,getPDF as originalAsset} from './pdf-store.mjs?v=paper-documents';
import {profilesToSeed} from './profile-seed.mjs?v=paper-documents';

const key='marmullaku-site-preview-v1',signedOut='marmullaku-preview-signed-out';
const store=createAssetStore('marmullaku-site-preview-attachments');
const read=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const save=state=>localStorage.setItem(key,JSON.stringify(state));
let initialization;
async function initialize() {
  let state=read(key);
  const source=['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&read('marmullaku-local-profiles-v1');
  if(source&&!localStorage.getItem('marmullaku-site-preview-live-sync-v1')) {
    if(state&&!localStorage.getItem('marmullaku-site-preview-before-live-sync-v1'))localStorage.setItem('marmullaku-site-preview-before-live-sync-v1',JSON.stringify(state));
    // Copy profile content once; subsequent edits and company links remain independent.
    state={...structuredClone(source),family:state?.family||source.family,links:state?.links||[],events:state?.events||[]};
    save(state);
  }
  if(!state) {
    const cv={contact:[],skills:[],languages:[],profile:'',experience:[],education:[],certs:[],interests:''};
    state={profiles:['osman','diellza','drilona','drenusha','dredhza','ali'].map(id=>({id,display_name:id[0].toUpperCase()+id.slice(1)+' Marmullaku',role:'',cv:structuredClone(cv),updated_at:new Date().toISOString()})),family:[],links:[],events:[],assets:[]};
    save(state);
  }
  // Older drafts shared an attachment database. Copy them without deleting originals.
  for(const asset of state.assets) {
    if(await store.get(asset.id))continue;
    const blob=await originalAsset(asset.id);if(blob)await store.put(blob,asset.id);
  }
  if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)) {
    const response=await fetch('/work/testing-profiles.json',{cache:'no-store'});
    if(response.ok) {
      const imported=await response.json(),restore=state.cv_content_revision!=='imported-cvs-v2';
      const entries=restore?imported:profilesToSeed(state.profiles,imported,state.seeded_profiles||[]);
      if(restore&&!localStorage.getItem('marmullaku-before-full-cv-restore-v2'))
        localStorage.setItem('marmullaku-before-full-cv-restore-v2',JSON.stringify(state));
      for(const {profile,files} of entries) {
        await Promise.all(files.map(async file=>{
          if(await store.get(file.id))return;
          const existing=await originalAsset(file.id);
          if(existing){await store.put(existing,file.id);return;}
          const response=await fetch(file.url,{cache:'no-store'});
          if(!response.ok)throw new Error('Could not load the CV documents. Reload and try again.');
          await store.put(new Blob([await response.arrayBuffer()],{type:file.mime}),file.id);
        }));
        const index=state.profiles.findIndex(item=>item.id===profile.id),existing=state.profiles[index];
        const role=existing?.role;
        const next={...profile,role:role&&!['Job title','Your professional titles'].includes(role)?role:profile.role};
        if(index<0)state.profiles.push(next);else state.profiles[index]=next;
        state.assets.push(...files.filter(file=>!state.assets.some(asset=>asset.id===file.id)).map(({url,...asset})=>asset));
        state.seeded_profiles=[...state.seeded_profiles||[],profile.id];
      }
      state.cv_content_revision='imported-cvs-v2';
      if(entries.length)save(state);
    }
  }
  if(source)localStorage.setItem('marmullaku-site-preview-live-sync-v1','true');
}
export async function bootstrapPreview({ownerID='osman'}={}) {
  await (initialization ||= initialize());
  window.MARMULLAKU_MOCKUP=true;
  const api=createPreviewAPI({ownerID,load:()=>read(key),save,putAsset:file=>store.put(file),getAsset:id=>store.get(id),removeAsset:id=>store.remove(id)});
  window.marmullakuRequest=api.request;
  window.siblingSession={get active(){return localStorage.getItem(signedOut)!=='true';},request:api.request,
    async signIn(){localStorage.removeItem(signedOut);},async signOut(){localStorage.setItem(signedOut,'true');},
    async sendCode(){throw new Error('Email delivery is unavailable here.');},
    async verify(){throw new Error('Email delivery is unavailable here.');},
    async setPassword(){throw new Error('Password setup is unavailable here.');}
  };
  return api;
}
