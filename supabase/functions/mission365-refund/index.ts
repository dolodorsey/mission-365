import { createClient } from 'npm:@supabase/supabase-js@2.112.0'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'cache-control':'no-store'}})
function publicKey(){const modern=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_ANON_KEY')!}
function secretKey(){const modern=Deno.env.get('SUPABASE_SECRET_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}
function admin(){return createClient(Deno.env.get('SUPABASE_URL')!,secretKey(),{auth:{persistSession:false,autoRefreshToken:false}})}
function scoped(auth:string){return createClient(Deno.env.get('SUPABASE_URL')!,publicKey(),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}})}
async function stripeSecret(db:any){let key=Deno.env.get('STRIPE_SECRET_KEY')||'';if(!key){const {data}=await db.rpc('mission365_get_runtime_secret',{secret_name:'stripe_api_key'});key=String(data||'')}return key}
async function financeRole(db:any,user:any){const meta=String(user.app_metadata?.mission365_role||'');if(['admin','finance'].includes(meta))return meta;if(user.email_confirmed_at&&user.email){const {data}=await db.from('mission365_reviewer_access').select('role').eq('email',user.email.toLowerCase()).eq('active',true).maybeSingle();if(['admin','finance'].includes(String(data?.role||'')))return String(data.role)}return ''}
function effective(row:any){return row&&['succeeded','partially_refunded'].includes(String(row.status))?Math.max(0,Number(row.amount_cents||0)-Number(row.refunded_amount_cents||0)-Number(row.platform_fee_cents||0)):0}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return json({error:'Method not allowed'},405)
 try{
  const auth=req.headers.get('authorization')||'';const token=auth.startsWith('Bearer ')?auth.slice(7):''
  const {data:{user},error:userError}=await scoped(auth).auth.getUser(token);if(userError||!user)return json({error:'Authentication required'},401)
  const db=admin();const role=await financeRole(db,user);if(!role)return json({error:'Mission 365 finance authorization required'},403)
  const body=await req.json();const donationId=String(body?.donationId||'');const reason=String(body?.reason||'requested_by_customer')
  if(!donationId)return json({error:'donationId is required'},400)
  if(!['duplicate','fraudulent','requested_by_customer'].includes(reason))return json({error:'Invalid refund reason'},400)
  const {data:donation,error:donationError}=await db.from('mission365_donations').select('*').eq('id',donationId).maybeSingle();if(donationError||!donation)return json({error:'Donation not found'},404)
  if(!['succeeded','partially_refunded'].includes(String(donation.status)))return json({error:'Only succeeded or partially refunded donations can be refunded.'},409)
  if(!donation.stripe_payment_intent_id)return json({error:'Donation has no Stripe PaymentIntent to refund.'},409)
  const remaining=Math.max(0,Number(donation.amount_cents)-Number(donation.refunded_amount_cents||0));if(remaining<1)return json({error:'Donation is already fully refunded.'},409)
  const amount=body?.amountCents===undefined||body?.amountCents===null?remaining:Number(body.amountCents)
  if(!Number.isInteger(amount)||amount<1||amount>remaining)return json({error:'Refund amount exceeds the remaining refundable amount.',remainingCents:remaining},400)
  const newRefunded=Number(donation.refunded_amount_cents||0)+amount
  if(String(donation.settlement_mode||'mission_payout')==='mission_payout'){
    const [{data:missionDonations},{data:payouts}]=await Promise.all([
      db.from('mission365_donations').select('id,amount_cents,refunded_amount_cents,platform_fee_cents,status').eq('mission_id',donation.mission_id).eq('settlement_mode','mission_payout').in('status',['succeeded','partially_refunded']),
      db.from('mission365_payouts').select('amount_cents,status').eq('mission_id',donation.mission_id).in('status',['pending_review','approved','processing','paid'])
    ])
    const currentProceeds=(missionDonations||[]).reduce((sum:number,row:any)=>sum+effective(row),0)
    const currentDonationEffective=effective(donation)
    const newGross=Math.max(0,Number(donation.amount_cents)-newRefunded)
    const newFee=Math.floor(newGross*500/10000)
    const newDonationEffective=Math.max(0,newGross-newFee)
    const postRefundProceeds=currentProceeds-currentDonationEffective+newDonationEffective
    const reserved=(payouts||[]).reduce((sum:number,row:any)=>sum+Number(row.amount_cents||0),0)
    if(postRefundProceeds<reserved)return json({error:'Refund would underfund Mission Owner payouts already requested, approved, processing, or paid. Reverse/cancel sufficient payouts first.',shortfallCents:reserved-postRefundProceeds,postRefundProceedsCents:Math.max(0,postRefundProceeds),reservedPayoutsCents:reserved},409)
  }
  const key=await stripeSecret(db);if(!key||key.startsWith('REPLACE_WITH_'))return json({error:'Refunds are credential-gated until the Mission 365 restricted Stripe API key is installed.'},503)
  const params=new URLSearchParams();params.set('payment_intent',String(donation.stripe_payment_intent_id));params.set('amount',String(amount));params.set('reason',reason);params.set('metadata[mission365_donation_id]',donation.id);params.set('metadata[mission365_mission_id]',donation.mission_id)
  const vendorDirect=String(donation.settlement_mode||'mission_payout')==='vendor_direct'
  if(vendorDirect){params.set('reverse_transfer','true');params.set('refund_application_fee','true')}
  const response=await fetch('https://api.stripe.com/v1/refunds',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Stripe-Version':'2026-06-24.dahlia','Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`m365-refund-${donation.id}-${newRefunded}`},body:params.toString()})
  const refund=await response.json();if(!response.ok)throw new Error(refund?.error?.message||'Stripe refund failed')
  await db.from('mission365_audit_log').insert({actor_user_id:user.id,action:'donation.refund.requested',entity_type:'donation',entity_id:donation.id,before_state:{status:donation.status,refunded_amount_cents:donation.refunded_amount_cents||0},after_state:{requested_refund_amount_cents:amount,expected_refunded_total_cents:newRefunded},metadata:{stripe_refund_id:refund.id,reason,settlement_mode:donation.settlement_mode||'mission_payout',reverse_transfer:vendorDirect,refund_application_fee:vendorDirect,mission_id:donation.mission_id}})
  return json({refundId:refund.id,status:refund.status,amountCents:amount,expectedRefundedTotalCents:newRefunded,settlementMode:donation.settlement_mode||'mission_payout',vendorTransferReversalRequested:vendorDirect})
 }catch(error){console.error('mission365 refund failed',error);return json({error:error instanceof Error?error.message:'Refund failed'},500)}
})
