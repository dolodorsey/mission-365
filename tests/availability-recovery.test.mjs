import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('src/app/page.tsx','utf8');
const route=fs.readFileSync('src/app/api/health/route.ts','utf8');
test('client and upstream have bounded, ordered deadlines',()=>{
 assert.match(page,/\},8000\)/);
 assert.ok(route.includes('AbortSignal.timeout(6500)'));
 assert.ok(page.includes('signal:controller.signal'));
});
test('late responses cannot reopen timed-out services',()=>{
 assert.ok(page.includes('if(live&&!controller.signal.aborted)'));
 assert.ok(page.includes('return()=>{live=false;clearTimeout(timeout);controller.abort()}'));
});
test('availability snapshot is checked before rendering payment status',()=>{
 assert.ok(page.includes('Number.isSafeInteger(data.liveMissions)'));
 assert.ok(page.includes('Number.isSafeInteger(data.verificationCandidates)'));
 for(const key of ['stripeApi','webhook','liveGiving'])assert.ok(page.includes(`typeof data.payments?.${key}!==\'boolean\'`));
});
test('retry refreshes the effect without bypassing giving gates',()=>{
 assert.ok(page.includes('Retry connection'));
 assert.ok(page.includes('setHealthAttempt(attempt=>attempt+1)'));
 assert.ok(page.includes('},[healthAttempt])'));
 assert.ok(page.includes("const backendAvailable=healthState==='healthy'"));
 assert.ok(page.includes('health?.payments?.liveGiving&&health.liveMissions>0'));
});
