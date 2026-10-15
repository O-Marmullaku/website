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
