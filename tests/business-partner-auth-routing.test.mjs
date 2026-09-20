import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('business partner acquisition leaves general Join roles for verified applicant intake', async () => {
  const joinPage = await readFile(new URL('../src/app/join/page.tsx', import.meta.url), 'utf8');
  assert.match(joinPage,/initialRole==='business_partner'/);
  assert.match(joinPage,/redirect\('\/apply\?role=business_partner'\)/);
});

test('Mission 365 application authentication preserves the selected applicant type', async () => {
  const form = await readFile(new URL('../src/app/apply/ApplicationForm.tsx', import.meta.url), 'utf8');
  assert.match(form,/encodeURIComponent\(`\/apply\?role=\$\{type\}`\)/);
  assert.doesNotMatch(form,/href="\/login\?next=%2Fapply"/);
});
