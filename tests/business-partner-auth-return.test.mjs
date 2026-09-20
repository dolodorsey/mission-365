import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const joinSource = await readFile(new URL('../src/app/join/JoinClient.tsx', import.meta.url), 'utf8')
const applicationSource = await readFile(new URL('../src/app/apply/ApplicationForm.tsx', import.meta.url), 'utf8')

test('business partner is a first-class join role with a dedicated application destination', () => {
  assert.match(joinSource, /'business_partner'/)
  assert.match(joinSource, /selected === 'business_partner'/)
  assert.match(joinSource, /href="\/apply\?role=business_partner"/)
})

test('join authentication preserves the selected applicant role', () => {
  assert.match(joinSource, /const authReturn = `\/join\$\{selected \? `\?role=\$\{selected\}` : ''\}`/)
  assert.match(joinSource, /href=\{`\/login\?next=\$\{encodeURIComponent\(authReturn\)\}`\}/)
})

test('direct application authentication preserves application type', () => {
  assert.match(applicationSource, /const next=`\/apply\?role=\$\{type\}`/)
  assert.match(applicationSource, /href=\{`\/login\?next=\$\{encodeURIComponent\(next\)\}`\}/)
  assert.doesNotMatch(applicationSource, /href="\/login\?next=%2Fapply"/)
})
