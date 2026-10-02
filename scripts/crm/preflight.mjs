import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const PROJECT='rwpcqeiukrektpjqkpdx';
export function inspectSnapshot(snapshot,now=Date.now()) {
 if(snapshot.project_id!==PROJECT)throw Error('wrong_project');
 const age=now-Date.parse(snapshot.observed_at);
 if(!Number.isFinite(age)||age<0||age>300000)throw Error('stale_snapshot');
 if(!Array.isArray(snapshot.events))throw Error('events_required');
 const ids=new Set();
 return snapshot.events.map(e=>{
  if(!e.id||ids.has(e.id))throw Error('duplicate_or_missing_event');ids.add(e.id);
  const holds=[];
  if(e.payload?.app!=='mission365'||e.payload?.user_id!==e.user_id)holds.push('event_identity_mismatch');
  if(!['user.signup','user.backfill','role.changed'].includes(e.event_type))holds.push('unsupported_event');
  const payload=e.payload ?? {};
  const text=value=>typeof value==='string' && value.trim().length>0;
  let eventContract='account_reconciliation';
  if(e.event_type==='role.changed') {
   eventContract='role_reconciliation';
   let valid=text(payload.role);
   if(!Object.hasOwn(payload,'operation')) {
    valid=valid && text(payload.status) && !Object.hasOwn(payload,'direction');
   } else if(payload.operation==='DELETE') {
    eventContract='role_deletion_reconciliation';
    valid=valid && payload.status===null && text(payload.previous_status) && !Object.hasOwn(payload,'direction');
   } else if(payload.operation==='TRANSFER') {
    eventContract='role_transfer_reconciliation';
    valid=valid && text(payload.previous_status) &&
     ((payload.direction==='out' && payload.status===null) ||
      (payload.direction==='in' && text(payload.status)));
   } else valid=false;
   if(!valid)holds.push('invalid_role_event_contract');
  } else if(Object.hasOwn(payload,'operation') || Object.hasOwn(payload,'direction')) {
   holds.push('invalid_account_event_contract');
  }
  if(e.status!=='pending'||e.processed_at!=null)holds.push('not_pending');
  const available=Date.parse(e.available_at);if(!Number.isFinite(available)||available>now)holds.push('not_available');
  if(!e.link||e.link.user_id!==e.user_id)holds.push('link_identity_missing_or_mismatched');
  if(!Array.isArray(e.roles)||!Array.isArray(e.applications))throw Error('authoritative_context_required');
  if(e.roles.some(r=>r.user_id!==e.user_id)||e.applications.some(a=>a.applicant_user_id!==e.user_id))holds.push('cross_user_context');
  const stage=e.roles.some(r=>r.status==='active')?'role_activated':'account_created';
  if(e.link?.onboarding_stage!==stage)holds.push('stale_link_stage');
  const submitted=e.applications.filter(a=>a.submitted_at!=null);
  let classification='account_only',route=null;
  if(submitted.length>1){classification='multiple_applications';holds.push('application_route_ambiguous')}
  else if(submitted.length===1){
   const app=submitted[0];classification=app.application_type;
   if(app.application_type==='mission_owner')route={location_id:'k0qCyTaLEJaIazRML7hs',pipeline_id:'ecn4oXO2mhDRdXV6Qn1O',stage_id:'2c6d8dfa-3865-4e44-a04d-a56631457143',authority:'historical_candidate_requires_fresh_verification'};
   else holds.push('application_route_unverified');
  }
  holds.push('external_consumer_ownership_unverified','enrollment_effects_unverified','person_classification_unverified');
  return {event_id:e.id,source_project:PROJECT,classification,event_contract:eventContract,state_authority:'current_account_roles_and_applications',derived_stage:stage,route_candidate:route,holds:[...new Set(holds)],write_authorized:false,mark_processed:false,external_actions:0};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [,,input,output]=process.argv;if(!input||!output)throw Error('usage: preflight.mjs snapshot.json output.json');
 writeFileSync(output,JSON.stringify(inspectSnapshot(JSON.parse(readFileSync(input,'utf8'))),null,2)+'\n');
}
