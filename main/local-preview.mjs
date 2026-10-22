import {createPreviewAPI} from '../mockup/preview-api.mjs?v=cleanup';
import {putPreviewAsset,getPDF,deletePDF} from '../profile/pdf-store.mjs?v=cleanup';

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
  const api=createPreviewAPI({ownerID:profileID,load:read,save,putAsset:putPreviewAsset,getAsset:getPDF,removeAsset:deletePDF});
  window.MARMULLAKU_LOCAL_PREVIEW=true;
  window.marmullakuRequest=api.request;
  window.siblingSession={active:true,request:api.request,async signOut(){location.reload();}};
  return api;
}
