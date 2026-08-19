import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../src/app/missions/page.tsx',import.meta.url),'utf8')
const migration=fs.readFileSync(new URL('../supabase/migrations/20260819024800_mission365_public_intelligence_ranking.sql',import.meta.url),'utf8')

test('public mission directory ranks verified intelligence before publication recency',()=>{
  assert.match(page,/mission365_public_mission_intelligence/)
  assert.match(page,/order\('intelligence_score',\{ascending:false\}\)/)
  assert.match(page,/order\('published_at',\{ascending:false\}\)/)
  assert.ok(page.indexOf("order('intelligence_score'") < page.indexOf("order('published_at'"))
})

test('Mission 365 intelligence requires source legitimacy and evidence-aware signals',()=>{
  assert.match(migration,/p\.source_status='sourced'/)
  assert.match(migration,/evidenced_impact_count/)
  assert.match(migration,/verified_testimonial_count/)
  assert.match(migration,/open_opportunity_count/)
  assert.match(migration,/active_registry_count/)
  assert.doesNotMatch(migration,/google_rating|seo_rank|nearest_first/i)
})
