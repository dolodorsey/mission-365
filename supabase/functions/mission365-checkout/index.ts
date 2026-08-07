import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function publicKey(){
  const modern = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  return modern ? JSON.parse(modern).default : Deno.env.get('SUPABASE_ANON_KEY')!
}
function secretKey(){
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS')
  return modern ? JSON.parse(modern).default : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
}
function adminClient(){ return createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), { auth:{persistSession:false,autoRefreshToken:false} }) }
function userClient(auth:string){ return createClient(Deno.env.get('SUPABASE_URL')!, publicKey(), { auth:{persistSession:false,autoRefreshToken:false}, global:{headers:{Authorization:auth}} }) }

Deno.serve(async (req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST') return Response.json({error:'Method not allowed'},{status:405,headers:corsHeaders})
  try{
    const auth=req.headers.get('authorization')||''
    const token=auth.startsWith('Bearer ')?auth.slice(7):''
    if(!token) return Response.json({error:'Authentication required'},{status:401,headers:corsHeaders})
    const userScoped=userClient(auth)
    const {data:{user},error:userError}=await userScoped.auth.getUser(token)
    if(userError||!user) return Response.json({error:'Invalid session'},{status:401,headers:corsHeaders})

    const {missionId,amountCents,cadence='one_time'}=await req.json()
    if(!missionId||!Number.isInteger(amountCents)||amountCents<100) return Response.json({error:'A valid mission and amount of at least $1 are required'},{status:400,headers:corsHeaders})
    if(!['one_time','monthly'].includes(cadence)) return Response.json({error:'Unsupported giving cadence'},{status:400,headers:corsHeaders})

    const admin=adminClient()
    const {data:mission,error:missionError}=await admin.from('mission365_missions').select('id,title,status,published_at').eq('id',missionId).single()
    if(missionError||!mission||!['published','funded','reporting'].includes(mission.status)||!mission.published_at) return Response.json({error:'This mission is not currently open for verified giving'},{status:409,headers:corsHeaders})

    const {data:stripeSecret,error:secretError}=await admin.rpc('mission365_get_runtime_secret',{secret_name:'stripe_api_key'})
    if(secretError||!stripeSecret||String(stripeSecret).startsWith('REPLACE_WITH_')) return Response.json({error:'Mission 365 giving is not activated yet'},{status:503,headers:corsHeaders})

    const givingPlanId=crypto.randomUUID(); const donationId=crypto.randomUUID(); const idempotencyKey=crypto.randomUUID()
    const platformFeeBps=500; const platformFeeCents=Math.floor(amountCents*platformFeeBps/10000)
    const {error:planError}=await admin.from('mission365_giving_plans').insert({id:givingPlanId,donor_user_id:user.id,mission_id:missionId,amount_cents:amountCents,cadence,status:'pending'})
    if(planError) throw planError
    const {error:donationError}=await admin.from('mission365_donations').insert({id:donationId,giving_plan_id:givingPlanId,donor_user_id:user.id,mission_id:missionId,amount_cents:amountCents,platform_fee_cents:platformFeeCents,currency:'usd',status:'pending',idempotency_key:idempotencyKey})
    if(donationError) throw donationError

    const params=new URLSearchParams()
    params.set('mode',cadence==='monthly'?'subscription':'payment')
    params.set('success_url','https://mission-365.vercel.app/app/donor?checkout=success&session_id={CHECKOUT_SESSION_ID}')
    params.set('cancel_url','https://mission-365.vercel.app/missions?checkout=cancelled')
    if(user.email) params.set('customer_email',user.email)
    params.set('line_items[0][quantity]','1')
    params.set('line_items[0][price_data][currency]','usd')
    params.set('line_items[0][price_data][unit_amount]',String(amountCents))
    params.set('line_items[0][price_data][product_data][name]',`Mission 365 — ${mission.title}`)
    if(cadence==='monthly') params.set('line_items[0][price_data][recurring][interval]','month')
    params.set('metadata[mission_id]',missionId); params.set('metadata[donor_user_id]',user.id); params.set('metadata[giving_plan_id]',givingPlanId); params.set('metadata[donation_id]',donationId)
    params.set('integration_identifier','mission365_giving_qrstuvwx')
    if(cadence==='monthly'){
      params.set('subscription_data[metadata][mission_id]',missionId); params.set('subscription_data[metadata][donor_user_id]',user.id); params.set('subscription_data[metadata][giving_plan_id]',givingPlanId)
    }else{
      params.set('payment_intent_data[metadata][mission_id]',missionId); params.set('payment_intent_data[metadata][donor_user_id]',user.id); params.set('payment_intent_data[metadata][giving_plan_id]',givingPlanId); params.set('payment_intent_data[metadata][donation_id]',donationId)
    }

    const stripeResponse=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${stripeSecret}`,'Stripe-Version':'2026-06-24.dahlia','Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`mission365-checkout-${idempotencyKey}`},body:params.toString()})
    const session=await stripeResponse.json()
    if(!stripeResponse.ok) throw new Error(session?.error?.message||'Stripe checkout creation failed')
    await admin.from('mission365_giving_plans').update({stripe_checkout_session_id:session.id}).eq('id',givingPlanId)
    await admin.from('mission365_donations').update({stripe_checkout_session_id:session.id}).eq('id',donationId)
    return Response.json({checkoutUrl:session.url,sessionId:session.id},{headers:corsHeaders})
  }catch(error){
    console.error('mission365 checkout failed',error)
    return Response.json({error:error instanceof Error?error.message:'Checkout failed'},{status:500,headers:corsHeaders})
  }
})
