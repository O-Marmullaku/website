import { normalizeRows } from '../mockup/cv-rows.mjs?v=accounts-2';
import { validatePDF } from '../mockup/pdf-store.mjs';

// The editor's media are in-memory previews; only private asset IDs are saved.
export function fromProfile(profile) {
  const cv=profile.cv, editor=cv.editor;
  const row=(title='',detail='',date='',body='',extra={})=>({id:crypto.randomUUID(),title,detail,date,body,level:0,...extra});
  const rows=editor?.rows || {
    contact:cv.contact.map(([label,href])=>row(label,'','','',{href})),
    skills:cv.skills.map(([label,score])=>row(label,'','','',{score})),
    languages:cv.languages.map(([label,detail])=>row(label,detail)),
    experience:cv.experience.map(item=>row(item.title,item.org,item.when,item.points.join('\n'))),
    education:cv.education.map(item=>row(item.title,item.org,item.when)),
    certificates:cv.certs.map(item=>row(item.title,item.org,item.when)),
    interests:cv.interests.split('\n').filter(Boolean).map(value=>row(value)),
  };
  return {name:profile.display_name,role:profile.role,profile:cv.profile,
    fact:'',linkLabel:'',linkURL:'',buttonLabel:'',buttonURL:'',pictureCaption:'',picture:'',
    ...editor?.data,cvRows:normalizeRows(rows,{}),extraTypes:editor?.extraTypes||[],
    documents:editor?.documents||[],pictureAnchor:editor?.pictureAnchor||null};
}
export function toCV(state, assetIDs) {
  const rows=Object.fromEntries(Object.entries(state.cvRows).map(([key,values])=>[key,values.map(row=>{
    const {logo,...rest}=row;return {...rest,logo_id:logo?assetIDs.get(logo)||null:null};
  })]));
  const period=row=>({when:row.date,title:row.title,org:row.detail});
  return {contact:rows.contact.map(row=>[row.title,row.href||'']),skills:rows.skills.map(row=>[row.title,row.score||0]),
    languages:rows.languages.map(row=>[row.title,row.detail||['','Beginner','Elementary','Intermediate','Advanced','Fluent / native'][row.level]]),
    profile:state.profile,experience:rows.experience.map(row=>({...period(row),points:row.body?row.body.split('\n'):[],tags:[],demos:[]})),
    education:rows.education.map(period),certs:rows.certificates.map(period),interests:rows.interests.map(row=>row.title).join('\n'),
    editor:{version:1,rows,data:Object.fromEntries(['fact','pictureCaption','linkLabel','linkURL','buttonLabel','buttonURL'].map(key=>[key,state[key]||''])),
      extraTypes:state.extraTypes,picture_id:state.extraTypes.includes('picture')&&state.picture?assetIDs.get(state.picture)||null:null,pictureAnchor:state.pictureAnchor,documents:state.documents}};
}
const dataURL=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read this file.'));reader.readAsDataURL(file);});
export async function createLiveAdapter() {
  const params=new URLSearchParams(location.search),token=location.hash.match(/^#invite=([A-Za-z0-9_-]{43})$/)?.[1],
    id=params.get('id'), guest=!!token;
  const request=(action,data={},options={})=>guest?window.marmullakuRequest(action,{profile_id:id,...data},{...options,token}):window.siblingSession.request(action,data,options);
  const result=await request(guest?'read':'read-profile',{profile_id:id||undefined});
  let profile=result.profile,revision=profile.updated_at;
  const editable=!guest&&result.editable,assetIDs=new Map(),uploads=new Map();
  const state=fromProfile(profile);
  const getFile=id=>request('asset',{id},{binary:true});
  async function hydrate(id) {const value=await dataURL(await getFile(id));assetIDs.set(value,id);return value;}
  if (profile.cv.editor) {
    for (const [field,rows] of Object.entries(profile.cv.editor.rows)) {
      for (const [index,row] of rows.entries()) if(row.logo_id) state.cvRows[field][index].logo=await hydrate(row.logo_id);
    }
    if (profile.cv.editor.picture_id) state.picture=await hydrate(profile.cv.editor.picture_id);
  }
  async function upload(file) {const value=await dataURL(file);return request('upload',{name:file.name,mime:file.type,base64:value.split(',')[1]});}
  async function imageID(value) {
    if (!value||assetIDs.has(value)) return;
    if (!uploads.has(value)) uploads.set(value,(async()=>{
      const blob=await (await fetch(value)).blob();const result=await upload(new File([blob],'Picture.'+blob.type.split('/')[1],{type:blob.type}));assetIDs.set(value,result.id);
    })().catch(error=>{uploads.delete(value);throw error;}));
    await uploads.get(value);
  }
  let pending, timer, running=false, failure,blocked=false;
  const status=message=>{for(const id of ['save-status','resume-status']){const el=document.getElementById(id);if(el)el.textContent=message;}};
  async function drain() {
    if (running||blocked) return;
    running=true;failure=null;
    try {
      while(pending) {
        const snapshot=pending;pending=null;
        try {
          await Promise.all([snapshot.picture,...Object.values(snapshot.cvRows).flat().map(row=>row.logo)].filter(Boolean).map(imageID));
          const saved=await request('save',{role:snapshot.role,cv:toCV(snapshot,assetIDs),updated_at:revision});
          revision=saved.profile.updated_at;profile=saved.profile;
          parent.postMessage({type:'marmullaku-saved',id:profile.id,role:profile.role},location.origin);
          status(pending?'Saving…':'Saved');
        } catch(error) {pending ||= snapshot;failure=error;blocked=error.status===409;throw error;}
      }
    } catch(error){status(error.message+' Your edits remain open.');}
    finally{running=false;}
  }
  async function flush() {
    clearTimeout(timer);
    while(running) await new Promise(resolve=>setTimeout(resolve,50));
    await drain();if(failure||blocked)throw failure||new Error('Reload before editing again.');
  }
  return {state,profile,editable,guest,request,
    save(value){if(!editable)return;pending=structuredClone(value);status('Saving…');clearTimeout(timer);timer=setTimeout(drain,700);},flush,
    async putPDF(file){await validatePDF(file);return (await upload(new File([file],file.name,{type:'application/pdf'}))).id;},getPDF:getFile,
    async deletePDF(id){await request('remove-file',{id});},
    track(kind){if(guest&&['picture','link','button'].includes(kind))request('event',{kind}).catch(()=>{});},
    async close(){await flush();parent.postMessage({type:'marmullaku-close'},location.origin);},
    get dirty(){return !!pending||running;}
  };
}
