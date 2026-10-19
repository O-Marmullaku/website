import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCopyUpdates} from '../mockup/profile-seed.mjs';
test('copy corrections update matching text while preserving edits, media and dates',()=>{
 const profile={cv:{experience:[{title:'Old title',points:['Original text']}],editor:{rows:{experience:[{title:'My edited title',body:'Original body',logo_id:'existing-image',date:'2024'}]}}}};
 const updates=[
  {path:['cv','experience',0,'title'],before:'Old title',after:'Concise title'},
  {path:['cv','experience',0,'points'],before:['Original text'],after:['Concise text']},
  {path:['cv','editor','rows','experience',0,'title'],before:'Old title',after:'Concise title'},
  {path:['cv','editor','rows','experience',0,'body'],before:'Original body',after:'Concise body'},
 ];
 assert.equal(applyCopyUpdates(profile,updates),true);
 assert.equal(profile.cv.editor.rows.experience[0].title,'My edited title');
 assert.equal(profile.cv.editor.rows.experience[0].logo_id,'existing-image');
 assert.equal(profile.cv.editor.rows.experience[0].date,'2024');
 assert.deepEqual(profile.cv.experience[0].points,['Concise text']);
 assert.equal(applyCopyUpdates(profile,updates),false);
});
test('copy corrections cannot write outside CV content or through prototype paths',()=>{
 const profile={display_name:'Original',cv:{}};
 assert.equal(applyCopyUpdates(profile,[{path:['display_name'],before:'Original',after:'Other'},{path:['cv','__proto__','polluted'],after:true}]),false);
 assert.equal(profile.display_name,'Original');assert.equal({}.polluted,undefined);
});
test('missing logos can be supplied without replacing a logo the owner uploaded',()=>{
 const empty={cv:{editor:{rows:{experience:[{logo_id:null}]}}}},custom=structuredClone(empty);
 custom.cv.editor.rows.experience[0].logo_id='owner-upload';
 const updates=[{path:['cv','editor','rows','experience',0,'logo_id'],before:null,after:'imported-artwork'}];
 assert.equal(applyCopyUpdates(empty,updates),true);
 assert.equal(empty.cv.editor.rows.experience[0].logo_id,'imported-artwork');
 assert.equal(applyCopyUpdates(custom,updates),false);
 assert.equal(custom.cv.editor.rows.experience[0].logo_id,'owner-upload');
});
