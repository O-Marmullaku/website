import test from 'node:test';
import assert from 'node:assert/strict';
import {cardProjection,createProfileMotion} from '../main/profile-motion.mjs';
function fixture(){
 const records=[];
 const element=(name,rect)=>({name,isConnected:true,style:{},dataset:{},classList:{add(){},remove(){}},getBoundingClientRect:()=>rect,animate(frames,options){let resolve,reject;const animation={frames,options,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),finish(){resolve();},cancel(){this.cancelled=true;reject(new Error('cancelled'));}};animation.finished.catch(()=>{});records.push({name,animation});return animation;}});
 const paper=element('paper',{left:243,top:48,width:794,height:1123}),rail=element('rail',{}),settings=element('settings',{}),card=element('card',{left:100,top:300,width:240,height:420}),panel=element('panel',{});
 const frame={...element('frame',{}),clientHeight:900,contentDocument:{querySelector:sel=>sel==='.paper'?paper:sel==='#extras-rail'?rail:settings},contentWindow:{getComputedStyle:()=>({opacity:'1',transform:'none',clipPath:'none'})}};
 return {panel,frame,records,origin:{closest:()=>card},motion:createProfileMotion(panel),finish(){records.forEach(({animation})=>animation.finish());}};
}
test('card projection preserves the clicked card’s center and top edge',()=>{
 const from=cardProjection({left:100,top:300,width:240,height:420},{left:243,top:48,width:794,height:1123});
 assert.equal(from.transform,'translate(-420px, 252px) scale(0.3022670025188917)');assert.match(from.clipPath,/inset\(0px 0px 0px 0px/);
});
test('CV entrance and exit animate the paper and card; cleanup restores the card',async()=>{
 const f=fixture();const entering=f.motion.enter(f.frame,f.origin,'cv');assert.equal(f.panel.dataset.motion,'entering');assert.equal(f.records.find(x=>x.name==='paper').animation.options.duration,650);f.finish();await entering;assert.equal(f.panel.dataset.motion,'open');
 const exiting=f.motion.exit(f.frame);assert.equal(f.panel.dataset.motion,'closing');f.finish();await exiting;f.motion.reset();assert.equal(f.panel.dataset.motion,undefined);assert(f.records.filter(x=>x.name==='card').every(x=>x.animation.cancelled));
});
test('closing during entrance cannot set the window back to open',async()=>{
 const f=fixture();const entering=f.motion.enter(f.frame,f.origin,'cv');const exiting=f.motion.exit(f.frame);await entering;assert.equal(f.panel.dataset.motion,'closing');f.finish();await exiting;f.motion.reset();
});
test('sidebar follows the paper entrance and fades out before the paper closes',async()=>{
 const f=fixture();const entering=f.motion.enter(f.frame,f.origin,'cv');
 const arrival=f.records.find(x=>x.name==='rail').animation;
 assert.equal(arrival.frames[0].opacity,0);assert.equal(arrival.options.fill,'backwards');assert.equal(arrival.options.delay,220);
 f.finish();await entering;const exiting=f.motion.exit(f.frame);
 const departure=f.records.filter(x=>x.name==='rail').at(-1).animation;
 assert.equal(departure.frames.at(-1).opacity,0);assert(departure.options.duration<420);
 f.finish();await exiting;f.motion.reset();
 assert(f.records.filter(x=>x.name==='rail').every(x=>x.animation.cancelled));
});
test('settings use a shorter window transition and never fade a CV card',async()=>{
 const f=fixture();const entering=f.motion.enter(f.frame,undefined,'settings');f.finish();await entering;assert.equal(f.records.some(x=>x.name==='card'),false);assert.equal(f.records.find(x=>x.name==='settings').animation.options.duration,280);
 const exiting=f.motion.exit(f.frame);f.finish();await exiting;assert.equal(f.records.at(-1).animation.options.duration,200);f.motion.reset();
});
