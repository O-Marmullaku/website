import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPreviewAPI} from '../mockup/preview-api.mjs';
import {mockupHomepage} from '../mockup/sync-homepage.mjs';
import {profilesToSeed} from '../mockup/profile-seed.mjs';
const cv={contact:[],skills:[],languages:[],profile:'Sample CV',experience:[],education:[],certs:[],interests:''};
test('current CV content fills empty profiles without replacing existing edits',()=>{
  const entries=['osman','drilona'].map(id=>({profile:{id,cv:{profile:'Imported CV'}},files:[]}));
  assert.equal(profilesToSeed([{id:'osman',cv:{profile:'',experience:[],education:[]}}],entries).length,2);
  assert.equal(profilesToSeed([{id:'osman',cv:{profile:''}}],entries,['osman']).length,1);
  assert.deepEqual(profilesToSeed([{id:'osman',cv:{profile:'My edited CV'}},{id:'drilona',cv:{profile:'',editor:{rows:{experience:[{title:'My role'}]}}}}],entries),[]);
});
test('old starter text and sample rows do not block the imported CVs',()=>{
  const cv={profile:'Write a short introduction.',experience:[{title:'Your latest role'}],education:[{title:'Qualification or programme'}],editor:{rows:{contact:[{title:'Email address'}],experience:[{title:'Your latest role'}],education:[{title:'Qualification or programme'}]}}};
  const current=[{id:'osman',role:'Job title',cv},{id:'drilona',cv}];
  const entries=current.map(({id})=>({profile:{id,cv:{profile:'Imported CV'}},files:[]}));
  assert.equal(profilesToSeed(current,entries).length,2);
  assert.equal(profilesToSeed(current,entries,['osman','drilona']).length,2);
});
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
  assert(html.includes('id="prev-left"'));
  assert.equal(html,mockupHomepage(readFileSync(new URL('../index.html',import.meta.url),'utf8')));
  assert(html.includes('mockup/site-services.js'));
  const services=readFileSync(new URL('../mockup/site-services.js',import.meta.url),'utf8');
  assert(services.includes('preview-session.mjs'));
  for(const path of ['backend-config.js','access-api.js','admin/session.js'])assert(!services.includes(path));
  for(const path of ['main/backend-config.js','main/access-api.js','admin/session.js','main/sign-in.js'])assert(!html.includes('src="'+path));
  const loader=readFileSync(new URL('../main/profile-loader.mjs',import.meta.url),'utf8');
  assert(!loader.includes('../mockup/index.html'));assert(!loader.includes('../mockup/profile.js'));
  assert(loader.includes('parent.MARMULLAKU_MOCKUP'));
  assert(loader.includes("fetch('../profile/editor.html'"));
  assert(loader.includes("import('../profile/editor.js"));
});

test('active screens and error messages contain no test-environment labels',()=>{
  for(const path of ['profile/editor.html','profile/editor.js','main/profile-bridge.js','main/live-sharing.mjs','mockup/preview-api.mjs']) {
    const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
    assert(!/local preview|local data|preview only|this preview|in the mockup|in this browser|sample cv/i.test(source),path);
  }
});

test('preview section timing validates section identity and duration',async()=>{
  const f=fixture(),created=await f.request('create',{company:'Timing test'}),guest={token:created.token};
  const event={kind:'section',section:'experience',seconds:18};
  for(const invalid of [{section:'__proto__'},{seconds:-1},{seconds:1.5},{seconds:3601}]){
    await assert.rejects(f.request('event',{...event,...invalid},guest),error=>error.status===400);
  }
  assert.equal(f.state.events.length,0);
  await f.request('event',event,guest);
  const saved=(await f.request('links')).events[0];
  assert.equal(saved.label,'Experience in view');assert.equal(saved.seconds,18);
  assert.equal(saved.link_id,created.link.id);assert.equal(saved.profile_id,'osman');
});
