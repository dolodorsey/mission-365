import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

function secretKey(){
  const modern=Deno.env.get('SUPABASE_SECRET_KEYS')
  return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
}
function admin(){return createClient(Deno.env.get('SUPABASE_URL')!,secretKey(),{auth:{persistSession:false,autoRefreshToken:false}})}
function olderThanFourHours(value:string|null|undefined){
  if(!value)return false
  const time=Date.parse(value)
  return Number.isFinite(time)&&Date.now()-time>=4*60*60*1000
}

Deno.serve(async(req:Request)=>{
  if(req.method!=='GET') return Response.json({error:'Method not allowed'},{status:405})
  const db=admin()
  const [
    orgs,
    apps,
    liveMissions,
    payouts,
    missionReviewCount,
    missionReviewOldest,
    crmPendingCount,
    crmPendingOldest,
    qa,
    webhook,
    vaultStripe
  ]=await Promise.all([
    db.from('mission365_organizations').select('id',{count:'exact',head:true}).in('verification_status',['pending','under_review']),
    db.from('mission365_applications').select('id',{count:'exact',head:true}).in('status',['submitted','under_review','needs_information']),
    db.from('mission365_missions').select('id',{count:'exact',head:true}).in('status',['published','funded','reporting']),
    db.from('mission365_payouts').select('id',{count:'exact',head:true}).in('status',['pending_review','approved','processing']),
    db.from('mission365_missions').select('id',{count:'exact',head:true}).in('status',['submitted','under_review']),
    db.from('mission365_missions').select('submitted_at,status').in('status',['submitted','under_review']).not('submitted_at','is',null).order('submitted_at',{ascending:true}).limit(1).maybeSingle(),
    db.from('mission365_crm_outbox').select('id',{count:'exact',head:true}).eq('status','pending'),
    db.from('mission365_crm_outbox').select('created_at,attempts,event_type').eq('status','pending').order('created_at',{ascending:true}).limit(1).maybeSingle(),
    db.from('mission365_audit_log').select('action,after_state,created_at').eq('entity_type','platform').eq('entity_id','production').order('created_at',{ascending:false}).limit(6),
    db.rpc('mission365_get_runtime_secret',{secret_name:'stripe_webhook_secret'}),
    db.rpc('mission365_get_runtime_secret',{secret_name:'stripe_api_key'})
  ])

  const requiredQueries=[
    ['verification_candidates',orgs],
    ['applications_in_review',apps],
    ['live_missions',liveMissions],
    ['payout_holds',payouts],
    ['mission_review_count',missionReviewCount],
    ['mission_review_oldest',missionReviewOldest],
    ['crm_pending_count',crmPendingCount],
    ['crm_pending_oldest',crmPendingOldest]
  ] as const
  const failedQueries=requiredQueries.filter(([,result])=>Boolean(result.error)).map(([name])=>name)

  const oldestMissionSubmittedAt=missionReviewOldest.data?.submitted_at||null
  const oldestCrmPendingAt=crmPendingOldest.data?.created_at||null
  const missionReviewStale=Boolean((missionReviewCount.count||0)>0&&olderThanFourHours(oldestMissionSubmittedAt))
  const crmOutboxStale=Boolean((crmPendingCount.count||0)>0&&olderThanFourHours(oldestCrmPendingAt))

  const envStripe=String(Deno.env.get('STRIPE_SECRET_KEY')||'')
  const vaultStripeKey=String(vaultStripe.data||'')
  const stripeApi=Boolean((envStripe&&!envStripe.startsWith('REPLACE_WITH_'))||(vaultStripeKey&&!vaultStripeKey.startsWith('REPLACE_WITH_')))
  const webhookReady=Boolean(webhook.data)
  const operationalStatus=failedQueries.length?'degraded':(missionReviewStale||crmOutboxStale?'red':'green')

  return Response.json({
    service:'mission-365',
    verificationCandidates:orgs.count||0,
    applicationsInReview:apps.count||0,
    liveMissions:liveMissions.count||0,
    payoutHolds:payouts.count||0,
    founderExceptions:{
      status:operationalStatus,
      queryIntegrity:failedQueries.length?'degraded':'ok',
      failedQueries,
      missionReview:{
        count:missionReviewCount.count||0,
        oldestSubmittedAt:oldestMissionSubmittedAt,
        staleOver4h:missionReviewStale
      },
      crmOutbox:{
        pending:crmPendingCount.count||0,
        oldestCreatedAt:oldestCrmPendingAt,
        oldestAttempts:crmPendingOldest.data?.attempts??null,
        oldestEventType:crmPendingOldest.data?.event_type??null,
        staleOver4h:crmOutboxStale
      }
    },
    payments:{stripeApi,webhook:webhookReady,liveGiving:stripeApi&&webhookReady},
    qa:(qa.data||[]).map((r:any)=>({action:r.action,status:r.after_state?.status||null,createdAt:r.created_at}))
  },{
    status:failedQueries.length?503:200,
    headers:{'content-type':'application/json','cache-control':'no-store'}
  })
})
