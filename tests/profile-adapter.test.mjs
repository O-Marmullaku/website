import test from 'node:test';
import assert from 'node:assert/strict';
import {fromProfile,toCV} from '../main/profile-adapter.mjs';
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
