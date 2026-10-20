import {test} from 'node:test';
import assert from 'node:assert/strict';
import {suggestedDeadline} from './deadline';
const hour=3600000,opened=Date.UTC(2026,9,19,10);
test('deadline uses 48 hours, capped 24 hours before the event',()=>{
 assert.equal(suggestedDeadline(opened),opened+48*hour);
 assert.equal(suggestedDeadline(opened,opened+100*hour),opened+48*hour);
 assert.equal(suggestedDeadline(opened,opened+50*hour),opened+26*hour);
});
test('nearby events use half the remaining time and invalid intervals have no suggestion',()=>{
 assert.equal(suggestedDeadline(opened,opened+6*hour),opened+3*hour);
 assert.equal(suggestedDeadline(opened,opened+24*hour),opened+12*hour);
 assert.equal(suggestedDeadline(opened,opened-1),undefined);
 assert.equal(suggestedDeadline(opened,NaN),undefined);
 assert.equal(suggestedDeadline(opened,opened+1000),undefined);
});
