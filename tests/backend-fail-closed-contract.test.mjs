import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const pagePath = new URL('../src/app/page.tsx', import.meta.url)
const source = await readFile(pagePath, 'utf8')

test('Mission 365 homepage fails closed when dedicated backend health is not OK', () => {
  assert.match(source, /if\(!response\.ok\) throw new Error/)
  assert.match(source, /setHealthState\('degraded'\)/)
  assert.match(source, /const backendAvailable=healthState==='healthy'/)
  assert.match(source, /No submissions are being routed into an unverified fallback\./)
})

test('backend-dependent customer actions are gated by verified health', () => {
  const gatedTargets = [
    '/missions',
    '/join',
    '/login',
    '/apply',
    '/login?next=%2Fapp',
    '/join?role=donor_business',
    '/join?role=vendor',
    '/app',
  ]

  for (const href of gatedTargets) {
    assert.match(source, new RegExp(`BackendLink enabled=\\{backendAvailable\\}[^>]*href=\\"${href.replace(/[?]/g, '\\?')}\\"|BackendLink enabled=\\{backendAvailable\\} href=\\"${href.replace(/[?]/g, '\\?')}\\"`), `expected ${href} to be health-gated`)
  }
})

test('static and explicitly separate informational paths remain available', () => {
  assert.match(source, /<Link className="button button-ghost" href="\/download">Mobile app status<\/Link>/)
  assert.match(source, /href=\{PROVIDER_ONBOARDING_URL\}/)
})
