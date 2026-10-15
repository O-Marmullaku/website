import {createPreviewAPI} from './preview-api.mjs';
import {normalizeRows} from './cv-rows.mjs?v=accounts-2';
import {toCV} from '../main/profile-adapter.mjs?v=preview-split';
import {putPreviewAsset,getPDF,deletePDF} from './pdf-store.mjs?v=site-preview';

const key='marmullaku-site-preview-v1',signedOut='marmullaku-preview-signed-out';
let ready;
export function bootstrapPreview() {return ready ||= initialize();}
async function initialize() {
  const read=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
  const save=state=>localStorage.setItem(key,JSON.stringify(state));
  if(!read(key)) {
    const draft=read('marmullaku-profile-mockup-v1')||{},sharing=read('marmullaku-sharing-mockup-v1')||{};
    const values={role:'Job title',profile:'Write a short introduction.',contact:'Email address\nPortfolio website',skills:'Interface design\nWeb development',languages:'Add your languages',education:'Qualification or programme\nInstitution',experience:'Your latest role\nCompany or organisation',certificates:'Add a relevant certification',interests:'Add your interests',...draft};
    const state={profiles:[],family:[],links:[],events:[],assets:[]},ids=new Map();
    const seedImage=async value=>{
      if(!/^data:image\/(png|jpeg|webp);base64,/.test(value||''))return;
      const [header,base64]=value.split(','),mime=header.slice(5,header.indexOf(';')),bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),id=await putPreviewAsset(new Blob([bytes],{type:mime}));
      ids.set(value,id);state.assets.push({id,profile_id:'osman',name:'Picture',mime});
    };
    const rows=normalizeRows(draft.cvRows,values);
    for(const value of new Set([draft.picture,...Object.values(rows).flat().map(row=>row.logo)].filter(Boolean)))await seedImage(value);
    const documents=Array.isArray(draft.documents)?draft.documents:[];
    for(const doc of documents)state.assets.push({id:doc.id,profile_id:'osman',name:doc.name,mime:'application/pdf'});
    const cv=toCV({...values,cvRows:rows,extraTypes:draft.extraTypes||[],documents,pictureAnchor:draft.pictureAnchor||null},ids);
    for(const id of ['osman','diellza','drilona','drenusha','dredhza','ali'])state.profiles.push({id,display_name:id[0].toUpperCase()+id.slice(1)+' Marmullaku',role:id==='osman'?values.role:'',cv:id==='osman'?cv:{contact:[],skills:[],languages:[],profile:'',experience:[],education:[],certs:[],interests:''},updated_at:new Date().toISOString()});
    state.family=(sharing.family||[]).map(name=>({owner_id:'osman',recipient_id:name.toLowerCase(),enabled:true}));
    for(const old of sharing.links||[]) {
      const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
      state.links.push({id:old.id,profile_id:'osman',company:old.company,message:'',token,created_at:old.created,expires_at:null,revoked:!!old.disabled});
      for(const event of old.events||[])state.events.push({link_id:old.id,profile_id:'osman',kind:event.type,label:event.label,created_at:event.at});
    }
    save(state);
  }
  const api=createPreviewAPI({load:()=>read(key),save,putAsset:putPreviewAsset,getAsset:getPDF,removeAsset:deletePDF});
  window.marmullakuRequest=api.request;
  window.siblingSession={get active(){return localStorage.getItem(signedOut)!=='true';},request:api.request,
    async signIn(){localStorage.removeItem(signedOut);},async signOut(){localStorage.setItem(signedOut,'true');}};
  window.showSignIn=async()=>{await window.siblingSession.signIn();dispatchEvent(new Event('marmullaku-signed-in'));};
  document.getElementById('sign-in-trigger')?.addEventListener('click',window.showSignIn);
  return api;
}
