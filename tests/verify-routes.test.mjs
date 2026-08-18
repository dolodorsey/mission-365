import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { EXPECTED_ROUTES, findMissingRoutes } from '../scripts/verify-routes.mjs'

describe('verify-routes gate', () => {
  it('requires every Mission 365 route the app ships', () => {
    for (const route of [
      '/',
      '/apply',
      '/join',
      '/login',
      '/missions',
      '/missions/[slug]',
      '/app',
      '/app/donor',
      '/app/mission-owner',
      '/app/mission-owner/profile',
      '/app/mission-owner/registry',
      '/app/business',
      '/app/vendor',
      '/app/volunteer',
      '/app/admin',
      '/legal',
      '/download',
      '/api/health',
      '/robots.txt',
      '/sitemap.xml',
    ]) {
      assert.ok(EXPECTED_ROUTES.includes(route), `EXPECTED_ROUTES is missing ${route}`)
    }
    assert.equal(EXPECTED_ROUTES.length, 20)
  })

  it('passes when the build contains every expected route', () => {
    assert.deepEqual(findMissingRoutes(new Set(EXPECTED_ROUTES)), [])
  })

  it('fails loudly when a production build is truncated', () => {
    const truncated = new Set(EXPECTED_ROUTES.slice(0, 11))
    const missing = findMissingRoutes(truncated)
    assert.equal(missing.length, EXPECTED_ROUTES.length - 11)
    assert.ok(missing.includes('/app/vendor'))
    assert.ok(missing.includes('/app/volunteer'))
    assert.ok(missing.includes('/sitemap.xml'))
  })
})
