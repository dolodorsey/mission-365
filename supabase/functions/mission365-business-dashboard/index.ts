import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, OPTIONS'}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'cache-control':'no-store'}})
function publicKey(){const modern=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_ANON_KEY')!}
function secretKey(){const modern=Deno.env.get('SUPABASE_SECRET_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}
function admin(){return createClient(Deno.env.get('SUPABASE_URL')!,secretKey(),{auth:{persistSession:false,autoRefreshToken:false}})}
function scoped(auth:string){return createClient(Deno.env.get('SUPABASE_URL')!,publicKey(),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}})}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='GET')return json({error:'Method not allowed'},405)
  try{
    const auth=req.headers.get('authorization')||'';const token=auth.startsWith('Bearer ')?auth.slice(7):''
    if(!token)return json({error:'Authentication required'},401)
    const {data:{user},error:userError}=await scoped(auth).auth.getUser(token)
    if(userError||!user)return json({error:'Invalid session'},401)
    const db=admin()
    const [{data:memberships},{data:applications}]=await Promise.all([
      db.from('mission365_organization_members').select('organization_id,member_role,created_at').eq('user_id',user.id),
      db.from('mission365_applications').select('id,organization_id,public_name,status,created_at').eq('applicant_user_id',user.id).eq('application_type','business_partner').order('created_at',{ascending:false}),
    ])
    const orgIds=(memberships||[]).map((m:any)=>m.organization_id)
    const organizations=orgIds.length?(await db.from('mission365_organizations').select('id,legal_name,public_name,organization_type,website_url,verification_status,verified_at,created_at').in('id',orgIds).eq('organization_type','business')).data||[]:[]
    const businessIds=organizations.map((o:any)=>o.id)
    const sponsorships=businessIds.length?(await db.from('mission365_business_sponsorships').select('id,business_organization_id,mission_id,commitment_amount_cents,funded_amount_cents,sponsorship_type,status,starts_at,ends_at,created_at,updated_at').in('business_organization_id',businessIds).order('created_at',{ascending:false})).data||[]:[]
    const missionIds=Array.from(new Set(sponsorships.map((s:any)=>s.mission_id))) as string[]
    const missions=missionIds.length?(await db.from('mission365_missions').select('id,slug,title,summary,category,status,funded_amount_cents,goal_amount_cents').in('id',missionIds)).data||[]:[]
    const missionMap=new Map(missions.map((m:any)=>[m.id,m]))
    const enriched=sponsorships.map((s:any)=>({...s,mission:missionMap.get(s.mission_id)||null}))
    const contributedCents=sponsorships.reduce((sum:number,s:any)=>sum+Number(s.funded_amount_cents||0),0)
    const committedCents=sponsorships.reduce((sum:number,s:any)=>sum+Number(s.commitment_amount_cents||0),0)
    const activeSponsorships=sponsorships.filter((s:any)=>s.status==='active').length
    const givingPrograms=sponsorships.filter((s:any)=>['matched_giving','employee_giving'].includes(s.sponsorship_type)&&['active','fulfilled'].includes(s.status)).length
    return json({metrics:{contributedCents,committedCents,activeSponsorships,givingPrograms},organizations,applications:applications||[],sponsorships:enriched})
  }catch(error){console.error('mission365 business dashboard failed',error);return json({error:error instanceof Error?error.message:'Dashboard unavailable'},500)}
})
