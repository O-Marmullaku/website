import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootstrapLocal,isLocalPreview} from '../main/local-preview.mjs';

test('local editing rejects public and lookalike hostnames',async()=>{
  for(const host of ['localhost','127.0.0.1','[::1]'])assert.equal(isLocalPreview(host),true);
  for(const host of ['marmullaku.ch','localhost.example.com','example.com','192.168.1.1'])assert.equal(isLocalPreview(host),false);
  const old=globalThis.location;globalThis.location={hostname:'marmullaku.ch'};
  try{await assert.rejects(bootstrapLocal(),/only available on localhost/);}finally{globalThis.location=old;}
});
test('each local profile can edit its own isolated draft and retain it after reload',async()=>{
  const previous={location:globalThis.location,localStorage:globalThis.localStorage,window:globalThis.window,fetch:globalThis.fetch};
  globalThis.fetch=async()=>({ok:false});
  const saved=new Map();globalThis.location={hostname:'localhost'};globalThis.localStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};globalThis.window={};
  try {
    for(const id of ['osman','diellza','drilona','drenusha','dredhza','ali']){
      const api=await bootstrapLocal(id);const result=await api.request('read-profile');assert.equal(result.editable,true);assert.equal(result.profile.id,id);
      await api.request('save',{cv:result.profile.cv,role:'Local '+id,updated_at:result.profile.updated_at});
    }
    for(const id of ['osman','diellza','drilona','drenusha','dredhza','ali'])assert.equal((await (await bootstrapLocal(id)).request('profile')).profile.role,'Local '+id);
    assert.deepEqual([...saved.keys()],['marmullaku-local-profiles-v1']);
    assert.equal((await (await bootstrapLocal()).request('directory')).profiles.length,6);
  } finally {Object.assign(globalThis,previous);}
});

test('normal localhost imports empty CVs and preserves edited drafts',async()=>{
 const previous={location:globalThis.location,localStorage:globalThis.localStorage,window:globalThis.window,fetch:globalThis.fetch};
 const saved=new Map();Object.assign(globalThis,{location:{hostname:'localhost'},window:{},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},fetch:async()=>({ok:true,json:async()=>[{profile:{id:'osman',display_name:'Osman Marmullaku',role:'Developer',cv:{profile:'Imported biography',contact:[],skills:[],languages:[],certs:[],interests:'',education:[],experience:[]}},files:[]}]})});
 try{
  const api=await bootstrapLocal();let profile=(await api.request('read-profile')).profile;
  assert.equal(profile.cv.profile,'Imported biography');
  await api.request('save',{cv:{...profile.cv,profile:'My edited biography'},role:'My role',updated_at:profile.updated_at});
  profile=(await (await bootstrapLocal()).request('read-profile')).profile;
  assert.equal(profile.cv.profile,'My edited biography');assert.equal(profile.role,'My role');
 }finally{Object.assign(globalThis,previous);}
});

test('public pages and invitation links load account services rather than local editing',async()=>{
  for(const location of [{hostname:'marmullaku.ch',hash:''},{hostname:'localhost',hash:'#invite=example'}]){
    const loaded=[],window={};
    const document={readyState:'loading',createElement:()=>({}),head:{append(el){loaded.push(el.src);if(el.src.includes('access-api.js'))window.marmullakuRequest=async()=>({production:true});queueMicrotask(()=>el.onload());}}};
    vm.runInNewContext(readFileSync(new URL('../main/site-services.js',import.meta.url),'utf8'),{window,document,location,Promise,URLSearchParams});
    const result=await window.marmullakuRequest('directory');assert.equal(result.production,true);
    assert(loaded.some(path=>path.includes('backend-config')));assert(loaded.some(path=>path.includes('admin/session')));assert.equal(window.MARMULLAKU_LOCAL_PREVIEW,undefined);
  }
});
