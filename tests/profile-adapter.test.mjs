import test from 'node:test';
import assert from 'node:assert/strict';
import {fromProfile,toCV,createLiveAdapter} from '../main/profile-adapter.mjs';

test('media loads in bounded parallel batches and repeated IDs reuse one authorized request',async t=>{
 const previous={location:globalThis.location,window:globalThis.window,FileReader:globalThis.FileReader},pending=[],calls=[];
 t.after(()=>Object.assign(globalThis,previous));
 const ids=Array.from({length:6},()=>crypto.randomUUID());
 const rows={experience:ids.map(id=>({id:crypto.randomUUID(),title:'Example',logo_id:id}))};
 rows.experience.push({id:crypto.randomUUID(),title:'Same logo',logo_id:ids[0]});
 const profile={id:'osman',display_name:'Test',role:'',cv:{profile:'',editor:{rows,data:{},picture_id:ids[0]}}};
 globalThis.location={search:'?id=osman',hash:''};
 globalThis.FileReader=class{readAsDataURL(file){this.result='data:image/png;base64,'+file.id;queueMicrotask(()=>this.onload());}};
 globalThis.window={siblingSession:{async request(action,data){if(action==='read-profile')return {profile,editable:true};assert.equal(action,'asset');calls.push(data.id);return new Promise(resolve=>pending.push(()=>resolve({id:data.id})));}}};
 const loading=createLiveAdapter();await new Promise(setImmediate);
 assert.equal(calls.length,4,'four independent requests start without waiting for each other');
 pending.splice(0).forEach(release=>release());await new Promise(setImmediate);
 assert.equal(calls.length,6);pending.splice(0).forEach(release=>release());
 const adapter=await loading;
 assert.equal(new Set(calls).size,6);
 assert.equal(adapter.state.cvRows.experience[6].logo,adapter.state.cvRows.experience[0].logo);
 assert.equal(adapter.state.picture,adapter.state.cvRows.experience[0].logo);
 const saved=toCV(adapter.state,new Map([[adapter.state.picture,ids[0]]]));
 assert.equal(saved.editor.rows.experience[0].logo_id,ids[0],'loaded media retains its saved identity');
});

test('unavailable images keep the CV readable and retain their references on the next save',async t=>{
 const previous={location:globalThis.location,window:globalThis.window,FileReader:globalThis.FileReader};t.after(()=>Object.assign(globalThis,previous));
 const missing=crypto.randomUUID(),good=crypto.randomUUID();
 const rows={experience:[{id:crypto.randomUUID(),title:'Missing image',logo_id:missing},{id:crypto.randomUUID(),title:'Good image',logo_id:good}]};
 globalThis.location={search:'?id=osman',hash:''};
 globalThis.FileReader=class{readAsDataURL(file){this.result='data:image/png;base64,'+file.id;queueMicrotask(()=>this.onload());}};
 globalThis.window={siblingSession:{async request(action,data){
  if(action==='read-profile')return {editable:true,profile:{id:'osman',display_name:'Test',role:'',cv:{profile:'My CV',editor:{rows,data:{},picture_id:missing,extraTypes:['picture']}}}};
  if(data.id===missing)throw Object.assign(new Error('File unavailable.'),{status:404});return {id:data.id};
 }}};
 const adapter=await createLiveAdapter();assert.equal(adapter.state.profile,'My CV');assert(adapter.mediaWarning);
 assert.equal(adapter.state.cvRows.experience[0].logo,'');assert(adapter.state.cvRows.experience[1].logo);
 const saved=toCV(adapter.state,new Map([[adapter.state.cvRows.experience[1].logo,good]]));
 assert.equal(saved.editor.rows.experience[0].logo_id,missing);assert.equal(saved.editor.picture_id,missing);
 adapter.state.cvRows.experience[0].logo_id=null;adapter.state.extraTypes=[];
 const removed=toCV(adapter.state,new Map());assert.equal(removed.editor.rows.experience[0].logo_id,null);assert.equal(removed.editor.picture_id,null);
});

test('adapter normalizes old local attachment shapes before the editor uses them',()=>{
 const id=crypto.randomUUID(),cv={profile:'',editor:{rows:{},data:{theme:null,fact:'Saved fact'},extraTypes:['picture','picture','invalid'],pictureAnchor:{field:'unknown'},documents:[{id:'bad',name:'Invalid'},{id,name:'Name',anchor:{field:'profile',quote:'x',before:'a'.repeat(40)}}]}};
 const state=fromProfile({display_name:'Owner',role:'',cv});assert.equal(state.theme,'navy');assert.equal(state.fact,'Saved fact');assert.deepEqual(state.extraTypes,['picture']);assert.equal(state.pictureAnchor,null);assert.equal(state.documents.length,1);assert.equal(state.documents[0].anchor.before.length,32);
});
test('real CV conversion preserves contact links, ratings, dates and reference text',()=>{
  const cv={contact:[['Email','mailto:sample@example.invalid']],skills:[['Design',65]],languages:[['German','Native']],profile:'About',experience:[{when:'2024',title:'Role',org:'Company',points:['First','Second']}],education:[{when:'2023',title:'Degree',org:'School'}],certs:[{when:'2022',title:'Certificate',org:'Issuer'}],interests:'Music\nArt'};
  const state=fromProfile({id:'osman',display_name:'Owner',role:'Title',cv}),saved=toCV(state,new Map());
  for(const field of ['contact','skills','languages','profile','education','certs','interests'])assert.deepEqual(saved[field],cv[field]);
  assert.deepEqual(saved.experience[0].points,cv.experience[0].points);
  const reloaded=fromProfile({display_name:'Owner',role:'Title',cv:saved});
  assert.deepEqual(reloaded.cvRows,state.cvRows);
});
test('only private IDs are persisted for media; removing a photo removes its public capability',()=>{
  const state=fromProfile({display_name:'Owner',role:'',cv:{contact:[],skills:[],languages:[],profile:'',experience:[],education:[],certs:[],interests:''}});
  state.picture='data:image/png;base64,PRIVATE';state.extraTypes=['picture'];
  const id=crypto.randomUUID(),ids=new Map([[state.picture,id]]),saved=toCV(state,ids);
  assert.equal(saved.editor.picture_id,id);assert(!JSON.stringify(saved).includes('base64'));
  state.extraTypes=[];assert.equal(toCV(state,ids).editor.picture_id,null);
});

test('color themes survive adapter and server validation without changing CV content',async()=>{
 const {validateEditor}=await import('../supabase/functions/marmullaku-access/editor.mjs');
 const state=fromProfile({display_name:'Owner',role:'Title',cv:{contact:[],skills:[],languages:[],profile:'Intro',experience:[],education:[],certs:[],interests:''}});
 assert.equal(state.theme,'navy');
 for(const theme of ['navy','blue-gray','charcoal','forest','burgundy']){
  state.theme=theme;const saved=toCV(state,new Map());saved.editor=validateEditor(saved.editor);
  assert.equal(fromProfile({display_name:'Owner',role:'Title',cv:saved}).theme,theme);assert.equal(saved.profile,'Intro');
 }
 const saved=toCV(state,new Map());saved.editor.data.theme='unknown';assert.throws(()=>validateEditor(saved.editor),/color theme/);
 delete saved.editor.data.theme;assert.equal(validateEditor(saved.editor).data.theme,'navy');
});

test('classic and compact typography survive saves and reject unknown styles',async()=>{
 const {validateEditor}=await import('../supabase/functions/marmullaku-access/editor.mjs');
 const state=fromProfile({display_name:'Owner',role:'Title',cv:{contact:[],skills:[],languages:[],profile:'',experience:[],education:[],certs:[],interests:''}});
 assert.equal(state.typography,'classic');
 for(const typography of ['classic','compact']){state.typography=typography;const saved=toCV(state,new Map());saved.editor=validateEditor(saved.editor);assert.equal(fromProfile({display_name:'Owner',role:'Title',cv:saved}).typography,typography);}
 const saved=toCV(state,new Map());saved.editor.data.typography='unknown';assert.throws(()=>validateEditor(saved.editor),/typography/);
});

test('entry styles survive saves and accept only plain or timeline',async()=>{
 const {validateEditor}=await import('../supabase/functions/marmullaku-access/editor.mjs');
 const state=fromProfile({display_name:'Owner',role:'Title',cv:{contact:[],skills:[],languages:[],profile:'',experience:[],education:[],certs:[],interests:''}});
 assert.equal(state.entryStyle,'plain');
 for(const entryStyle of ['plain','timeline']){state.entryStyle=entryStyle;const saved=toCV(state,new Map());saved.editor=validateEditor(saved.editor);assert.equal(fromProfile({display_name:'Owner',role:'Title',cv:saved}).entryStyle,entryStyle);}
 const saved=toCV(state,new Map());saved.editor.data.entryStyle='unknown';assert.throws(()=>validateEditor(saved.editor),/entry style/);
 delete saved.editor.data.entryStyle;assert.equal(validateEditor(saved.editor).data.entryStyle,'plain');
});
