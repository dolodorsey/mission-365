import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
}
function publicKey(){const modern=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_ANON_KEY')!}
function secretKey(){const modern=Deno.env.get('SUPABASE_SECRET_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}
function adminClient(){return createClient(Deno.env.get('SUPABASE_URL')!,secretKey(),{auth:{persistSession:false,autoRefreshToken:false}})}
function userClient(auth:string){return createClient(Deno.env.get('SUPABASE_URL')!,publicKey(),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}})}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers:corsHeaders})
  try{
    const auth=req.headers.get('authorization')||''
    const token=auth.startsWith('Bearer ')?auth.slice(7):''
    const scoped=userClient(auth)
    const {data:{user},error:userError}=await scoped.auth.getUser(token)
    if(userError||!user)return Response.json({error:'Authentication required'},{status:401,headers:corsHeaders})
    const role=String(user.app_metadata?.mission365_role||'donor')
    if(!['admin','finance'].includes(role))return Response.json({error:'Mission 365 finance authorization required'},{status:403,headers:corsHeaders})

    const {payoutId}=await req.json()
    if(!payoutId)return Response.json({error:'payoutId is required'},{status:400,headers:corsHeaders})
    const admin=adminClient()
    let stripeSecret=Deno.env.get('STRIPE_SECRET_KEY')||''
    if(!stripeSecret){const {data}=await admin.rpc('mission365_get_runtime_secret',{secret_name:'stripe_api_key'});stripeSecret=String(data||'')}
    if(!stripeSecret||stripeSecret.startsWith('REPLACE_WITH_'))return Response.json({error:'Mission 365 payouts are not activated yet'},{status:503,headers:corsHeaders})

    const {data:payout,error:payoutError}=await admin.from('mission365_payouts').select('id,mission_id,organization_id,amount_cents,currency,status').eq('id',payoutId).single()
    if(payoutError||!payout)return Response.json({error:'Payout not found'},{status:404,headers:corsHeaders})
    if(payout.status!=='approved')return Response.json({error:'Payout must be approved before release'},{status:409,headers:corsHeaders})
    const {data:account}=await admin.from('mission365_payout_accounts').select('stripe_account_id').eq('organization_id',payout.organization_id).single()
    if(!account?.stripe_account_id)return Response.json({error:'Mission owner has no connected payout account'},{status:409,headers:corsHeaders})

    const accountResponse=await fetch(`https://api.stripe.com/v2/core/accounts/${account.stripe_account_id}`,{headers:{Authorization:`Bearer ${stripeSecret}`,'Stripe-Version':'2026-06-24.dahlia'}})
    const connected=await accountResponse.json()
    if(!accountResponse.ok)throw new Error(connected?.error?.message||'Connected account check failed')
    const transferStatus=connected?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status
    await admin.from('mission365_payout_accounts').update({transfers_status:transferStatus==='active'?'active':'restricted',last_checked_at:new Date().toISOString()}).eq('organization_id',payout.organization_id)
    if(transferStatus!=='active')return Response.json({error:'Connected account is not transfer-ready'},{status:409,headers:corsHeaders})

    const {data:donations}=await admin.from('mission365_donations').select('amount_cents,platform_fee_cents').eq('mission_id',payout.mission_id).eq('status','succeeded')
    const {data:prior}=await admin.from('mission365_payouts').select('amount_cents').eq('mission_id',payout.mission_id).in('status',['approved','processing','paid']).neq('id',payout.id)
    const available=(donations||[]).reduce((sum,row)=>sum+Number(row.amount_cents)-Number(row.platform_fee_cents),0)-(prior||[]).reduce((sum,row)=>sum+Number(row.amount_cents),0)
    if(Number(payout.amount_cents)>available)return Response.json({error:'Payout exceeds cleared mission proceeds',availableCents:Math.max(0,available)},{status:409,headers:corsHeaders})

    await admin.from('mission365_payouts').update({status:'processing'}).eq('id',payout.id).eq('status','approved')
    const params=new URLSearchParams({amount:String(payout.amount_cents),currency:String(payout.currency||'usd'),destination:account.stripe_account_id,transfer_group:`mission365_${payout.mission_id}`})
    params.set('metadata[payout_id]',payout.id);params.set('metadata[mission_id]',payout.mission_id)
    const transferResponse=await fetch('https://api.stripe.com/v1/transfers',{method:'POST',headers:{Authorization:`Bearer ${stripeSecret}`,'Stripe-Version':'2026-06-24.dahlia','Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`mission365-payout-${payout.id}`},body:params.toString()})
    const transfer=await transferResponse.json()
    if(!transferResponse.ok){await admin.from('mission365_payouts').update({status:'failed',failure_reason:transfer?.error?.message||'Stripe transfer failed'}).eq('id',payout.id);throw new Error(transfer?.error?.message||'Stripe transfer failed')}
    await admin.from('mission365_payouts').update({status:'paid',stripe_transfer_id:transfer.id,updated_at:new Date().toISOString()}).eq('id',payout.id)
    await admin.from('mission365_audit_log').insert({actor_user_id:user.id,action:'payout.released',entity_type:'payout',entity_id:payout.id,after_state:{status:'paid',stripe_transfer_id:transfer.id},metadata:{mission_id:payout.mission_id,organization_id:payout.organization_id}})
    return Response.json({released:true,transferId:transfer.id},{headers:corsHeaders})
  }catch(error){console.error('mission365 payout release failed',error);return Response.json({error:error instanceof Error?error.message:'Payout release failed'},{status:500,headers:corsHeaders})}
})
