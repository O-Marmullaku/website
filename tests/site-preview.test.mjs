import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPreviewAPI} from '../mockup/preview-api.mjs';
const cv={contact:[],skills:[],languages:[],profile:'Sample CV',experience:[],education:[],certs:[],interests:''};
function fixture() {
  let state={profiles:[{id:'osman',display_name:'Osman Marmullaku',role:'Sample title',cv,updated_at:'original'},{id:'diellza',display_name:'Diellza Marmullaku',role:'',cv,updated_at:'original'}],family:[],links:[],events:[],assets:[]};
  const files=new Map();
  const api=createPreviewAPI({load:()=>structuredClone(state),save:value=>state=structuredClone(value),putAsset:async blob=>{const id=crypto.randomUUID();files.set(id,blob);return id;},getAsset:async id=>files.get(id),removeAsset:async id=>files.delete(id)});
  return {request:api.request,get state(){return state;}};
}
test('full-site preview saves local drafts and rejects stale versions',async()=>{
  const f=fixture();await f.request('save',{role:'New title',cv:{...cv,profile:'Edited sample'},updated_at:'original'});
  assert.equal((await f.request('profile')).profile.cv.profile,'Edited sample');
  assert.equal((await f.request('directory')).profiles[0].role,'New title');
  await assert.rejects(f.request('save',{role:'Stale',cv,updated_at:'original'}),error=>error.status===409);
});
test('preview links have isolated activity and follow local family grants and revocation',async()=>{
  const f=fixture(),created=await f.request('create',{company:'Sample company'}),guest={token:created.token};
  assert.equal((await f.request('welcome',{},guest)).company,'Sample company');
  await f.request('read',{},guest);
  assert.equal((await f.request('links')).events.length,2);
  await assert.rejects(f.request('read',{profile_id:'diellza'},guest),error=>error.status===404);
  f.state.family.push({owner_id:'diellza',recipient_id:'osman',enabled:true});
  assert.equal((await f.request('read',{profile_id:'diellza'},guest)).profile.id,'diellza');
  await f.request('toggle-link',{id:created.link.id,revoked:true});
  await assert.rejects(f.request('read',{},guest),error=>error.status===404);
});
test('mockup starts from the actual homepage without loading production account services',()=>{
  const html=readFileSync(new URL('../mockup/index.html',import.meta.url),'utf8');
  assert.equal((html.match(/class="card t\d/g)||[]).length,6);
  assert(html.includes('id="prev-left"'));assert(html.includes('preview-session.mjs'));
  for(const path of ['main/backend-config.js','main/access-api.js','admin/session.js','main/sign-in.js'])assert(!html.includes('src="'+path));
  const loader=readFileSync(new URL('../main/profile-loader.mjs',import.meta.url),'utf8');
  assert(!loader.includes('../mockup/index.html'));assert(!loader.includes('../mockup/profile.js'));
});
