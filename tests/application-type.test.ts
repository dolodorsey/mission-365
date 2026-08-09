import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  APPLICATION_TYPES,
  DEFAULT_APPLICATION_TYPE,
  isApplicationType,
  resolveApplicationType,
} from '../src/lib/application-type.ts'

describe('resolveApplicationType', () => {
  it('maps the canonical database values to themselves', () => {
    assert.equal(resolveApplicationType('mission_owner'), 'mission_owner')
    assert.equal(resolveApplicationType('business_partner'), 'business_partner')
  })

  it('maps the homepage CTA role values', () => {
    // The homepage business CTA links to /apply?role=business.
    assert.equal(resolveApplicationType('business'), 'business_partner')
    assert.equal(resolveApplicationType('partner'), 'business_partner')
    assert.equal(resolveApplicationType('mission'), 'mission_owner')
    assert.equal(resolveApplicationType('owner'), 'mission_owner')
  })

  it('is case-insensitive and trims surrounding whitespace', () => {
    assert.equal(resolveApplicationType('BUSINESS'), 'business_partner')
    assert.equal(resolveApplicationType('  Business  '), 'business_partner')
    assert.equal(resolveApplicationType('\tBusiness-Partner\n'), 'business_partner')
    assert.equal(resolveApplicationType('Mission_Owner'), 'mission_owner')
  })

  it('accepts hyphenated and unseparated spellings', () => {
    assert.equal(resolveApplicationType('business-partner'), 'business_partner')
    assert.equal(resolveApplicationType('businesspartner'), 'business_partner')
    assert.equal(resolveApplicationType('mission-owner'), 'mission_owner')
    assert.equal(resolveApplicationType('missionowner'), 'mission_owner')
  })

  it('falls back to the default for missing or empty input', () => {
    assert.equal(resolveApplicationType(undefined), DEFAULT_APPLICATION_TYPE)
    assert.equal(resolveApplicationType(''), DEFAULT_APPLICATION_TYPE)
    assert.equal(resolveApplicationType('   '), DEFAULT_APPLICATION_TYPE)
    assert.equal(DEFAULT_APPLICATION_TYPE, 'mission_owner')
  })

  it('falls back to the default for unknown and hostile input', () => {
    const hostile = [
      'admin',
      'superuser',
      'mission_owner; drop table mission365_applications',
      "business_partner' or '1'='1",
      '../../etc/passwd',
      '<script>alert(1)</script>',
      '__proto__',
      'constructor',
      'toString',
      'hasOwnProperty',
      'prototype',
    ]
    for (const value of hostile) {
      assert.equal(
        resolveApplicationType(value),
        DEFAULT_APPLICATION_TYPE,
        `expected ${JSON.stringify(value)} to fall back to the default`,
      )
    }
  })

  it('uses the first entry of a repeated query parameter, and never a non-string', () => {
    assert.equal(resolveApplicationType(['business']), 'business_partner')
    assert.equal(resolveApplicationType(['business', 'mission']), 'business_partner')
    assert.equal(resolveApplicationType([]), DEFAULT_APPLICATION_TYPE)
    assert.equal(resolveApplicationType(['nope']), DEFAULT_APPLICATION_TYPE)
  })

  it('only ever returns a value the database check constraint allows', () => {
    const probes = ['business', 'mission', 'constructor', '', 'x', undefined, ['business']]
    for (const probe of probes) {
      assert.ok(APPLICATION_TYPES.includes(resolveApplicationType(probe)))
    }
    assert.deepEqual([...APPLICATION_TYPES], ['mission_owner', 'business_partner'])
  })
})

describe('isApplicationType', () => {
  it('accepts only the canonical values', () => {
    assert.equal(isApplicationType('mission_owner'), true)
    assert.equal(isApplicationType('business_partner'), true)
    assert.equal(isApplicationType('business'), false)
    assert.equal(isApplicationType('constructor'), false)
    assert.equal(isApplicationType(undefined), false)
    assert.equal(isApplicationType(null), false)
    assert.equal(isApplicationType(42), false)
  })
})
