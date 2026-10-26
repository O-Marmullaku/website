import { normalizeRows, rowLayouts } from '../profile/cv-rows.mjs?v=revamp-20261026';
import { validatePDF } from '../profile/pdf-store.mjs?v=revamp-20261026';

// The editor's media are in-memory previews; only private asset IDs are saved.
const text=value=>typeof value==='string'?value:'';
const assetID=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value)?value:null;
function attachmentAnchor(value){
  if(!value||!['profile',...Object.keys(rowLayouts)].includes(value.field))return null;
  return {field:value.field,rowId:assetID(value.rowId),quote:text(value.quote).slice(0,5000),before:text(value.before).slice(-32),after:text(value.after).slice(0,32)};
}
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
  const state={name:text(profile.display_name),role:text(profile.role),profile:text(cv.profile),
    theme:'navy',typography:'classic',entryStyle:'plain',fact:'',linkLabel:'',linkURL:'',buttonLabel:'',buttonURL:'',pictureCaption:'',picture:'',
  };
  for(const key of Object.keys(state))if(typeof editor?.data?.[key]==='string')state[key]=editor.data[key];
  return {...state,cvRows:normalizeRows(rows,{}),extraTypes:Array.isArray(editor?.extraTypes)?[...new Set(editor.extraTypes)].filter(type=>['picture','fact','link','button'].includes(type)):[],
    picture_id:assetID(editor?.picture_id),pictureAnchor:attachmentAnchor(editor?.pictureAnchor),
    documents:Array.isArray(editor?.documents)?editor.documents.filter(doc=>assetID(doc?.id)&&typeof doc.name==='string').map(doc=>({id:doc.id,name:doc.name.slice(0,180),anchor:attachmentAnchor(doc.anchor)})):[]};
}
export function toCV(state, assetIDs) {
  const rows=Object.fromEntries(Object.entries(state.cvRows).map(([key,values])=>[key,values.map(row=>{
    const {logo,logo_id,...rest}=row;return {...rest,logo_id:logo?assetIDs.get(logo)||null:logo_id||null};
  })]));
  const period=row=>({when:row.date,title:row.title,org:row.detail});
  return {contact:rows.contact.map(row=>[row.title,row.href||'']),skills:rows.skills.map(row=>[row.title,row.score||0]),
    languages:rows.languages.map(row=>[row.title,row.detail||['','Beginner','Elementary','Intermediate','Advanced','Fluent / native'][row.level]]),
    profile:state.profile,experience:rows.experience.map(row=>({...period(row),points:row.body?row.body.split('\n'):[],tags:[],demos:[]})),
    education:rows.education.map(period),certs:rows.certificates.map(period),interests:rows.interests.map(row=>row.title).join('\n'),
    editor:{version:1,rows,data:Object.fromEntries(['theme','typography','entryStyle','fact','pictureCaption','linkLabel','linkURL','buttonLabel','buttonURL'].map(key=>[key,state[key]||''])),
      extraTypes:state.extraTypes,picture_id:state.extraTypes.includes('picture')?(state.picture?assetIDs.get(state.picture)||null:state.picture_id||null):null,pictureAnchor:state.pictureAnchor,documents:state.documents}};
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
  let missingMedia=false;
  async function hydrate(id) {
    try{const value=await dataURL(await getFile(id));assetIDs.set(value,id);return value;}
    catch{missingMedia=true;return '';}
  }
  if (profile.cv.editor) {
    const ids=[...new Set([...Object.values(state.cvRows).flat().map(row=>row.logo_id),state.picture_id].filter(Boolean))],images=new Map();
    for(let i=0;i<ids.length;i+=4)await Promise.all(ids.slice(i,i+4).map(async id=>images.set(id,await hydrate(id))));
    for(const rows of Object.values(state.cvRows))for(const row of rows)if(row.logo_id)row.logo=images.get(row.logo_id)||'';
    if (profile.cv.editor.picture_id) state.picture=images.get(profile.cv.editor.picture_id);
  }
  async function upload(file) {const value=await dataURL(file);return request('upload',{name:file.name,mime:file.type,base64:value.split(',')[1]});}
  async function imageID(value) {
    if (!value||assetIDs.has(value)) return;
    if (!uploads.has(value)) uploads.set(value,(async()=>{
      const blob=await (await fetch(value)).blob();const result=await upload(new File([blob],'Picture.'+blob.type.split('/')[1],{type:blob.type}));assetIDs.set(value,result.id);
    })().catch(error=>{uploads.delete(value);throw error;}));
    await uploads.get(value);
  }
  let pending, timer, running=false, failure,blocked=false,discarded=false;
  let statusTimer;
  const status=message=>{clearTimeout(statusTimer);for(const id of ['save-status','resume-status']){const el=document.getElementById(id);if(el&&el.textContent!==message)el.textContent=message;}if(message==='Saved')statusTimer=setTimeout(()=>{for(const id of ['save-status','resume-status']){const el=document.getElementById(id);if(el?.textContent==='Saved')el.textContent='';}},2400);};
  async function drain() {
    if (running||blocked) return;
    running=true;failure=null;
    try {
      while(pending) {
        const snapshot=structuredClone(pending);pending=null;
        try {
          await Promise.all([snapshot.picture,...Object.values(snapshot.cvRows).flat().map(row=>row.logo)].filter(Boolean).map(imageID));
          const saved=await request('save',{role:snapshot.role,cv:toCV(snapshot,assetIDs),updated_at:revision});
          revision=saved.profile.updated_at;profile=saved.profile;
          parent.postMessage({type:'marmullaku-saved',id:profile.id,role:profile.role},location.origin);
          status(pending?'Saving…':'Saved');
        } catch(error) {pending ||= snapshot;failure=error;blocked=error.status===409;throw error;}
      }
    } catch(error){status(error.message+' Your edits remain open.');if(error.status===401)parent.postMessage({type:'marmullaku-sign-in-required',profile_id:profile.id},location.origin);}
    finally{running=false;}
  }
  async function flush() {
    clearTimeout(timer);
    while(running) await new Promise(resolve=>setTimeout(resolve,50));
    await drain();if(failure||blocked)throw failure||new Error('Reload before editing again.');
  }
  async function settle() {
    if(discarded)return true;
    try {await flush();return true;}
    catch(error){
      if(error.status===401)throw error;
      if(!blocked&&!(error.status>=400&&error.status<500))throw error;
      if(!confirm(blocked?'Your CV changed in another tab. Leave without saving your edits?':'Your changes could not be saved. Leave without saving your edits?'))return false;
      clearTimeout(timer);pending=null;discarded=true;return true;
    }
  }
  return {state,profile,editable,guest,request,mediaWarning:missingMedia?'Some pictures could not load. Reopen the CV to try again.':'',
    save(value){if(!editable)return;pending=value;discarded=false;clearTimeout(timer);if(blocked){status(failure.message+' Your edits remain open.');return;}status('Saving…');timer=setTimeout(drain,700);},flush,settle,
    async putPDF(file){await validatePDF(file);return (await upload(new File([file],file.name,{type:'application/pdf'}))).id;},getPDF:getFile,
    async deletePDF(id){await request('remove-file',{id});},
    track(kind){if(guest&&['picture','link','button'].includes(kind))request('event',{kind}).catch(()=>{});},
    get dirty(){return !!pending||running;}
  };
}
