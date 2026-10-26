import test from 'node:test';
import assert from 'node:assert/strict';
import {cardProjection,createProfileMotion,scrollAttachmentIntoView} from '../main/profile-motion.mjs';
function fixture(){
 const records=[];
 const element=(name,rect)=>({name,isConnected:true,style:{},dataset:{},classList:{add(){},remove(){}},getBoundingClientRect:()=>rect,animate(frames,options){let resolve,reject;const animation={frames,options,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),finish(){resolve();},cancel(){this.cancelled=true;reject(new Error('cancelled'));}};animation.finished.catch(()=>{});records.push({name,animation});return animation;}});
 const paper=element('paper',{left:243,top:48,width:794,height:1123}),rail=element('rail',{}),settings=element('settings',{}),card=element('card',{left:100,top:300,width:240,height:420}),panel=element('panel',{});
 const frame={...element('frame',{}),clientHeight:900,contentDocument:{querySelector:sel=>sel==='.cv-paper-stack, .paper'?paper:sel==='#extras-rail'?rail:settings},contentWindow:{getComputedStyle:()=>({opacity:'1',transform:'none',clipPath:'none'})}};
 frame.ownerDocument={defaultView:{getComputedStyle:()=>({opacity:'1'})}};
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
test('settings use a shorter window transition and never fade a CV card',async()=>{
 const f=fixture();const entering=f.motion.enter(f.frame,undefined,'settings');f.finish();await entering;assert.equal(f.records.some(x=>x.name==='card'),false);assert.equal(f.records.find(x=>x.name==='settings').animation.options.duration,280);
 const exiting=f.motion.exit(f.frame);f.finish();await exiting;assert.equal(f.records.at(-1).animation.options.duration,200);f.motion.reset();
});

test('failed frames fade out without access to their inaccessible window',async()=>{
 const f=fixture();f.frame.contentDocument=null;
 f.frame.contentWindow=new Proxy({}, {get(){throw new Error('Blocked failed frame');}});
 const exiting=f.motion.exit(f.frame);f.finish();await exiting;
 assert.equal(f.records.at(-1).name,'frame');
});

test('attachment scrolling animates to the reading position without OS motion preferences',t=>{
 const previous={requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame},frames=new Map();let id=0;
 t.after(()=>Object.assign(globalThis,previous));
 globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};globalThis.cancelAnimationFrame=key=>frames.delete(key);
 const container={scrollTop:200,scrollHeight:2000,clientHeight:400,getBoundingClientRect:()=>({top:20})};
 scrollAttachmentIntoView({closest:()=>container,getBoundingClientRect:()=>({top:500,height:40})});
 const advance=time=>{const [key,fn]=frames.entries().next().value;frames.delete(key);fn(time);};
 advance(100);assert.equal(container.scrollTop,200);advance(250);assert(container.scrollTop>200&&container.scrollTop<500);advance(400);assert.equal(container.scrollTop,500);assert.equal(frames.size,0);
});
