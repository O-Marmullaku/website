import {validateCV} from '../supabase/functions/marmullaku-access/handler.mjs';
import {decodeUpload,editorAssets} from '../supabase/functions/marmullaku-access/editor.mjs';

// Same request contract as the site, backed only by browser-owned sample data.
export function createPreviewAPI({load,save,putAsset,getAsset,removeAsset}) {
  const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
  const token=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  return {async request(action,body={},options={}) {
    const state=load(),own=state.profiles.find(profile=>profile.id==='osman');
    const available=sender=>[sender,...state.family.filter(grant=>grant.recipient_id===sender&&grant.enabled).map(grant=>grant.owner_id)];
    const publicProfile=profile=>({id:profile.id,display_name:profile.display_name,role:profile.role});
    let link,allowed=available(own.id);
    const record=(profile_id,kind,label)=>{const current=load();current.events.unshift({link_id:link.id,profile_id,kind,label,created_at:new Date().toISOString()});current.events=current.events.slice(0,1000);save(current);};
    if(options.token||['welcome','read','event'].includes(action)) {
      link=state.links.find(link=>link.token===options.token&&!link.revoked);
      if(!link)fail('This preview link is unavailable.',404);
      allowed=available(link.profile_id);
    }
    if(action==='directory')return {profiles:state.profiles.map(publicProfile)};
    if(action==='profile')return {profile:structuredClone(own)};
    if(['welcome','read','read-profile','event'].includes(action)) {
      const target=body.profile_id||link?.profile_id||own.id;
      if(!allowed.includes(target))fail('This CV has not been shared with you.',link?404:403);
      const profile=state.profiles.find(profile=>profile.id===target);
      if(action==='welcome'){record(target,'visit','Opened link');return {profile:publicProfile(profile),profiles:state.profiles.filter(profile=>allowed.includes(profile.id)).map(publicProfile),company:link.company,message:link.message};}
      if(action==='event'){
        if(!['picture','link','button'].includes(body.kind))fail('Invalid activity.');
        const data=profile.cv.editor?.data||{};record(target,body.kind,body.kind==='picture'?'Viewed photo: '+(data.pictureCaption||''):('Opened '+(data[body.kind+'Label']||body.kind)));return {recorded:true};
      }
      if(link)record(target,'cv',`Opened ${profile.display_name}’s CV`);
      return {profile:structuredClone(profile),editable:!link&&target===own.id};
    }
    if(action==='asset') {
      const file=state.assets.find(file=>file.id===body.id);
      if(!file||!allowed.includes(file.profile_id))fail('File unavailable.',404);
      const profile=state.profiles.find(profile=>profile.id===file.profile_id);
      if((link||file.profile_id!==own.id)&&(!profile.cv.editor||!editorAssets(profile.cv.editor).includes(file.id)))fail('File unavailable.',404);
      const blob=await getAsset(file.id);if(!blob)fail('This file is unavailable in this browser. Add it again.',404);
      if(link&&file.mime==='application/pdf')record(file.profile_id,'document','Opened PDF: '+file.name);
      return blob;
    }
    if(link)fail('Please sign in.',401);
    if(action==='save') {
      if(body.updated_at&&body.updated_at!==own.updated_at)fail('This CV changed in another tab. Reload it before editing again.',409);
      const cv=validateCV(body.cv);
      if(typeof body.role!=='string'||body.role.length>160)fail('Use a title up to 160 characters.');
      if(cv.editor&&editorAssets(cv.editor).some(id=>!state.assets.some(file=>file.id===id&&file.profile_id===own.id)))fail('A file is unavailable.');
      own.cv=cv;own.role=body.role;own.updated_at=new Date().toISOString();save(state);return {profile:structuredClone(own)};
    }
    if(action==='upload') {
      const file=decodeUpload(body),id=await putAsset(new Blob([file.bytes],{type:file.mime}));
      const current=load();current.assets.push({id,profile_id:own.id,name:file.name,mime:file.mime});save(current);return {id,name:file.name};
    }
    if(action==='remove-file') {
      const file=state.assets.find(file=>file.id===body.id&&file.profile_id===own.id);if(!file)fail('File unavailable.',404);
      if(own.cv.editor&&editorAssets(own.cv.editor).includes(file.id))fail('Remove the file from the CV first.');
      state.assets=state.assets.filter(file=>file.id!==body.id);save(state);await removeAsset(body.id);return {removed:true};
    }
    if(action==='family')return {family:state.family.filter(grant=>grant.owner_id===own.id),profiles:state.profiles.map(publicProfile),available:allowed};
    if(action==='share-family') {
      if(body.recipient_id===own.id||!state.profiles.some(profile=>profile.id===body.recipient_id)||typeof body.enabled!=='boolean')fail('Invalid family permission.');
      state.family=state.family.filter(grant=>grant.owner_id!==own.id||grant.recipient_id!==body.recipient_id);
      state.family.push({owner_id:own.id,recipient_id:body.recipient_id,enabled:body.enabled});save(state);return {saved:true};
    }
    if(action==='links')return {links:state.links.map(({token,...link})=>link),events:[...state.events].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))};
    if(action==='create') {
      const company=String(body.company||'').trim();if(!company||company.length>120)fail('Enter a company name.');
      const link={id:crypto.randomUUID(),profile_id:own.id,company,message:'',created_at:new Date().toISOString(),expires_at:null,revoked:false,token:token()};
      state.links.unshift(link);save(state);const {token:value,...metadata}=link;return {token:value,link:metadata};
    }
    if(['copy-link','toggle-link'].includes(action)) {
      const found=state.links.find(link=>link.id===body.id&&link.profile_id===own.id);if(!found)fail('Link unavailable.',404);
      if(action==='copy-link'){if(found.revoked)fail('Link is off.',404);return {token:found.token};}
      if(typeof body.revoked!=='boolean')fail('Invalid link.');found.revoked=body.revoked;save(state);return {saved:true};
    }
    fail('This action is unavailable in the mockup.');
  }};
}
