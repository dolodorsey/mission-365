import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const configPath = resolve(repoRoot, 'next.config.js')

describe('next.config.js', () => {
  it('declares no rewrites at all', () => {
    const config = require(configPath)
    assert.equal(
      Object.prototype.hasOwnProperty.call(config, 'rewrites'),
      false,
      'next.config.js must not define rewrites — /brand/* is served from public/brand',
    )
    assert.equal(typeof config.rewrites, 'undefined')
  })

  it('never proxies anything to raw.githubusercontent.com', async () => {
    const source = readFileSync(configPath, 'utf8')
    assert.equal(
      source.includes('raw.githubusercontent.com'),
      false,
      'brand assets must be served locally, not proxied to raw.githubusercontent.com',
    )

    const config = require(configPath)
    const rewrites = typeof config.rewrites === 'function' ? await config.rewrites() : []
    const flattened = Array.isArray(rewrites)
      ? rewrites
      : [...(rewrites.beforeFiles ?? []), ...(rewrites.afterFiles ?? []), ...(rewrites.fallback ?? [])]
    assert.deepEqual(flattened, [])
  })

  it('still applies the security headers', async () => {
    const config = require(configPath)
    const headers = await config.headers()
    const keys = headers.flatMap((entry) => entry.headers.map((header) => header.key))
    for (const expected of ['X-Content-Type-Options', 'X-Frame-Options', 'Strict-Transport-Security']) {
      assert.ok(keys.includes(expected), `missing security header ${expected}`)
    }
  })
})
