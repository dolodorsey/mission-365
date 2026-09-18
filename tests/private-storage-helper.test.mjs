import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Mission 365 public-asset membership helper is private, not a public RPC', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260918021200_move_storage_helper_private.sql', import.meta.url), 'utf8');
  assert.match(sql,/mission365_private\.can_manage_public_profile_asset/);
  assert.match(sql,/security definer/i);
  assert.match(sql,/drop function if exists public\.mission365_can_manage_public_profile_asset/);
  assert.doesNotMatch(sql,/create or replace function public\.mission365_can_manage_public_profile_asset/);
});
