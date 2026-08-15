import { NextResponse } from 'next/server'

const backend = 'https://rwpcqeiukrektpjqkpdx.supabase.co/functions/v1/mission365-launch-status'

export const dynamic = 'force-dynamic'

export async function GET() {
  let launch: Record<string, unknown> | null = null
  let backendStatus = 'degraded'

  try {
    const response = await fetch(backend, { cache: 'no-store' })
    if (response.ok) {
      launch = await response.json()
      backendStatus = 'ok'
    }
  } catch {
    backendStatus = 'degraded'
  }

  return NextResponse.json(
    {
      service: 'mission-365',
      status: backendStatus,
      build: 'launch-completion',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      ref: process.env.VERCEL_GIT_COMMIT_REF || 'local',
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      backend: {
        provider: 'supabase',
        isolated: true,
        url: 'https://rwpcqeiukrektpjqkpdx.supabase.co',
      },
      runtimes: {
        applications: 'supabase-rls',
        verification: 'supabase-edge',
        checkout: 'supabase-edge',
        stripeWebhook: 'supabase-edge',
        connect: 'supabase-edge',
        payouts: 'supabase-edge',
        refunds: 'supabase-edge',
        registry: 'supabase-edge',
        risk: 'supabase-edge',
        notifications: 'supabase-edge',
      },
      ...(launch || {}),
    },
    {
      status: backendStatus === 'ok' ? 200 : 503,
      headers: { 'cache-control': 'no-store' },
    },
  )
}
