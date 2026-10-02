import test from 'node:test';import assert from 'node:assert/strict';import {inspectSnapshot} from './preflight.mjs';
const now=Date.now();function f(){return {project_id:'rwpcqeiukrektpjqkpdx',observed_at:new Date(now).toISOString(),events:[{id:'event',user_id:'u',event_type:'user.backfill',payload:{app:'mission365',user_id:'u'},status:'pending',processed_at:null,available_at:new Date(now-1000).toISOString(),link:{user_id:'u',onboarding_stage:'account_created'},roles:[],applications:[]}]}}
test('backfill without application stays account only',()=>{const r=inspectSnapshot(f(),now)[0];assert.equal(r.classification,'account_only');assert.equal(r.route_candidate,null);assert.equal(r.write_authorized,false);assert.equal(r.mark_processed,false)});
test('current roles override stale event and flag stale link',()=>{const s=f();s.events[0].roles=[{user_id:'u',status:'active'}];assert.ok(inspectSnapshot(s,now)[0].holds.includes('stale_link_stage'))});
test('business partner never mapped to nonprofit',()=>{const s=f();s.events[0].applications=[{applicant_user_id:'u',application_type:'business_partner',submitted_at:'2026-09-01'}];const r=inspectSnapshot(s,now)[0];assert.equal(r.route_candidate,null);assert.ok(r.holds.includes('application_route_unverified'))});
test('mission owner only produces held historical route candidate',()=>{const s=f();s.events[0].applications=[{applicant_user_id:'u',application_type:'mission_owner',submitted_at:'2026-09-01'}];const r=inspectSnapshot(s,now)[0];assert.equal(r.route_candidate.location_id,'k0qCyTaLEJaIazRML7hs');assert.equal(r.write_authorized,false)});
for(const [name,change,hold]of [['payload user',e=>e.payload.user_id='other','event_identity_mismatch'],['foreign role',e=>e.roles=[{user_id:'other',status:'active'}],'cross_user_context'],['processed',e=>e.status='processed','not_pending'],['future',e=>e.available_at=new Date(now+50000).toISOString(),'not_available']])test(name,()=>{const s=f();change(s.events[0]);assert.ok(inspectSnapshot(s,now)[0].holds.includes(hold))});
for(const [name,change,error]of [['project',s=>s.project_id='other','wrong_project'],['stale',s=>s.observed_at=new Date(now-300001).toISOString(),'stale_snapshot'],['duplicate',s=>s.events.push(s.events[0]),'duplicate_or_missing_event']])test(name,()=>{const s=f();change(s);assert.throws(()=>inspectSnapshot(s,now),new RegExp(error))});

function roleEvent(payload) {const s=f();Object.assign(s.events[0],{event_type:'role.changed',payload:{app:'mission365',user_id:'u',role:'volunteer',...payload}});return s}
for(const payload of [
 {status:'active'},
 {operation:'DELETE',status:null,previous_status:'active'},
 {operation:'TRANSFER',direction:'out',status:null,previous_status:'active'},
 {operation:'TRANSFER',direction:'in',status:'active',previous_status:'inactive'},
]) test('valid contract '+JSON.stringify(payload),()=>{
 const r=inspectSnapshot(roleEvent(payload),now)[0];
 assert.ok(!r.holds.includes('invalid_role_event_contract'));
 assert.equal(r.derived_stage,'account_created'); // Historical active payload cannot activate current account.
 assert.equal(r.write_authorized,false);assert.equal(r.external_actions,0);assert.equal(r.mark_processed,false);
});
for(const payload of [
 {operation:'DELETE',status:'active',previous_status:'active'},
 {operation:'DELETE',previous_status:'active'},
 {operation:'DELETE',status:null},
 {operation:'TRANSFER',direction:'out',status:'active',previous_status:'active'},
 {operation:'TRANSFER',direction:'in',status:null,previous_status:'active'},
 {operation:'TRANSFER',direction:'sideways',status:null,previous_status:'active'},
 {operation:'UPSERT',status:'active'}, {status:null}, {status:'active',role:''},
 {operation:null,status:'active'}, {status:'active',direction:'in'},
]) test('reject malformed contract '+JSON.stringify(payload),()=>{
 assert.ok(inspectSnapshot(roleEvent(payload),now)[0].holds.includes('invalid_role_event_contract'));
});
test('deletion does not deactivate other current active role',()=>{
 const s=roleEvent({operation:'DELETE',status:null,previous_status:'active'});
 s.events[0].roles=[{user_id:'u',role:'vendor',status:'active'}];s.events[0].link.onboarding_stage='role_activated';
 assert.equal(inspectSnapshot(s,now)[0].derived_stage,'role_activated');
});
test('account event cannot masquerade as transfer',()=>{const s=f();s.events[0].payload.operation='TRANSFER';assert.ok(inspectSnapshot(s,now)[0].holds.includes('invalid_account_event_contract'))});
