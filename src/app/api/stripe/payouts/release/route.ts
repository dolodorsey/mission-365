import { NextResponse } from 'next/server'
import { getSupabaseClients, requireMission365Role } from '@/lib/server-auth'
import { stripeGet, stripePost } from '@/lib/stripe-rest'

export const dynamic='force-dynamic'

type ReleaseBody={payoutId?:string}
type ConnectAccount={configuration?:{recipient?:{capabilities?:{stripe_balance?:{stripe_transfers?:{status?:string}}}}}}}
type StripeTransfer={id:string}

export async function POST(request:Request){
  try{
    const actor=await requireMission365Role(request,['admin','finance'])
    if(!actor) return NextResponse.json({error:'Mission 365 finance authorization required'},{status:403})
    const {payoutId}=await request.json() as ReleaseBody
    if(!payoutId) return NextResponse.json({error:'payoutId is required'},{status:400})
    const {adminClient}=getSupabaseClients()
    if(!adminClient) return NextResponse.json({error:'Backend not configured'},{status:503})

    const {data:payout,error}=await adminClient.from('mission365_payouts')
      .select('id,mission_id,organization_id,amount_cents,currency,status')
      .eq('id',payoutId).single()
    if(error||!payout) return NextResponse.json({error:'Payout not found'},{status:404})
    if(payout.status!=='approved') return NextResponse.json({error:'Payout must be approved before release'},{status:409})

    const {data:account}=await adminClient.from('mission365_payout_accounts')
      .select('stripe_account_id').eq('organization_id',payout.organization_id).single()
    if(!account?.stripe_account_id) return NextResponse.json({error:'Mission owner has no connected payout account'},{status:409})

    const connected=await stripeGet<ConnectAccount>(`/v2/core/accounts/${account.stripe_account_id}`)
    const transferStatus=connected.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status
    await adminClient.from('mission365_payout_accounts').update({
      transfers_status:transferStatus==='active'?'active':'restricted',last_checked_at:new Date().toISOString()
    }).eq('organization_id',payout.organization_id)
    if(transferStatus!=='active') return NextResponse.json({error:'Connected account is not transfer-ready'},{status:409})

    const {data:donations}=await adminClient.from('mission365_donations')
      .select('amount_cents,platform_fee_cents').eq('mission_id',payout.mission_id).eq('status','succeeded')
    const {data:prior}=await adminClient.from('mission365_payouts')
      .select('amount_cents').eq('mission_id',payout.mission_id).in('status',['approved','processing','paid']).neq('id',payout.id)
    const available=(donations||[]).reduce((sum,row)=>sum+Number(row.amount_cents)-Number(row.platform_fee_cents),0)
      -(prior||[]).reduce((sum,row)=>sum+Number(row.amount_cents),0)
    if(Number(payout.amount_cents)>available)
      return NextResponse.json({error:'Payout exceeds cleared mission proceeds',availableCents:Math.max(0,available)},{status:409})

    await adminClient.from('mission365_payouts').update({status:'processing'}).eq('id',payout.id).eq('status','approved')
    const params=new URLSearchParams()
    params.set('amount',String(payout.amount_cents))
    params.set('currency',String(payout.currency||'usd'))
    params.set('destination',account.stripe_account_id)
    params.set('transfer_group',`mission365_${payout.mission_id}`)
    params.set('metadata[payout_id]',payout.id)
    params.set('metadata[mission_id]',payout.mission_id)
    const transfer=await stripePost<StripeTransfer>('/v1/transfers',params,`mission365-payout-${payout.id}`)

    await adminClient.from('mission365_payouts').update({status:'paid',stripe_transfer_id:transfer.id,updated_at:new Date().toISOString()}).eq('id',payout.id)
    await adminClient.from('mission365_audit_log').insert({
      actor_user_id:actor.id,action:'payout.released',entity_type:'payout',entity_id:payout.id,
      after_state:{status:'paid',stripe_transfer_id:transfer.id},metadata:{mission_id:payout.mission_id,organization_id:payout.organization_id}
    })
    return NextResponse.json({released:true,transferId:transfer.id})
  }catch(error){
    console.error('mission365 payout release failed',error)
    return NextResponse.json({error:error instanceof Error?error.message:'Payout release failed'},{status:500})
  }
}
