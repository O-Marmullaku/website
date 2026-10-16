import test from 'node:test';
import assert from 'node:assert/strict';
import {setupExtrasRail} from '../main/cv-extras-rail.mjs';
function fixture({owner=false,content=false,narrow=true}={}){
 const old={document:globalThis.document,matchMedia:globalThis.matchMedia,MutationObserver:globalThis.MutationObserver,requestAnimationFrame:globalThis.requestAnimationFrame};
 const made=[];let observer;
 const element=()=>({attributes:{},events:{},hidden:false,setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},addEventListener(k,fn){this.events[k]=fn;},focus(){this.focused=true;}});
 const heading={append(){}},toolbar={querySelector(){return {};},insertBefore(){}};
 const rail={...element(),classList:{toggle(k,v){rail.empty=v;}},querySelector(sel){return sel==='.extras-heading'?heading:content?{}:null;},matches(){return !!this.open;},hidePopover(){this.open=false;this.events.toggle?.({newState:'closed'});},togglePopover(){this.open=!this.open;this.events.toggle?.({newState:this.open?'open':'closed'});}};
 const media={matches:narrow,addEventListener(type,fn){this.change=fn;}};
 globalThis.document={getElementById:()=>rail,querySelector:()=>toolbar,createElement:()=>{const el=element();made.push(el);return el;}};
 globalThis.matchMedia=()=>media;globalThis.MutationObserver=class{constructor(fn){observer=fn;}observe(){}};globalThis.requestAnimationFrame=fn=>fn();
 setupExtrasRail({editable:()=>owner,onLayout(){}});
 return {rail,media,button:made[0],close:made[1],setContent(v){content=v;observer();},restore(){Object.assign(globalThis,old);}};
}
test('readers see the drawer only when supporting content exists; removing it closes the drawer',()=>{
 const f=fixture();try{assert.equal(f.button.hidden,true);f.setContent(true);assert.equal(f.button.hidden,false);f.button.events.click();assert.equal(f.button.attributes['aria-expanded'],'true');f.setContent(false);assert.equal(f.rail.open,false);assert.equal(f.button.hidden,true);}finally{f.restore();}
});
test('owners can add content to an empty drawer; wide layouts return content to the margin',()=>{
 const f=fixture({owner:true});try{assert.equal(f.button.hidden,false);f.button.events.click();f.close.events.click();assert.equal(f.rail.open,false);assert.equal(f.button.focused,true);f.media.matches=false;f.media.change();assert.equal(f.button.hidden,true);assert.equal(f.rail.attributes.popover,undefined);}finally{f.restore();}
});
