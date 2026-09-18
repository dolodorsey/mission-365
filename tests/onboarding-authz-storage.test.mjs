import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Mission 365 workspace activation is server-gated by approval', async () => {
  const portal = await readFile(new URL('../supabase/functions/mission365-owner-portal/index.ts', import.meta.url), 'utf8');
  assert.match(portal,/application\.status!==?'approved'/);
  assert.match(portal,/application approval is required before workspace activation/i);
  assert.match(portal,/Organization membership is required/);
});

test('Mission 365 applicant document writes are least privilege and path scoped', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260918020500_onboarding_authz_and_storage_contract.sql', import.meta.url), 'utf8');
  assert.match(sql,/grant insert \(/i);
  assert.match(sql,/review_status='pending'/);
  assert.match(sql,/storage_bucket='mission365-private'/);
  assert.match(sql,/auth\.uid\(\)::text\|\|'\/applications\/'/);
  assert.match(sql,/reviewed_by is null/);
  assert.match(sql,/rejection_reason is null/);
});

test('Mission 365 public-asset storage policy does not directly expose membership table privileges', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260918020500_onboarding_authz_and_storage_contract.sql', import.meta.url), 'utf8');
  assert.match(sql,/mission365_can_manage_public_profile_asset/);
  assert.match(sql,/security definer/i);
  assert.match(sql,/revoke all on function public\.mission365_can_manage_public_profile_asset/);
});
