import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveAdapter} from '../main/profile-adapter.mjs';

async function fixture(t,save){
  const previous=new Map(),timers=new Set(),originalSetTimeout=globalThis.setTimeout;
  const calls=[],messages=[],statuses=new Map(['save-status','resume-status'].map(id=>[id,{textContent:''}]));
  let profile={id:'osman',display_name:'Synthetic owner',role:'Original title',updated_at:'revision-0',cv:{contact:[],skills:[],languages:[],profile:'Synthetic CV',experience:[],education:[],certs:[],interests:''}};
  const globals={
    location:{search:'?id=osman',hash:'',origin:'http://localhost:8000'},
    document:{getElementById:id=>statuses.get(id)},
    parent:{postMessage:message=>messages.push(message)},
    confirm:()=>false,
    setTimeout:(...args)=>{const timer=originalSetTimeout(...args);timers.add(timer);return timer;},
    window:{siblingSession:{request:async(action,body)=>{
      if(action==='read-profile')return {profile,editable:true};
      assert.equal(action,'save');calls.push(body);
      await save?.(body,calls.length);
      profile={...profile,role:body.role,cv:body.cv,updated_at:'revision-'+calls.length};return {profile};
    }}},
  };
  for(const [key,value] of Object.entries(globals)){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
  t.after(()=>{for(const timer of timers)clearTimeout(timer);for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  const adapter=await createLiveAdapter();return {adapter,calls,messages,statuses};
}

test('saves are serialized and keep the latest edits while a request is pending',async t=>{
  let release,started;
  const firstSave=new Promise(resolve=>{started=resolve;});
  const gate=new Promise(resolve=>{release=resolve;});
  const {adapter,calls}=await fixture(t,async(body,index)=>{if(index===1){started();await gate;}});
  adapter.save({...adapter.state,role:'First title'});const flushed=adapter.flush();await firstSave;
  adapter.save({...adapter.state,role:'Intermediate title'});adapter.save({...adapter.state,role:'Latest title'});
  release();await flushed;
  assert.deepEqual(calls.map(call=>call.role),['First title','Latest title']);
  assert.deepEqual(calls.map(call=>call.updated_at),['revision-0','revision-1']);
  assert.equal(adapter.dirty,false);
});

test('temporary save failures retain the draft and can be retried',async t=>{
  const failure=Object.assign(new Error('Connection unavailable'),{status:503});
  const {adapter,calls}=await fixture(t,(body,index)=>{if(index===1)throw failure;});
  adapter.save({...adapter.state,role:'Unsaved title'});
  await assert.rejects(adapter.flush(),error=>error===failure);assert.equal(adapter.dirty,true);
  await adapter.flush();assert.equal(calls[1].role,'Unsaved title');assert.equal(adapter.dirty,false);
});

test('a conflict stays visible and only an explicit exit confirmation discards pending edits',async t=>{
  const {adapter,calls,statuses}=await fixture(t,()=>{throw Object.assign(new Error('This CV changed in another tab.'),{status:409});});
  adapter.save({...adapter.state,role:'Unsaved title'});
  await assert.rejects(adapter.flush(),error=>error.status===409);
  adapter.save({...adapter.state,role:'More unsaved edits'});
  assert.match(statuses.get('resume-status').textContent,/changed in another tab/);
  assert(!statuses.get('resume-status').textContent.includes('Saving'));
  assert.equal(await adapter.settle(),false);assert.equal(adapter.dirty,true);
  globalThis.confirm=message=>{assert.match(message,/without saving/);return true;};
  assert.equal(await adapter.settle(),true);assert.equal(adapter.dirty,false);
  assert.equal(await adapter.settle(),true);assert.equal(calls.length,1);
});
test('a rejected save can be explicitly discarded while server failures keep the draft open',async t=>{
  let status=401;
  const {adapter}=await fixture(t,()=>{throw Object.assign(new Error('Save rejected'),{status});});
  for(status of [400,401,413]){
    adapter.save({...adapter.state,role:'Unsaved title'});
    globalThis.confirm=()=>false;
    assert.equal(await adapter.settle(),false);assert.equal(adapter.dirty,true);
    globalThis.confirm=()=>true;
    assert.equal(await adapter.settle(),true);assert.equal(adapter.dirty,false);
  }
  status=503;adapter.save({...adapter.state,role:'Retry this draft'});
  globalThis.confirm=()=>{assert.fail('A server failure should be retried without discarding the draft');};
  await assert.rejects(adapter.settle(),error=>error.status===503);assert.equal(adapter.dirty,true);
});
