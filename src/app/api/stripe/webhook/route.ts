import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSupabaseClients } from '@/lib/server-auth'
import { stripeGet } from '@/lib/stripe-rest'

export const dynamic='force-dynamic'

type StripeEvent={id:string;type:string;livemode:boolean;data:{object:any}}

function validSignature(raw:string,header:string,secret:string){
  const parts=header.split(',').map(v=>v.split('='))
  const timestamp=parts.find(([k])=>k==='t')?.[1]
  const signatures=parts.filter(([k])=>k==='v1').map(([,v])=>v)
  if(!timestamp||!signatures.length) return false
  if(Math.abs(Date.now()/1000-Number(timestamp))>300) return false
  const expected=createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex')
  return signatures.some(signature=>{
    try{
      const a=Buffer.from(expected,'hex'); const b=Buffer.from(signature,'hex')
      return a.length===b.length&&timingSafeEqual(a,b)
    }catch{return false}
  })
}

export async function POST(request:Request){
  const secret=process.env.STRIPE_WEBHOOK_SECRET
  if(!secret) return NextResponse.json({error:'Webhook not configured'},{status:503})
  const raw=await request.text()
  const signature=request.headers.get('stripe-signature')||''
  if(!validSignature(raw,signature,secret)) return NextResponse.json({error:'Invalid signature'},{status:400})

  let event:StripeEvent
  try{event=JSON.parse(raw) as StripeEvent}catch{return NextResponse.json({error:'Invalid payload'},{status:400})}
  const {adminClient}=getSupabaseClients()
  if(!adminClient) return NextResponse.json({error:'Backend not configured'},{status:503})

  const {error:claimError}=await adminClient.from('mission365_stripe_events').insert({
    stripe_event_id:event.id,event_type:event.type,livemode:event.livemode,payload:event,processing_status:'received'
  })
  if(claimError){
    if(claimError.code==='23505') return NextResponse.json({received:true,duplicate:true})
    console.error('mission365 webhook claim failed',claimError)
    return NextResponse.json({error:'Could not claim event'},{status:500})
  }

  try{
    const object=event.data.object
    if(event.type==='checkout.session.completed'){
      const metadata=object.metadata||{}
      if(metadata.giving_plan_id){
        const update:any={stripe_checkout_session_id:object.id}
        if(object.mode==='subscription'&&object.subscription){update.status='active';update.stripe_subscription_id=object.subscription}
        await adminClient.from('mission365_giving_plans').update(update).eq('id',metadata.giving_plan_id)
      }
      if(object.mode==='payment'&&object.payment_status==='paid'&&metadata.donation_id){
        await adminClient.from('mission365_donations').update({
          status:'succeeded',stripe_payment_intent_id:object.payment_intent,succeeded_at:new Date().toISOString()
        }).eq('id',metadata.donation_id)
        await adminClient.from('mission365_giving_plans').update({status:'completed'}).eq('id',metadata.giving_plan_id)
      }
    }

    if(event.type==='invoice.paid'){
      const subscriptionId=object.subscription||object.parent?.subscription_details?.subscription
      if(subscriptionId){
        const subscription=await stripeGet<any>(`/v1/subscriptions/${subscriptionId}`)
        const metadata=subscription.metadata||{}
        if(metadata.giving_plan_id&&metadata.mission_id&&metadata.donor_user_id){
          await adminClient.from('mission365_giving_plans').update({status:'active',stripe_subscription_id:subscriptionId}).eq('id',metadata.giving_plan_id)
          const paymentIntentId=object.payment_intent||object.payments?.data?.[0]?.payment?.payment_intent
          if(paymentIntentId){
            const {data:existing}=await adminClient.from('mission365_donations').select('id').eq('stripe_payment_intent_id',paymentIntentId).maybeSingle()
            if(!existing){
              const amount=Number(object.amount_paid||0)
              const feeBps=Math.max(0,Math.min(10000,Number(process.env.MISSION365_PLATFORM_FEE_BPS||500)))
              await adminClient.from('mission365_donations').insert({
                id:randomUUID(),giving_plan_id:metadata.giving_plan_id,donor_user_id:metadata.donor_user_id,
                mission_id:metadata.mission_id,amount_cents:amount,platform_fee_cents:Math.floor(amount*feeBps/10000),
                currency:String(object.currency||'usd').toLowerCase(),status:'succeeded',stripe_payment_intent_id:paymentIntentId,
                idempotency_key:randomUUID(),succeeded_at:new Date().toISOString()
              })
            }
          }
        }
      }
    }

    if(event.type==='payment_intent.payment_failed'){
      const donationId=object.metadata?.donation_id
      if(donationId) await adminClient.from('mission365_donations').update({status:'failed',stripe_payment_intent_id:object.id}).eq('id',donationId)
    }

    if(event.type==='charge.refunded'){
      const paymentIntentId=typeof object.payment_intent==='string'?object.payment_intent:null
      if(paymentIntentId){
        const status=Number(object.amount_refunded)>=Number(object.amount)?'refunded':'partially_refunded'
        await adminClient.from('mission365_donations').update({status}).eq('stripe_payment_intent_id',paymentIntentId)
      }
    }

    if(event.type==='charge.dispute.created'){
      const paymentIntentId=typeof object.payment_intent==='string'?object.payment_intent:null
      if(paymentIntentId){
        const {data:donation}=await adminClient.from('mission365_donations').select('id,mission_id,donor_user_id').eq('stripe_payment_intent_id',paymentIntentId).maybeSingle()
        if(donation){
          await adminClient.from('mission365_donations').update({status:'disputed'}).eq('id',donation.id)
          await adminClient.from('mission365_risk_events').insert({
            donation_id:donation.id,mission_id:donation.mission_id,user_id:donation.donor_user_id,
            risk_type:'stripe_dispute',severity:'high',details:{stripe_dispute_id:object.dispute||object.id,reason:object.reason}
          })
        }
      }
    }

    await adminClient.from('mission365_stripe_events').update({processing_status:'processed',processed_at:new Date().toISOString()}).eq('stripe_event_id',event.id)
    return NextResponse.json({received:true})
  }catch(error){
    console.error('mission365 webhook processing failed',event.id,error)
    await adminClient.from('mission365_stripe_events').update({
      processing_status:'failed',error_message:error instanceof Error?error.message:'Unknown processing error'
    }).eq('stripe_event_id',event.id)
    return NextResponse.json({error:'Webhook processing failed'},{status:500})
  }
}
