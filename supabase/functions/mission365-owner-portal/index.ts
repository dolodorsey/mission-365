import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'cache-control':'no-store'}})
function publicKey(){const modern=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_ANON_KEY')!}
function secretKey(){const modern=Deno.env.get('SUPABASE_SECRET_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}
function admin(){return createClient(Deno.env.get('SUPABASE_URL')!,secretKey(),{auth:{persistSession:false,autoRefreshToken:false}})}
function scoped(auth:string){return createClient(Deno.env.get('SUPABASE_URL')!,publicKey(),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}})}
function slugify(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'mission'}

async function requireUser(req:Request){
  const auth=req.headers.get('authorization')||''
  const token=auth.startsWith('Bearer ')?auth.slice(7):''
  if(!token) return {error:json({error:'Authentication required'},401)}
  const client=scoped(auth)
  const {data:{user},error}=await client.auth.getUser(token)
  if(error||!user) return {error:json({error:'Invalid session'},401)}
  return {user}
}

async function memberRole(db:any,userId:string,organizationId:string){
  const {data}=await db.from('mission365_organization_members').select('member_role').eq('user_id',userId).eq('organization_id',organizationId).maybeSingle()
  return data?.member_role||null
}

async function canAccessApplication(db:any,userId:string,applicationId:string){
  const {data}=await db.from('mission365_applications').select('id,organization_id').eq('id',applicationId).eq('applicant_user_id',userId).maybeSingle()
  return data||null
}

async function snapshot(db:any,userId:string){
  const [{data:applications},{data:memberships}]=await Promise.all([
    db.from('mission365_applications').select('id,organization_id,application_type,legal_name,public_name,contact_email,mission_summary,requested_amount_cents,status,submitted_at,reviewed_at,created_at,updated_at').eq('applicant_user_id',userId).order('created_at',{ascending:false}),
    db.from('mission365_organization_members').select('organization_id,member_role,created_at').eq('user_id',userId),
  ])
  const orgIds=Array.from(new Set([...(memberships||[]).map((x:any)=>x.organization_id),...(applications||[]).map((x:any)=>x.organization_id).filter(Boolean)])) as string[]
  const applicationIds=(applications||[]).map((x:any)=>x.id)
  const organizations=orgIds.length?(await db.from('mission365_organizations').select('id,legal_name,public_name,organization_type,website_url,verification_status,verified_at,created_at,updated_at').in('id',orgIds).order('created_at',{ascending:true})).data||[]:[]
  const ownerDocs=(await db.from('mission365_documents').select('id,application_id,organization_id,document_type,storage_bucket,storage_path,review_status,reviewed_at,created_at').eq('uploaded_by',userId).order('created_at',{ascending:false})).data||[]
  const missions=orgIds.length?(await db.from('mission365_missions').select('id,organization_id,slug,title,summary,story,category,city,region,country_code,goal_amount_cents,funded_amount_cents,status,published_at,funding_opens_at,funding_closes_at,created_at,updated_at').in('organization_id',orgIds).order('created_at',{ascending:false})).data||[]:[]
  const payoutAccounts=orgIds.length?(await db.from('mission365_payout_accounts').select('organization_id,onboarding_status,transfers_status,requirements_due,last_checked_at,updated_at').in('organization_id',orgIds)).data||[]:[]
  const missionIds=missions.map((m:any)=>m.id)
  const milestones=missionIds.length?(await db.from('mission365_milestones').select('id,mission_id,title,description,target_date,completed_at,verification_status,sort_order,created_at').in('mission_id',missionIds).order('sort_order',{ascending:true})).data||[]:[]
  return {applications:applications||[],memberships:memberships||[],organizations,documents:ownerDocs,missions,payoutAccounts,milestones,applicationIds}
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  if(!['GET','POST'].includes(req.method)) return json({error:'Method not allowed'},405)
  try{
    const authResult=await requireUser(req)
    if('error' in authResult) return authResult.error
    const user=authResult.user!
    const db=admin()
    if(req.method==='GET') return json(await snapshot(db,user.id))

    const body=await req.json()
    const action=String(body?.action||'')

    if(action==='initialize_workspace'){
      const applicationId=String(body.applicationId||'')
      const {data:application,error}=await db.from('mission365_applications').select('id,organization_id,application_type,legal_name,public_name,contact_email,status').eq('id',applicationId).eq('applicant_user_id',user.id).single()
      if(error||!application) return json({error:'Application not found'},404)
      if(application.organization_id){
        const role=await memberRole(db,user.id,application.organization_id)
        if(!role) await db.from('mission365_organization_members').insert({organization_id:application.organization_id,user_id:user.id,member_role:'owner'})
        return json({initialized:true,organizationId:application.organization_id,portal:await snapshot(db,user.id)})
      }
      const organizationId=crypto.randomUUID()
      const organizationType=application.application_type==='business_partner'?'business':'community_project'
      const {error:orgError}=await db.from('mission365_organizations').insert({id:organizationId,legal_name:application.legal_name,public_name:application.public_name,organization_type:organizationType,verification_status:'pending'})
      if(orgError) throw orgError
      const {error:memberError}=await db.from('mission365_organization_members').insert({organization_id:organizationId,user_id:user.id,member_role:'owner'})
      if(memberError){await db.from('mission365_organizations').delete().eq('id',organizationId);throw memberError}
      const {error:linkError}=await db.from('mission365_applications').update({organization_id:organizationId,updated_at:new Date().toISOString()}).eq('id',applicationId).eq('applicant_user_id',user.id)
      if(linkError) throw linkError
      await db.from('mission365_audit_log').insert({actor_user_id:user.id,action:'owner.workspace.initialized',entity_type:'organization',entity_id:organizationId,after_state:{verification_status:'pending'},metadata:{application_id:applicationId}})
      return json({initialized:true,organizationId,portal:await snapshot(db,user.id)})
    }

    if(action==='save_organization'){
      const organizationId=String(body.organizationId||'')
      const role=await memberRole(db,user.id,organizationId)
      if(!['owner','manager'].includes(role||'')) return json({error:'Organization owner or manager access required'},403)
      const {data:current}=await db.from('mission365_organizations').select('verification_status').eq('id',organizationId).single()
      if(!current||['rejected','suspended'].includes(current.verification_status)) return json({error:'Organization profile is locked'},409)
      const allowedTypes=['nonprofit','community_project','school','faith_organization','business','individual_mission']
      const organizationType=String(body.organization_type||'')
      if(!allowedTypes.includes(organizationType)) return json({error:'Unsupported organization type'},400)
      const patch={legal_name:String(body.legal_name||'').trim(),public_name:String(body.public_name||'').trim(),organization_type:organizationType,website_url:String(body.website_url||'').trim()||null,updated_at:new Date().toISOString()}
      if(!patch.legal_name||!patch.public_name) return json({error:'Legal and public names are required'},400)
      const {data,error}=await db.from('mission365_organizations').update(patch).eq('id',organizationId).select('id,legal_name,public_name,organization_type,website_url,verification_status,updated_at').single()
      if(error) throw error
      await db.from('mission365_audit_log').insert({actor_user_id:user.id,action:'owner.organization_profile.updated',entity_type:'organization',entity_id:organizationId,after_state:data,metadata:{member_role:role}})
      return json({organization:data})
    }

    if(action==='register_document'){
      const applicationId=body.applicationId?String(body.applicationId):null
      const organizationId=body.organizationId?String(body.organizationId):null
      const documentType=String(body.documentType||'').trim()
      const storagePath=String(body.storagePath||'').trim()
      if(!documentType||!storagePath||(!applicationId&&!organizationId)) return json({error:'Document type, storage path, and application or organization are required'},400)
      if(!storagePath.startsWith(`${user.id}/`)) return json({error:'Storage path is outside your private user folder'},403)
      let allowed=false
      if(applicationId) allowed=Boolean(await canAccessApplication(db,user.id,applicationId))
      if(organizationId) allowed=allowed||Boolean(await memberRole(db,user.id,organizationId))
      if(!allowed) return json({error:'You cannot attach documents to this verification record'},403)
      const parts=storagePath.split('/');const fileName=parts.pop()!;const folder=parts.join('/')
      const {data:objects,error:listError}=await db.storage.from('mission365-private').list(folder,{search:fileName,limit:20})
      if(listError||!(objects||[]).some((o:any)=>o.name===fileName)) return json({error:'Uploaded file could not be verified in private storage'},409)
      const {data,error}=await db.from('mission365_documents').insert({application_id:applicationId,organization_id:organizationId,uploaded_by:user.id,document_type:documentType,storage_bucket:'mission365-private',storage_path:storagePath,review_status:'pending'}).select('id,application_id,organization_id,document_type,storage_path,review_status,created_at').single()
      if(error) throw error
      await db.from('mission365_audit_log').insert({actor_user_id:user.id,action:'owner.verification_document.uploaded',entity_type:'document',entity_id:data.id,after_state:{document_type:documentType,review_status:'pending'},metadata:{application_id:applicationId,organization_id:organizationId}})
      return json({document:data})
    }

    if(action==='save_mission'){
      const organizationId=String(body.organizationId||'')
      const role=await memberRole(db,user.id,organizationId)
      if(!['owner','manager'].includes(role||'')) return json({error:'Organization owner or manager access required'},403)
      const mission=body.mission||{}
      const title=String(mission.title||'').trim(),summary=String(mission.summary||'').trim(),story=String(mission.story||'').trim(),category=String(mission.category||'').trim()
      const goalAmountCents=Math.round(Number(mission.goalAmount||0)*100)
      if(title.length<4||summary.length<20||story.length<40||!category||!Number.isFinite(goalAmountCents)||goalAmountCents<100) return json({error:'Mission needs a title, 20+ character summary, 40+ character story, category, and goal of at least $1'},400)
      const patch:any={organization_id:organizationId,title,summary,story,category,city:String(mission.city||'').trim()||null,region:String(mission.region||'').trim()||null,country_code:String(mission.countryCode||'US').trim().toUpperCase().slice(0,2)||'US',goal_amount_cents:goalAmountCents,funding_opens_at:mission.fundingOpensAt||null,funding_closes_at:mission.fundingClosesAt||null,updated_at:new Date().toISOString()}
      let saved:any
      if(mission.id){
        const {data:existing}=await db.from('mission365_missions').select('id,status,organization_id').eq('id',String(mission.id)).eq('organization_id',organizationId).maybeSingle()
        if(!existing) return json({error:'Mission draft not found'},404)
        if(existing.status!=='draft') return json({error:'Only draft missions can be edited'},409)
        const {data,error}=await db.from('mission365_missions').update(patch).eq('id',existing.id).select('*').single();if(error)throw error;saved=data
      }else{
        const id=crypto.randomUUID();patch.id=id;patch.slug=`${slugify(title)}-${id.slice(0,8)}`;patch.status='draft'
        const {data,error}=await db.from('mission365_missions').insert(patch).select('*').single();if(error)throw error;saved=data
      }
      await db.from('mission365_audit_log').insert({actor_user_id:user.id,action:'owner.mission_draft.saved',entity_type:'mission',entity_id:saved.id,after_state:{status:saved.status,title:saved.title,goal_amount_cents:saved.goal_amount_cents},metadata:{organization_id:organizationId}})
      return json({mission:saved})
    }

    if(action==='submit_mission'){
      const missionId=String(body.missionId||'')
      const {data:mission}=await db.from('mission365_missions').select('id,organization_id,status').eq('id',missionId).maybeSingle()
      if(!mission) return json({error:'Mission not found'},404)
      const role=await memberRole(db,user.id,mission.organization_id)
      if(!['owner','manager'].includes(role||'')) return json({error:'Organization owner or manager access required'},403)
      if(mission.status!=='draft') return json({error:'Only draft missions can be submitted'},409)
      const [{data:org},{data:payout}]=await Promise.all([
        db.from('mission365_organizations').select('verification_status').eq('id',mission.organization_id).single(),
        db.from('mission365_payout_accounts').select('onboarding_status,transfers_status').eq('organization_id',mission.organization_id).maybeSingle(),
      ])
      if(org?.verification_status!=='verified') return json({error:'Mission submission is locked until the organization is verified'},409)
      if(!payout||payout.onboarding_status!=='ready'||payout.transfers_status!=='active') return json({error:'Mission submission is locked until payout onboarding is ready and transfer-active'},409)
      const {data,error}=await db.from('mission365_missions').update({status:'under_review',updated_at:new Date().toISOString()}).eq('id',missionId).select('*').single();if(error)throw error
      await db.from('mission365_audit_log').insert({actor_user_id:user.id,action:'owner.mission.submitted',entity_type:'mission',entity_id:missionId,before_state:{status:'draft'},after_state:{status:'under_review'},metadata:{organization_id:mission.organization_id}})
      return json({mission:data})
    }

    return json({error:'Unsupported action'},400)
  }catch(error){
    console.error('mission365 owner portal failed',error)
    return json({error:error instanceof Error?error.message:'Owner portal request failed'},500)
  }
})
