import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getSupabaseClients, requireUser } from '@/lib/server-auth'
import { stripePost } from '@/lib/stripe-rest'

export const dynamic='force-dynamic'

type CheckoutBody={missionId?:string;amountCents?:number;cadence?:'one_time'|'monthly'}
type StripeCheckoutSession={id:string;url:string|null}

export async function POST(request:Request){
  try{
    const user=await requireUser(request)
    if(!user) return NextResponse.json({error:'Authentication required'},{status:401})
    const {missionId,amountCents,cadence='one_time'}=await request.json() as CheckoutBody
    if(!missionId||!Number.isInteger(amountCents)||Number(amountCents)<100)
      return NextResponse.json({error:'A valid mission and amount of at least $1 are required'},{status:400})
    if(!['one_time','monthly'].includes(cadence))
      return NextResponse.json({error:'Unsupported giving cadence'},{status:400})

    const {adminClient}=getSupabaseClients()
    if(!adminClient) return NextResponse.json({error:'Mission 365 backend is not fully configured'},{status:503})

    const {data:mission,error:missionError}=await adminClient
      .from('mission365_missions')
      .select('id,title,status,published_at')
      .eq('id',missionId)
      .single()
    if(missionError||!mission||!['published','funded','reporting'].includes(mission.status)||!mission.published_at)
      return NextResponse.json({error:'This mission is not currently open for verified giving'},{status:409})

    const givingPlanId=randomUUID()
    const donationId=randomUUID()
    const idempotencyKey=randomUUID()
    const platformFeeBps=Math.max(0,Math.min(10000,Number(process.env.MISSION365_PLATFORM_FEE_BPS||500)))
    const platformFeeCents=Math.floor(Number(amountCents)*platformFeeBps/10000)

    const {error:planError}=await adminClient.from('mission365_giving_plans').insert({
      id:givingPlanId,donor_user_id:user.id,mission_id:missionId,amount_cents:amountCents,cadence,status:'pending'
    })
    if(planError) throw planError
    const {error:donationError}=await adminClient.from('mission365_donations').insert({
      id:donationId,giving_plan_id:givingPlanId,donor_user_id:user.id,mission_id:missionId,
      amount_cents:amountCents,platform_fee_cents:platformFeeCents,currency:'usd',status:'pending',idempotency_key:idempotencyKey
    })
    if(donationError) throw donationError

    const origin=process.env.NEXT_PUBLIC_APP_URL||new URL(request.url).origin
    const params=new URLSearchParams()
    params.set('mode',cadence==='monthly'?'subscription':'payment')
    params.set('success_url',`${origin}/app/donor?checkout=success&session_id={CHECKOUT_SESSION_ID}`)
    params.set('cancel_url',`${origin}/missions?checkout=cancelled`)
    params.set('customer_email',user.email||'')
    params.set('line_items[0][quantity]','1')
    params.set('line_items[0][price_data][currency]','usd')
    params.set('line_items[0][price_data][unit_amount]',String(amountCents))
    params.set('line_items[0][price_data][product_data][name]',`Mission 365 — ${mission.title}`)
    if(cadence==='monthly') params.set('line_items[0][price_data][recurring][interval]','month')
    params.set('metadata[mission_id]',missionId)
    params.set('metadata[donor_user_id]',user.id)
    params.set('metadata[giving_plan_id]',givingPlanId)
    params.set('metadata[donation_id]',donationId)
    params.set('integration_identifier','mission365_giving_qrstuvwx')
    if(cadence==='monthly'){
      params.set('subscription_data[metadata][mission_id]',missionId)
      params.set('subscription_data[metadata][donor_user_id]',user.id)
      params.set('subscription_data[metadata][giving_plan_id]',givingPlanId)
    }else{
      params.set('payment_intent_data[metadata][mission_id]',missionId)
      params.set('payment_intent_data[metadata][donor_user_id]',user.id)
      params.set('payment_intent_data[metadata][giving_plan_id]',givingPlanId)
      params.set('payment_intent_data[metadata][donation_id]',donationId)
    }

    const session=await stripePost<StripeCheckoutSession>('/v1/checkout/sessions',params,`mission365-checkout-${idempotencyKey}`)
    await adminClient.from('mission365_giving_plans').update({stripe_checkout_session_id:session.id}).eq('id',givingPlanId)
    await adminClient.from('mission365_donations').update({stripe_checkout_session_id:session.id}).eq('id',donationId)
    return NextResponse.json({checkoutUrl:session.url,sessionId:session.id})
  }catch(error){
    console.error('mission365 checkout error',error)
    return NextResponse.json({error:error instanceof Error?error.message:'Checkout could not be created'},{status:500})
  }
}
