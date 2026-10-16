import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfScale} from '../profile/pdf-viewer.mjs';
const page={width:600,height:900};
test('fit page reserves room for the floating controls and respects the shorter edge',()=>{
 assert.equal(pdfScale('fit-page',832,1004,page),1);
 assert.equal(pdfScale('fit-page',332,1004,page),.5);
 assert.equal(pdfScale('fit-page',832,554,page),.5);
});
test('fit width allows document scrolling while explicit zoom remains unchanged',()=>{
 assert.equal(pdfScale('fit',632,554,page),1);
 assert.equal(pdfScale('1.5',332,554,page),1.5);
 assert.equal(pdfScale('fit-page',0,0,page),.1);
});
