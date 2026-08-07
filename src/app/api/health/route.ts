import { NextResponse } from 'next/server'
import { MISSION365_SUPABASE_URL } from '@/lib/mission365-public'

export const dynamic='force-dynamic'
export function GET(){
  return NextResponse.json({
    service:'mission-365',
    status:'ok',
    build:'operating-app',
    backend:{provider:'supabase',isolated:true,url:MISSION365_SUPABASE_URL},
    runtimes:{applications:'supabase-rls',checkout:'supabase-edge',stripeWebhook:'supabase-edge',payouts:'supabase-edge'},
    liveGiving:'credential-gated'
  },{headers:{'Cache-Control':'no-store'}})
}
