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
    const [{data:plans},{data:donations},{data:receipts}]=await Promise.all([
      db.from('mission365_giving_plans').select('id,mission_id,amount_cents,cadence,status,created_at,updated_at').eq('donor_user_id',user.id).order('created_at',{ascending:false}),
      db.from('mission365_donations').select('id,giving_plan_id,mission_id,amount_cents,platform_fee_cents,currency,status,succeeded_at,created_at').eq('donor_user_id',user.id).order('created_at',{ascending:false}).limit(100),
      db.from('mission365_receipts').select('id,donation_id,receipt_number,amount_cents,currency,issued_at,receipt_url').eq('donor_user_id',user.id).order('issued_at',{ascending:false}).limit(100),
    ])
    const missionIds=Array.from(new Set([...(plans||[]).map((x:any)=>x.mission_id).filter(Boolean),...(donations||[]).map((x:any)=>x.mission_id).filter(Boolean)])) as string[]
    const missions=missionIds.length?(await db.from('mission365_missions').select('id,slug,title,summary,category,status,funded_amount_cents,goal_amount_cents').in('id',missionIds)).data||[]:[]
    const missionMap=new Map(missions.map((m:any)=>[m.id,m]))
    const enrichedDonations=(donations||[]).map((d:any)=>({...d,mission:missionMap.get(d.mission_id)||null}))
    const enrichedPlans=(plans||[]).map((p:any)=>({...p,mission:p.mission_id?missionMap.get(p.mission_id)||null:null}))
    const yearStart=new Date(Date.UTC(new Date().getUTCFullYear(),0,1)).getTime()
    const succeeded=(donations||[]).filter((d:any)=>d.status==='succeeded')
    const givingThisYearCents=succeeded.filter((d:any)=>new Date(d.succeeded_at||d.created_at).getTime()>=yearStart).reduce((sum:number,d:any)=>sum+Number(d.amount_cents||0),0)
    const activePlans=(plans||[]).filter((p:any)=>p.status==='active').length
    const missionsSupported=new Set(succeeded.map((d:any)=>d.mission_id)).size
    return json({metrics:{givingThisYearCents,activePlans,missionsSupported,receiptCount:(receipts||[]).length},plans:enrichedPlans,donations:enrichedDonations,receipts:receipts||[]})
  }catch(error){console.error('mission365 donor dashboard failed',error);return json({error:error instanceof Error?error.message:'Dashboard unavailable'},500)}
})
