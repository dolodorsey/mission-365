import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const nudgePath = new URL('../src/components/ApplicationNudge.tsx', import.meta.url)
const source = await readFile(nudgePath, 'utf8')

test('application nudge fails closed until Mission 365 backend health is OK', () => {
  assert.match(source, /useState\(false\)/)
  assert.match(source, /fetch\('\/api\/health',\{cache:'no-store'\}\)/)
  assert.match(source, /setBackendAvailable\(response\.ok\)/)
  assert.match(source, /setBackendAvailable\(false\)/)
  assert.match(source, /if\(!backendAvailable\)return null/)
})

test('application CTA remains Mission 365-only when health is verified', () => {
  assert.match(source, /href="\/apply"/)
  assert.doesNotMatch(source, /\b(?:goodtimes|sos|casper|pronto|noir|otini|xxx|ora)\b/i)
})
