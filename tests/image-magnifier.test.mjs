import test from 'node:test';
import assert from 'node:assert/strict';
import {magnifierGeometry} from '../profile/image-magnifier.mjs';

test('magnifier respects cover cropping and contain letterboxing', () => {
  const box={left:10,top:20,width:100,height:100}, natural={width:200,height:100};
  assert.deepEqual(magnifierGeometry(box,natural,'cover'),{left:-40,top:20,width:200,height:100});
  assert.deepEqual(magnifierGeometry(box,natural,'contain'),{left:10,top:45,width:100,height:50});
  assert.deepEqual(magnifierGeometry(box,natural,'cover','100% 0%'),{left:-90,top:20,width:200,height:100});
});

test('canvas magnification uses its displayed dimensions and scale-down never enlarges', () => {
  const box={left:0,top:0,width:200,height:100},natural={width:80,height:40};
  assert.deepEqual(magnifierGeometry(box,natural),{left:0,top:0,width:200,height:100});
  assert.deepEqual(magnifierGeometry(box,natural,'scale-down'),{left:60,top:30,width:80,height:40});
});
