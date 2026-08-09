import { NextResponse } from 'next/server'
import {
  MISSION365_LAUNCH_STATUS_URL,
  MISSION365_SUPABASE_PUBLISHABLE_KEY,
  MISSION365_SUPABASE_URL,
} from '@/lib/mission365-public'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * Git traceability for a running deployment.
 *
 * Only these three build-metadata variables are read. Never widen this to echo
 * arbitrary `process.env` values — this endpoint is public and uncached.
 */
function buildInfo() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'unknown'
  const ref = process.env.VERCEL_GIT_COMMIT_REF ?? null
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ?? null
  return { commit, ref, ...(deploymentId ? { deploymentId } : {}) }
}

export async function GET() {
  try {
    const response = await fetch(MISSION365_LAUNCH_STATUS_URL, {
      headers: { apikey: MISSION365_SUPABASE_PUBLISHABLE_KEY },
      cache: 'no-store',
    })
    const launch = response.ok ? await response.json() : null

    return NextResponse.json(
      {
        service: 'mission-365',
        status: response.ok ? 'ok' : 'degraded',
        build: 'launch-completion',
        ...buildInfo(),
        backend: {
          provider: 'supabase',
          isolated: true,
          url: MISSION365_SUPABASE_URL,
        },
        runtimes: {
          applications: 'supabase-rls',
          verification: 'supabase-edge',
          checkout: 'supabase-edge',
          stripeWebhook: 'supabase-edge',
          connect: 'supabase-edge',
          payouts: 'supabase-edge',
          risk: 'supabase-edge',
          notifications: 'supabase-edge',
        },
        payments: launch?.payments || {
          stripeApi: false,
          webhook: false,
          liveGiving: false,
        },
        verificationCandidates: launch?.verificationCandidates ?? null,
        liveMissions: launch?.liveMissions ?? null,
      },
      { status: response.ok ? 200 : 503, headers: NO_STORE },
    )
  } catch (error) {
    return NextResponse.json(
      {
        service: 'mission-365',
        status: 'degraded',
        ...buildInfo(),
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 503, headers: NO_STORE },
    )
  }
}
