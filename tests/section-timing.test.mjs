import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectionClock} from '../mockup/section-timing.mjs';

test('section times overlap and stop when focus, consent or visibility is lost',()=>{
  let now=0;const records=[],clock=createSectionClock((section,seconds)=>records.push({section,seconds}),()=>now);
  clock.update(['profile','skills']);now=5000;clock.update(['skills']);
  now=8000;clock.update([]);now=50000;clock.update([]);
  assert.deepEqual(records,[{section:'profile',seconds:5},{section:'skills',seconds:8}]);
  clock.update(['experience']);now=53000;clock.update(['experience']);clock.flush();
  now=55000;clock.update([]);
  assert.deepEqual(records.slice(2),[{section:'experience',seconds:3},{section:'experience',seconds:2}]);
});
