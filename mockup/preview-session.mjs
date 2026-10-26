import {createPreviewAPI} from './preview-api.mjs?v=revamp-20261026';
import {createAssetStore,getPDF as originalAsset} from '../profile/pdf-store.mjs?v=revamp-20261026';
import {profilesToSeed,applyCopyUpdates} from './profile-seed.mjs?v=revamp-20261026';

const key='marmullaku-site-preview-v1',signedOut='marmullaku-preview-signed-out';
const store=createAssetStore('marmullaku-site-preview-attachments');
const read=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const save=state=>localStorage.setItem(key,JSON.stringify(state));
async function ensureAssets(state,files){
  let changed=false;
  await Promise.all(files.map(async file=>{
    if(!await store.get(file.id)){
      const existing=await originalAsset(file.id);
      if(existing)await store.put(existing,file.id);
      else{
        const response=await fetch(file.url,{cache:'no-store'});
        if(!response.ok)throw new Error('Could not load the CV documents. Reload and try again.');
        await store.put(new Blob([await response.arrayBuffer()],{type:file.mime}),file.id);
      }
    }
    if(!state.assets.some(asset=>asset.id===file.id)){
      const {url,...asset}=file;state.assets.push(asset);changed=true;
    }
  }));
  return changed;
}
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
        await ensureAssets(state,files);
        const index=state.profiles.findIndex(item=>item.id===profile.id),existing=state.profiles[index];
        const role=existing?.role;
        const next={...profile,role:role&&!['Job title','Your professional titles'].includes(role)?role:profile.role};
        if(index<0)state.profiles.push(next);else state.profiles[index]=next;
        state.seeded_profiles=[...state.seeded_profiles||[],profile.id];
      }
      state.cv_content_revision='imported-cvs-v2';
      let copyChanged=false,assetsChanged=false;
      const beforeCopy=JSON.stringify(state);
      for(const entry of imported){
        const profile=state.profiles.find(profile=>profile.id===entry.profile.id);
        if(profile&&entry.copy_updates?.length)assetsChanged=await ensureAssets(state,entry.files)||assetsChanged;
        if(profile&&applyCopyUpdates(profile,entry.copy_updates)){
          profile.updated_at=new Date().toISOString();copyChanged=true;
        }
      }
      if(copyChanged&&!localStorage.getItem('marmullaku-before-copy-update-v1'))localStorage.setItem('marmullaku-before-copy-update-v1',beforeCopy);
      if(entries.length||copyChanged||assetsChanged)save(state);
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
