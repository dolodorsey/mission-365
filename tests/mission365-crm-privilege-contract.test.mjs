import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260902154713_mission365_revoke_client_crm_grants.sql',import.meta.url),'utf8')
const executable=migration.replace(/--.*$/gm,'').toLowerCase()

test('Mission 365 CRM control-plane tables deny direct browser-role access',()=>{
  assert.match(executable,/revoke\s+all\s+privileges\s+on\s+table\s+public\.mission365_crm_links\s+from\s+anon,\s*authenticated/)
  assert.match(executable,/revoke\s+all\s+privileges\s+on\s+table\s+public\.mission365_crm_outbox\s+from\s+anon,\s*authenticated/)
  assert.match(executable,/grant\s+all\s+privileges\s+on\s+table\s+public\.mission365_crm_links\s+to\s+service_role/)
  assert.match(executable,/grant\s+all\s+privileges\s+on\s+table\s+public\.mission365_crm_outbox\s+to\s+service_role/)
})

test('Mission 365 CRM privilege migration is non-destructive and brand isolated',()=>{
  assert.doesNotMatch(executable,/\b(drop|truncate|delete\s+from|update\s+public\.|insert\s+into|alter\s+table)\b/)
  assert.doesNotMatch(executable,/\b(sos_|oc_|lm_|tempo_|gt_|cg_|noir_|otini_|pronto_|infinity_)\w*/)
})
