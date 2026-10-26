import {createPreviewAPI} from '../mockup/preview-api.mjs?v=revamp-20261026';
import {putPreviewAsset,getPDF,deletePDF,createAssetStore} from '../profile/pdf-store.mjs?v=revamp-20261026';
import {profilesToSeed} from '../mockup/profile-seed.mjs?v=revamp-20261026';

export const isLocalPreview=host=>['localhost','127.0.0.1','[::1]'].includes(host);
const key='marmullaku-local-profiles-v1';
export async function bootstrapLocal(profileID='osman') {
  if(!isLocalPreview(location.hostname))throw new Error('Local preview is only available on localhost.');
  const read=()=>JSON.parse(localStorage.getItem(key));
  const save=value=>localStorage.setItem(key,JSON.stringify(value));
  if(!read()) {
    const names=['Osman','Diellza','Drilona','Drenusha','Dredhza','Ali'];
    const cv={contact:[],skills:[],languages:[],profile:'',experience:[],education:[],certs:[],interests:''};
    save({profiles:names.map(name=>({id:name.toLowerCase(),display_name:name+' Marmullaku',role:'',cv:structuredClone(cv),updated_at:new Date().toISOString()})),family:[],links:[],events:[],assets:[]});
  }
  if(!read().profiles.some(profile=>profile.id===profileID))throw new Error('Profile unavailable.');
  const previewAssets=createAssetStore('marmullaku-site-preview-attachments');
  for(const asset of read().assets){
    if(await getPDF(asset.id))continue;
    const file=await previewAssets.get(asset.id);
    if(file)await putPreviewAsset(file,asset.id);
  }
  const response=await fetch('/work/testing-profiles.json',{cache:'no-store'});
  if(response.ok){
    const state=read(),imported=await response.json(),entries=profilesToSeed(state.profiles,imported,state.seeded_profiles||[]);
    let assetsChanged=false;
    for(const {files} of imported){
      for(const file of files){
        if(!await getPDF(file.id)){
          const asset=await fetch(file.url,{cache:'no-store'});
          if(!asset.ok)throw new Error('Could not load the CV documents. Reload and try again.');
          // Keep imported attachment IDs so the CV links resolve to their original files.
          await putPreviewAsset(await asset.blob(),file.id);
        }
        if(!state.assets.some(asset=>asset.id===file.id)){const {url,...metadata}=file;state.assets.push(metadata);assetsChanged=true;}
      }
    }
    for(const asset of state.assets){
      if(await getPDF(asset.id))continue;
      const matches=imported.flatMap(entry=>entry.files).filter(file=>file.profile_id===asset.profile_id&&file.name===asset.name&&file.mime===asset.mime);
      if(matches.length===1){const file=await getPDF(matches[0].id);if(file)await putPreviewAsset(file,asset.id);}
    }
    for(const {profile} of entries){
      const index=state.profiles.findIndex(item=>item.id===profile.id),existing=state.profiles[index];
      const next={...profile,role:existing?.role||profile.role};
      if(index<0)state.profiles.push(next);else state.profiles[index]=next;
      state.seeded_profiles=[...state.seeded_profiles||[],profile.id];
    }
    if(entries.length||assetsChanged)save(state);
  }
  const api=createPreviewAPI({ownerID:profileID,load:read,save,putAsset:putPreviewAsset,getAsset:getPDF,removeAsset:deletePDF});
  window.MARMULLAKU_LOCAL_PREVIEW=true;
  window.marmullakuRequest=api.request;
  window.siblingSession={active:true,request:api.request,async signOut(){location.reload();}};
  return api;
}
