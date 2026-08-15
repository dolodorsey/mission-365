import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'cache-control':'no-store'}})
function publicKey(){const modern=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_ANON_KEY')!}
function secretKey(){const modern=Deno.env.get('SUPABASE_SECRET_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}
function adminClient(){return createClient(Deno.env.get('SUPABASE_URL')!,secretKey(),{auth:{persistSession:false,autoRefreshToken:false}})}
function scopedClient(auth:string){return createClient(Deno.env.get('SUPABASE_URL')!,publicKey(),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}})}
async function stripeSecret(db:any){let key=Deno.env.get('STRIPE_SECRET_KEY')||'';if(!key){const {data}=await db.rpc('mission365_get_runtime_secret',{secret_name:'stripe_api_key'});key=String(data||'')}return key}
async function requireUser(req:Request){const auth=req.headers.get('authorization')||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';if(!token)return {error:json({error:'Authentication required'},401)};const {data:{user},error}=await scopedClient(auth).auth.getUser(token);if(error||!user)return {error:json({error:'Invalid session'},401)};return {user,auth}}
async function roleFor(db:any,userId:string,organizationId:string){const {data}=await db.from('mission365_organization_members').select('member_role').eq('user_id',userId).eq('organization_id',organizationId).maybeSingle();return data?.member_role||null}
async function requireManager(db:any,userId:string,organizationId:string){const role=await roleFor(db,userId,organizationId);if(!['owner','manager'].includes(role||''))throw new Error('Organization owner or manager access required')}
function transferStatus(account:any){return String(account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status||'inactive')}
function requirements(account:any){return account?.requirements?.entries||account?.requirements?.currently_due||account?.requirements||[]}
function cleanUrl(value:unknown){const text=String(value||'').trim();if(!text)return null;try{const u=new URL(text);return ['http:','https:'].includes(u.protocol)?u.toString():null}catch{return null}}
function dollars(cents:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100)}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  try{
    const authResult=await requireUser(req)
    if('error' in authResult)return authResult.error
    const user=authResult.user!
    const db=adminClient()
    const body=await req.json()
    const action=String(body?.action||'')

    if(action==='portal'){
      const {data:memberships}=await db.from('mission365_organization_members').select('organization_id,member_role').eq('user_id',user.id)
      const allowed=(memberships||[]).filter((m:any)=>['owner','manager'].includes(m.member_role)).map((m:any)=>m.organization_id)
      if(!allowed.length)return json({vendors:[],items:[]})
      const [{data:vendors,error:vendorError},{data:missions,error:missionError}]=await Promise.all([
        db.from('mission365_registry_vendors').select('id,organization_id,public_name,contact_email,website_url,onboarding_status,transfers_status,requirements_due,created_at,updated_at').in('organization_id',allowed).order('created_at',{ascending:false}),
        db.from('mission365_missions').select('id,organization_id,title,status,slug').in('organization_id',allowed)
      ])
      if(vendorError)throw vendorError;if(missionError)throw missionError
      const missionIds=(missions||[]).map((m:any)=>m.id)
      const {data:items,error:itemError}=missionIds.length?await db.from('mission365_registry_items').select('*').in('mission_id',missionIds).order('sort_order',{ascending:true}).order('created_at',{ascending:true}):{data:[],error:null}
      if(itemError)throw itemError
      return json({vendors:vendors||[],items:items||[],missions:missions||[]})
    }

    if(action==='save_vendor'){
      const organizationId=String(body?.organizationId||'')
      if(!organizationId)return json({error:'organizationId is required'},400)
      await requireManager(db,user.id,organizationId)
      const vendor=body?.vendor||{}
      const publicName=String(vendor.publicName||vendor.public_name||'').trim()
      const contactEmail=String(vendor.contactEmail||vendor.contact_email||'').trim().toLowerCase()||null
      if(publicName.length<2)return json({error:'Vendor name is required'},400)
      if(contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))return json({error:'Enter a valid vendor email'},400)
      const websiteUrl=cleanUrl(vendor.websiteUrl||vendor.website_url)
      const id=vendor.id?String(vendor.id):crypto.randomUUID()
      if(vendor.id){const {data:existing}=await db.from('mission365_registry_vendors').select('organization_id').eq('id',id).maybeSingle();if(!existing||existing.organization_id!==organizationId)return json({error:'Vendor not found'},404)}
      const {data:saved,error}=await db.from('mission365_registry_vendors').upsert({id,organization_id:organizationId,public_name:publicName,contact_email:contactEmail,website_url:websiteUrl,created_by:user.id,updated_at:new Date().toISOString()},{onConflict:'id'}).select('id,organization_id,public_name,contact_email,website_url,onboarding_status,transfers_status,requirements_due,created_at,updated_at').single()
      if(error)throw error
      await db.from('mission365_audit_log').insert({actor_user_id:user.id,action:'registry.vendor.saved',entity_type:'registry_vendor',entity_id:id,after_state:{organization_id:organizationId,public_name:publicName,onboarding_status:saved.onboarding_status},metadata:{}})
      return json({vendor:saved})
    }

    if(action==='start_vendor_onboarding'||action==='refresh_vendor'){
      const organizationId=String(body?.organizationId||'')
      const vendorId=String(body?.vendorId||'')
      if(!organizationId||!vendorId)return json({error:'organizationId and vendorId are required'},400)
      await requireManager(db,user.id,organizationId)
      const [{data:org},{data:vendor}]=await Promise.all([
        db.from('mission365_organizations').select('verification_status').eq('id',organizationId).maybeSingle(),
        db.from('mission365_registry_vendors').select('*').eq('id',vendorId).eq('organization_id',organizationId).maybeSingle()
      ])
      if(!vendor)return json({error:'Vendor not found'},404)
      if(org?.verification_status!=='verified')return json({error:'Mission owner organization must be verified before vendor onboarding.'},409)
      const key=await stripeSecret(db)
      if(!key||key.startsWith('REPLACE_WITH_'))return json({error:'Stripe Connect is not configured.'},503)
      let accountId=vendor.stripe_account_id as string|null
      if(action==='start_vendor_onboarding'&&!accountId){
        if(!vendor.contact_email)return json({error:'Add a vendor contact email before onboarding.'},409)
        const payload={contact_email:vendor.contact_email,display_name:vendor.public_name,defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},dashboard:'express',identity:{country:'us',business_details:{registered_name:vendor.public_name}},configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},include:['configuration.recipient','identity','requirements']}
        const response=await fetch('https://api.stripe.com/v2/core/accounts',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Stripe-Version':'2026-06-24.preview','Content-Type':'application/json','Idempotency-Key':`m365-registry-vendor-${vendorId}`},body:JSON.stringify(payload)})
        const account=await response.json();if(!response.ok)throw new Error(account?.error?.message||'Vendor Stripe account creation failed')
        accountId=account.id
        const status=transferStatus(account),due=requirements(account)
        await db.from('mission365_registry_vendors').update({stripe_account_id:accountId,onboarding_status:status==='active'?'ready':'pending',transfers_status:status==='active'?'active':'restricted',requirements_due:due,updated_at:new Date().toISOString()}).eq('id',vendorId)
        await db.from('mission365_audit_log').insert({actor_user_id:user.id,action:'registry.vendor.connect_created',entity_type:'registry_vendor',entity_id:vendorId,after_state:{stripe_account_id:accountId,transfers_status:status},metadata:{}})
      }
      if(!accountId)return json({error:'No Stripe account exists for this vendor.'},409)
      if(action==='refresh_vendor'){
        const response=await fetch(`https://api.stripe.com/v2/core/accounts/${encodeURIComponent(accountId)}?include[]=configuration.recipient&include[]=identity&include[]=requirements`,{headers:{Authorization:`Bearer ${key}`,'Stripe-Version':'2026-06-24.preview'}})
        const account=await response.json();if(!response.ok)throw new Error(account?.error?.message||'Vendor Stripe account refresh failed')
        const status=transferStatus(account),due=requirements(account)
        const onboarding=status==='active'?'ready':(Array.isArray(due)&&due.length?'requirements_due':'pending')
        const {data:saved,error}=await db.from('mission365_registry_vendors').update({onboarding_status:onboarding,transfers_status:status==='active'?'active':'restricted',requirements_due:due,updated_at:new Date().toISOString()}).eq('id',vendorId).select('id,organization_id,public_name,contact_email,website_url,onboarding_status,transfers_status,requirements_due,created_at,updated_at').single();if(error)throw error
        return json({vendor:saved})
      }
      const params=new URLSearchParams();params.set('account',accountId);params.set('refresh_url',`https://mission-365.vercel.app/app/mission-owner?registry_vendor=${encodeURIComponent(vendorId)}&connect=refresh`);params.set('return_url',`https://mission-365.vercel.app/app/mission-owner?registry_vendor=${encodeURIComponent(vendorId)}&connect=return`);params.set('type','account_onboarding')
      const response=await fetch('https://api.stripe.com/v1/account_links',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Stripe-Version':'2026-06-24.dahlia','Content-Type':'application/x-www-form-urlencoded'},body:params.toString()})
      const link=await response.json();if(!response.ok)throw new Error(link?.error?.message||'Vendor onboarding link creation failed')
      return json({url:link.url,expiresAt:link.expires_at,vendorId})
    }

    if(action==='save_item'||action==='publish_item'||action==='pause_item'){
      const organizationId=String(body?.organizationId||'')
      if(!organizationId)return json({error:'organizationId is required'},400)
      await requireManager(db,user.id,organizationId)
      if(action==='save_item'){
        const missionId=String(body?.missionId||'')
        const item=body?.item||{}
        const {data:mission}=await db.from('mission365_missions').select('id,organization_id,status').eq('id',missionId).maybeSingle()
        if(!mission||mission.organization_id!==organizationId)return json({error:'Mission not found for this organization'},404)
        const title=String(item.title||'').trim(),description=String(item.description||'').trim(),category=String(item.category||'Other').trim()||'Other'
        const target=Number(item.targetAmountCents||item.target_amount_cents||0)
        if(title.length<3||description.length<5)return json({error:'Add a title and short description.'},400)
        if(!Number.isInteger(target)||target<100)return json({error:'Registry item target must be at least $1.'},400)
        const settlementMode=item.settlementMode==='vendor_direct'?'vendor_direct':'mission_payout'
        let vendor:any=null
        const vendorId=item.vendorId?String(item.vendorId):null
        if(settlementMode==='vendor_direct'){
          if(!vendorId)return json({error:'Choose a vendor for direct vendor payment.'},400)
          const result=await db.from('mission365_registry_vendors').select('*').eq('id',vendorId).eq('organization_id',organizationId).maybeSingle();vendor=result.data
          if(!vendor)return json({error:'Vendor not found'},404)
        }
        let ready=false
        if(settlementMode==='vendor_direct')ready=vendor?.onboarding_status==='ready'&&vendor?.transfers_status==='active'&&Boolean(vendor?.stripe_account_id)
        else{const {data:payout}=await db.from('mission365_payout_accounts').select('onboarding_status,transfers_status').eq('organization_id',organizationId).maybeSingle();ready=payout?.onboarding_status==='ready'&&payout?.transfers_status==='active'}
        const id=item.id?String(item.id):crypto.randomUUID()
        if(item.id){const {data:existing}=await db.from('mission365_registry_items').select('mission_id').eq('id',id).maybeSingle();if(!existing)return json({error:'Registry item not found'},404);const {data:existingMission}=await db.from('mission365_missions').select('organization_id').eq('id',existing.mission_id).maybeSingle();if(existingMission?.organization_id!==organizationId)return json({error:'Registry item not found'},404)}
        const dueDate=item.dueDate||item.due_date||null
        const {data:saved,error}=await db.from('mission365_registry_items').upsert({id,mission_id:missionId,vendor_id:vendorId,title,description,category,target_amount_cents:target,allow_partial:item.allowPartial!==false,settlement_mode:settlementMode,vendor_name:vendor?.public_name||null,vendor_website_url:vendor?.website_url||null,status:ready?'open':'draft',due_date:dueDate||null,sort_order:Number.isInteger(Number(item.sortOrder))?Number(item.sortOrder):0,created_by:user.id,updated_at:new Date().toISOString()},{onConflict:'id'}).select('*').single();if(error)throw error
        await db.from('mission365_audit_log').insert({actor_user_id:user.id,action:'registry.item.saved',entity_type:'registry_item',entity_id:id,after_state:{mission_id:missionId,title,status:saved.status,settlement_mode:settlementMode,target_amount_cents:target},metadata:{}})
        return json({item:saved,paymentReady:ready})
      }
      const itemId=String(body?.itemId||'')
      const {data:item}=await db.from('mission365_registry_items').select('*,mission365_missions!inner(organization_id)').eq('id',itemId).maybeSingle()
      if(!item||item.mission365_missions?.organization_id!==organizationId)return json({error:'Registry item not found'},404)
      if(action==='pause_item'){
        const {data:saved,error}=await db.from('mission365_registry_items').update({status:'paused',updated_at:new Date().toISOString()}).eq('id',itemId).select('*').single();if(error)throw error;return json({item:saved})
      }
      let ready=false
      if(item.settlement_mode==='vendor_direct'){
        const {data:vendor}=await db.from('mission365_registry_vendors').select('stripe_account_id,onboarding_status,transfers_status').eq('id',item.vendor_id).maybeSingle();ready=vendor?.onboarding_status==='ready'&&vendor?.transfers_status==='active'&&Boolean(vendor?.stripe_account_id)
      }else{
        const {data:payout}=await db.from('mission365_payout_accounts').select('onboarding_status,transfers_status').eq('organization_id',organizationId).maybeSingle();ready=payout?.onboarding_status==='ready'&&payout?.transfers_status==='active'
      }
      if(!ready)return json({error:'Payment destination is not payout-ready yet.'},409)
      const next=Number(item.funded_amount_cents)>=Number(item.target_amount_cents)?'fulfilled':Number(item.funded_amount_cents)>0?'partially_funded':'open'
      const {data:saved,error}=await db.from('mission365_registry_items').update({status:next,updated_at:new Date().toISOString()}).eq('id',itemId).select('*').single();if(error)throw error
      return json({item:saved})
    }

    if(action==='checkout_item'){
      const itemId=String(body?.itemId||'')
      const requested=Number(body?.amountCents||0)
      if(!itemId)return json({error:'Registry item is required'},400)
      const {data:rateOk,error:rateError}=await db.rpc('mission365_consume_rate_limit',{p_bucket:'registry_checkout',p_subject:user.id,p_limit:12,p_window_seconds:3600});if(rateError)throw rateError;if(!rateOk)return json({error:'Too many checkout attempts. Please try again later.'},429)
      const {data:terms}=await db.from('mission365_terms_acceptances').select('id').eq('user_id',user.id).eq('document_key','donor_terms').eq('version','2026-08-08').maybeSingle();if(!terms)return json({error:'Please accept the current Mission 365 donor terms before giving.'},428)
      const {data:item,error:itemError}=await db.from('mission365_registry_items').select('*').eq('id',itemId).single();if(itemError||!item||!['open','partially_funded'].includes(item.status))return json({error:'This registry item is not currently accepting sponsorships.'},409)
      const {data:mission}=await db.from('mission365_missions').select('id,title,slug,status,published_at,organization_id').eq('id',item.mission_id).maybeSingle();if(!mission||!['published','funded','reporting'].includes(mission.status)||!mission.published_at)return json({error:'This mission is not open for verified giving.'},409)
      const [{data:org},{count:riskCount},{data:pendingRows}]=await Promise.all([
        db.from('mission365_organizations').select('verification_status').eq('id',mission.organization_id).maybeSingle(),
        db.from('mission365_risk_events').select('id',{count:'exact',head:true}).eq('mission_id',mission.id).eq('status','open').in('severity',['high','critical']),
        db.from('mission365_donations').select('amount_cents,created_at').eq('registry_item_id',itemId).eq('status','pending')
      ])
      if(org?.verification_status!=='verified')return json({error:'Giving is paused until the mission owner remains verified.'},409)
      if(riskCount)return json({error:'Giving is temporarily paused while a risk review is open.'},423)
      const cutoff=Date.now()-2*60*60*1000
      const reserved=(pendingRows||[]).filter((r:any)=>new Date(r.created_at).getTime()>cutoff).reduce((n:number,r:any)=>n+Number(r.amount_cents||0),0)
      const remaining=Math.max(0,Number(item.target_amount_cents)-Number(item.funded_amount_cents)-reserved)
      if(remaining<100)return json({error:'This registry item is fully funded or currently reserved in checkout.'},409)
      const amount=item.allow_partial?requested:remaining
      if(!Number.isInteger(amount)||amount<100||amount>remaining)return json({error:`Choose an amount between $1 and ${dollars(remaining)}.`},400)
      if(!item.allow_partial&&requested!==remaining)return json({error:'This item must be funded in full.'},409)
      let destination:string|null=null
      if(item.settlement_mode==='vendor_direct'){
        const {data:vendor}=await db.from('mission365_registry_vendors').select('stripe_account_id,onboarding_status,transfers_status,public_name').eq('id',item.vendor_id).maybeSingle()
        if(!vendor||vendor.onboarding_status!=='ready'||vendor.transfers_status!=='active'||!vendor.stripe_account_id)return json({error:'Direct vendor payment is not payout-ready yet.'},409)
        destination=vendor.stripe_account_id
      }else{
        const {data:payout}=await db.from('mission365_payout_accounts').select('onboarding_status,transfers_status').eq('organization_id',mission.organization_id).maybeSingle();if(payout?.onboarding_status!=='ready'||payout?.transfers_status!=='active')return json({error:'Mission payout destination is not ready yet.'},409)
      }
      const key=await stripeSecret(db);if(!key||key.startsWith('REPLACE_WITH_'))return json({error:'Mission 365 giving is not activated yet.'},503)
      const givingPlanId=crypto.randomUUID(),donationId=crypto.randomUUID(),idempotencyKey=crypto.randomUUID(),platformFeeCents=Math.floor(amount*500/10000)
      const {error:planError}=await db.from('mission365_giving_plans').insert({id:givingPlanId,donor_user_id:user.id,mission_id:mission.id,amount_cents:amount,cadence:'one_time',status:'pending'});if(planError)throw planError
      const {error:donationError}=await db.from('mission365_donations').insert({id:donationId,giving_plan_id:givingPlanId,donor_user_id:user.id,mission_id:mission.id,registry_item_id:item.id,registry_vendor_id:item.vendor_id||null,settlement_mode:item.settlement_mode,stripe_destination_account_id:destination,amount_cents:amount,platform_fee_cents:platformFeeCents,refunded_amount_cents:0,currency:'usd',status:'pending',idempotency_key:idempotencyKey});if(donationError)throw donationError
      try{
        const {data:priorCustomer}=await db.from('mission365_giving_plans').select('stripe_customer_id').eq('donor_user_id',user.id).not('stripe_customer_id','is',null).order('created_at',{ascending:false}).limit(1).maybeSingle()
        const params=new URLSearchParams();params.set('mode','payment');params.set('success_url','https://mission-365.vercel.app/app/donor?checkout=success&session_id={CHECKOUT_SESSION_ID}');params.set('cancel_url',`https://mission-365.vercel.app/missions/${encodeURIComponent(mission.slug)}?checkout=cancelled`);if(priorCustomer?.stripe_customer_id)params.set('customer',priorCustomer.stripe_customer_id);else if(user.email)params.set('customer_email',user.email);params.set('line_items[0][quantity]','1');params.set('line_items[0][price_data][currency]','usd');params.set('line_items[0][price_data][unit_amount]',String(amount));params.set('line_items[0][price_data][product_data][name]',`Mission 365 Registry — ${item.title}`);params.set('line_items[0][price_data][product_data][description]',String(item.vendor_name?`Paid toward ${item.vendor_name}`:`Paid toward ${mission.title}`).slice(0,500));params.set('metadata[mission_id]',mission.id);params.set('metadata[donor_user_id]',user.id);params.set('metadata[giving_plan_id]',givingPlanId);params.set('metadata[donation_id]',donationId);params.set('metadata[registry_item_id]',item.id);if(item.vendor_id)params.set('metadata[registry_vendor_id]',item.vendor_id);params.set('metadata[settlement_mode]',item.settlement_mode);params.set('integration_identifier','mission365_registry_v1');params.set('payment_intent_data[metadata][mission_id]',mission.id);params.set('payment_intent_data[metadata][donor_user_id]',user.id);params.set('payment_intent_data[metadata][giving_plan_id]',givingPlanId);params.set('payment_intent_data[metadata][donation_id]',donationId);params.set('payment_intent_data[metadata][registry_item_id]',item.id);if(item.vendor_id)params.set('payment_intent_data[metadata][registry_vendor_id]',item.vendor_id);params.set('payment_intent_data[metadata][settlement_mode]',item.settlement_mode);if(destination){params.set('payment_intent_data[transfer_data][destination]',destination);params.set('payment_intent_data[application_fee_amount]',String(platformFeeCents))}
        const stripeResponse=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Stripe-Version':'2026-06-24.dahlia','Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`mission365-registry-${idempotencyKey}`},body:params.toString()});const session=await stripeResponse.json();if(!stripeResponse.ok)throw new Error(session?.error?.message||'Stripe checkout creation failed')
        await Promise.all([db.from('mission365_giving_plans').update({stripe_checkout_session_id:session.id,stripe_customer_id:typeof session.customer==='string'?session.customer:null}).eq('id',givingPlanId),db.from('mission365_donations').update({stripe_checkout_session_id:session.id}).eq('id',donationId)])
        return json({checkoutUrl:session.url,sessionId:session.id,amountCents:amount,settlementMode:item.settlement_mode})
      }catch(error){await db.from('mission365_donations').update({status:'failed'}).eq('id',donationId).eq('status','pending');await db.from('mission365_giving_plans').update({status:'cancelled'}).eq('id',givingPlanId).eq('status','pending');throw error}
    }

    return json({error:'Unsupported action'},400)
  }catch(error){console.error('mission365 registry failed',error);return json({error:error instanceof Error?error.message:'Registry request failed'},500)}
})
