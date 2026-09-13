import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const functionPath = new URL('../supabase/functions/mission365-launch-status/index.ts', import.meta.url)
const source = await readFile(functionPath, 'utf8')

test('Mission 365 launch status exposes real founder execution exceptions', () => {
  assert.match(source, /mission365_missions'.*\['submitted','under_review'\]/s)
  assert.match(source, /mission365_crm_outbox'.*\.eq\('status','pending'\)/s)
  assert.match(source, /founderExceptions:/)
  assert.match(source, /missionReview:/)
  assert.match(source, /crmOutbox:/)
  assert.match(source, /staleOver4h:/)
})

test('Mission 365 launch status fails closed when required operational queries fail', () => {
  assert.match(source, /failedQueries=requiredQueries/)
  assert.match(source, /queryIntegrity:failedQueries\.length\?'degraded':'ok'/)
  assert.match(source, /status:failedQueries\.length\?503:200/)
})

test('Mission 365 founder telemetry remains entity-local and does not expose CRM payloads', () => {
  assert.doesNotMatch(source, /good_times|\bsos\b|on_call|luxe_on_demand/i)
  assert.doesNotMatch(source, /select\('.*payload.*'\)/)
  assert.match(source, /mission365_crm_outbox/)
})
