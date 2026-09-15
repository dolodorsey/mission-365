import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const path = new URL('../supabase/functions/mission365-application-sheet-feed/index.ts', import.meta.url)

test('legacy Mission 365 application sheet feed stays retired and contains no privileged export logic', async () => {
  const source = await readFile(path, 'utf8')

  assert.match(source, /application_sheet_feed_retired/)
  assert.match(source, /status:\s*410/)
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(source, /mission365_applications\?select=/)
  assert.doesNotMatch(source, /contact_email/)
  assert.doesNotMatch(source, /contact_phone/)
  assert.doesNotMatch(source, /requested_amount_cents/)
  assert.doesNotMatch(source, /searchParams\.get\(["']token["']\)/)
})
