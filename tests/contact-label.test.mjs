import test from 'node:test';
import assert from 'node:assert/strict';
import {contactLabel} from '../profile/cv-rows.mjs';
test('contact labels follow explicit links and structured addresses without guessing other text',()=>{
 assert.equal(contactLabel({href:'mailto:test@example.com'}),'E-mail');
 assert.equal(contactLabel({href:'tel:+41000000000'}),'Telephone');
 assert.equal(contactLabel({href:'https://example.com'}),'Website');
 assert.equal(contactLabel({title:'Example Street 1\n8000 Zürich'}),'Address');
 assert.equal(contactLabel({title:'19.06.2000 · Sins'}),'');
 assert.equal(contactLabel({title:'Other contact detail'}),'');
});
