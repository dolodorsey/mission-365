import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { EXPECTED_ROUTES, findMissingRoutes } from '../scripts/verify-routes.mjs'

describe('verify-routes gate', () => {
  it('requires every Mission 365 route the app ships', () => {
    for (const route of [
      '/',
      '/apply',
      '/login',
      '/missions',
      '/missions/[slug]',
      '/app',
      '/app/donor',
      '/app/mission-owner',
      '/app/business',
      '/app/admin',
      '/legal',
      '/download',
      '/api/health',
      '/robots.txt',
      '/sitemap.xml',
    ]) {
      assert.ok(EXPECTED_ROUTES.includes(route), `EXPECTED_ROUTES is missing ${route}`)
    }
    assert.equal(EXPECTED_ROUTES.length, 15)
  })

  it('passes when the build contains every expected route', () => {
    assert.deepEqual(findMissingRoutes(new Set(EXPECTED_ROUTES)), [])
  })

  it('fails when the build is truncated, as the 11-route upload deploy was', () => {
    const truncated = new Set(EXPECTED_ROUTES.slice(0, 11))
    const missing = findMissingRoutes(truncated)
    assert.equal(missing.length, 4)
    assert.ok(missing.includes('/sitemap.xml'))
  })
})
