import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Mission 365 application UI exposes the current verification lifecycle', async () => {
  const form = await readFile(new URL('../src/app/apply/ApplicationForm.tsx', import.meta.url), 'utf8');
  assert.match(form, /waitlisted/);
  assert.match(form, /reviewing/);
  assert.match(form, /conditionally_approved/);
  assert.match(form, /approved/);
  assert.match(form, /VERIFICATION CENTER/);
  assert.match(form, /Your document vault/);
  assert.match(form, /review_note/);
  assert.match(form, /rejection_reason/);
  assert.match(form, /Open my workspace/);
});

test('Mission 365 status migration permits both legacy and current states', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260918012500_application_status_contract_v2.sql', import.meta.url), 'utf8');
  for (const status of ['draft','submitted','under_review','documents_required','waitlisted','reviewing','needs_information','conditionally_approved','approved','rejected','withdrawn']) {
    assert.match(migration, new RegExp("'" + status + "'"));
  }
});
