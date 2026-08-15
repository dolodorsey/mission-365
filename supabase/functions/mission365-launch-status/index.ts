import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

function secretKey(){
  const modern=Deno.env.get('SUPABASE_SECRET_KEYS')
  return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
}
function admin(){return createClient(Deno.env.get('SUPABASE_URL')!,secretKey(),{auth:{persistSession:false,autoRefreshToken:false}})}

Deno.serve(async(req:Request)=>{
  if(req.method!=='GET') return Response.json({error:'Method not allowed'},{status:405})
  const db=admin()
  const [orgs,apps,missions,payouts,qa,webhook,vaultStripe]=await Promise.all([
    db.from('mission365_organizations').select('id',{count:'exact',head:true}).in('verification_status',['pending','under_review']),
    db.from('mission365_applications').select('id',{count:'exact',head:true}).in('status',['submitted','under_review','needs_information']),
    db.from('mission365_missions').select('id',{count:'exact',head:true}).in('status',['published','funded','reporting']),
    db.from('mission365_payouts').select('id',{count:'exact',head:true}).in('status',['pending_review','approved','processing']),
    db.from('mission365_audit_log').select('action,after_state,created_at').eq('entity_type','platform').eq('entity_id','production').order('created_at',{ascending:false}).limit(6),
    db.rpc('mission365_get_runtime_secret',{secret_name:'stripe_webhook_secret'}),
    db.rpc('mission365_get_runtime_secret',{secret_name:'stripe_api_key'})
  ])
  const envStripe=String(Deno.env.get('STRIPE_SECRET_KEY')||'')
  const vaultStripeKey=String(vaultStripe.data||'')
  const stripeApi=Boolean((envStripe&&!envStripe.startsWith('REPLACE_WITH_'))||(vaultStripeKey&&!vaultStripeKey.startsWith('REPLACE_WITH_')))
  const webhookReady=Boolean(webhook.data)
  return Response.json({
    service:'mission-365',
    verificationCandidates:orgs.count||0,
    applicationsInReview:apps.count||0,
    liveMissions:missions.count||0,
    payoutHolds:payouts.count||0,
    payments:{stripeApi,webhook:webhookReady,liveGiving:stripeApi&&webhookReady},
    qa:(qa.data||[]).map((r:any)=>({action:r.action,status:r.after_state?.status||null,createdAt:r.created_at}))
  },{headers:{'content-type':'application/json','cache-control':'no-store'}})
})
