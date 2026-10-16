import {createPreviewAPI} from './preview-api.mjs';
import {createAssetStore,getPDF as originalAsset} from './pdf-store.mjs?v=shared-mockup';

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
