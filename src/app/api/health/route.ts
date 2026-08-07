import { NextResponse } from 'next/server'

export const dynamic='force-static'
export function GET(){
  const supabase=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const stripe=Boolean(process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY)
  const webhook=Boolean(process.env.STRIPE_WEBHOOK_SECRET)
  return NextResponse.json({
    service:'mission-365',
    status:'ok',
    build:'operating-app',
    integrations:{supabase,stripe,stripeWebhook:webhook},
    productionReady:supabase&&stripe&&webhook,
  })
}
