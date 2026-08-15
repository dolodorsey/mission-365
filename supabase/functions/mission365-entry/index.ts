import { createClient } from 'npm:@supabase/supabase-js@2.112.0'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'cache-control':'no-store'}})
function publicKey(){const modern=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_ANON_KEY')!}
function secretKey(){const modern=Deno.env.get('SUPABASE_SECRET_KEYS');return modern?JSON.parse(modern).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}
function admin(){return createClient(Deno.env.get('SUPABASE_URL')!,secretKey(),{auth:{persistSession:false,autoRefreshToken:false}})}
function scoped(auth:string){return createClient(Deno.env.get('SUPABASE_URL')!,publicKey(),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}})}
function cleanUrl(value:unknown){const text=String(value||'').trim();if(!text)return null;try{const url=new URL(text);return ['http:','https:'].includes(url.protocol)?url.toString():null}catch{return null}}
async function userFor(req:Request){const auth=req.headers.get('authorization')||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';if(!token)return {error:json({error:'Authentication required'},401)};const {data:{user},error}=await scoped(auth).auth.getUser(token);if(error||!user)return {error:json({error:'Invalid session'},401)};return {user}}
async function snapshot(db:any,user:any){
 const [{data:roles},{data:memberships},{data:vendor},{data:signups}]=await Promise.all([
  db.from('mission365_user_roles').select('role,status,created_at').eq('user_id',user.id).order('created_at'),
  db.from('mission365_organization_members').select('organization_id,member_role').eq('user_id',user.id),
  db.from('mission365_vendor_profiles').select('*').eq('owner_user_id',user.id).maybeSingle(),
  db.from('mission365_volunteer_signups').select('id,opportunity_id,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false})
 ]);
 const orgIds=(memberships||[]).map((m:any)=>m.organization_id);const organizations=orgIds.length?(await db.from('mission365_organizations').select('id,public_name,legal_name,organization_type,verification_status,website_url').in('id',orgIds)).data||[]:[];
 const businessOrganizations=organizations.filter((o:any)=>o.organization_type==='business');
 return {email:user.email,roles:roles||[],memberships:memberships||[],businessOrganizations,vendorProfile:vendor||null,volunteerSignups:signups||[]}
}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(!['GET','POST'].includes(req.method))return json({error:'Method not allowed'},405);try{const auth=await userFor(req);if('error' in auth)return auth.error;const user=auth.user!;const db=admin();if(req.method==='GET')return json(await snapshot(db,user));const body=await req.json();const action=String(body?.action||'');
 if(action==='activate_role'){
  const role=String(body?.role||'');if(!['mission_owner','donor_personal','donor_business','vendor','volunteer'].includes(role))return json({error:'Unsupported Mission 365 role'},400);
  const {error}=await db.from('mission365_user_roles').upsert({user_id:user.id,role,status:'active',updated_at:new Date().toISOString()},{onConflict:'user_id,role'});if(error)throw error;return json({activated:true,role,snapshot:await snapshot(db,user)})
 }
 if(action==='create_business_donor'){
  const publicName=String(body?.publicName||'').trim(),rawWebsite=String(body?.websiteUrl||'').trim(),websiteUrl=cleanUrl(rawWebsite);if(publicName.length<2)return json({error:'Business name is required'},400);if(rawWebsite&&!websiteUrl)return json({error:'Website must be a valid http or https URL'},400);
  const {data:org,error:orgError}=await db.from('mission365_organizations').insert({legal_name:publicName,public_name:publicName,organization_type:'business',website_url:websiteUrl,verification_status:'pending'}).select('*').single();if(orgError)throw orgError;
  await db.from('mission365_organization_members').insert({organization_id:org.id,user_id:user.id,member_role:'owner'});
  await db.from('mission365_user_roles').upsert({user_id:user.id,role:'donor_business',status:'active',updated_at:new Date().toISOString()},{onConflict:'user_id,role'});
  await db.from('mission365_audit_log').insert({actor_user_id:user.id,action:'entry.business_donor.created',entity_type:'organization',entity_id:org.id,after_state:{public_name:org.public_name,organization_type:'business',verification_status:'pending'},metadata:{entry_level:'donor_business'}});
  return json({organization:org,snapshot:await snapshot(db,user)})
 }
 if(action==='save_vendor_profile'){
  const publicName=String(body?.publicName||'').trim();if(publicName.length<2)return json({error:'Vendor/business name is required'},400);const categories=Array.isArray(body?.serviceCategories)?body.serviceCategories.map((x:any)=>String(x).trim()).filter(Boolean).slice(0,20):[];const contactEmail=String(body?.contactEmail||user.email||'').trim().toLowerCase()||null;if(contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))return json({error:'Enter a valid contact email'},400);const rawWebsite=String(body?.websiteUrl||'').trim(),websiteUrl=cleanUrl(rawWebsite);if(rawWebsite&&!websiteUrl)return json({error:'Website must be a valid http or https URL'},400);
  const payload={owner_user_id:user.id,public_name:publicName,contact_email:contactEmail,phone:String(body?.phone||'').trim()||null,website_url:websiteUrl,service_categories:categories,city:String(body?.city||'').trim()||null,region:String(body?.region||'').trim()||null,description:String(body?.description||'').trim(),status:'active',updated_at:new Date().toISOString()};
  const {data:vendor,error}=await db.from('mission365_vendor_profiles').upsert(payload,{onConflict:'owner_user_id'}).select('*').single();if(error)throw error;await db.from('mission365_user_roles').upsert({user_id:user.id,role:'vendor',status:'active',updated_at:new Date().toISOString()},{onConflict:'user_id,role'});return json({vendorProfile:vendor,snapshot:await snapshot(db,user)})
 }
 if(action==='register_volunteer'){
  const opportunityId=String(body?.opportunityId||'');if(!opportunityId)return json({error:'Opportunity is required'},400);const {data:opp}=await db.from('mission365_volunteer_opportunities').select('id,status').eq('id',opportunityId).maybeSingle();if(!opp||opp.status!=='open')return json({error:'This volunteer opportunity is not open'},409);
  const {data:signup,error}=await db.from('mission365_volunteer_signups').upsert({opportunity_id:opportunityId,user_id:user.id,status:'registered',note:String(body?.note||'').slice(0,1000),updated_at:new Date().toISOString()},{onConflict:'opportunity_id,user_id'}).select('*').single();if(error)throw error;await db.from('mission365_user_roles').upsert({user_id:user.id,role:'volunteer',status:'active',updated_at:new Date().toISOString()},{onConflict:'user_id,role'});return json({signup})
 }
 if(action==='cancel_volunteer'){
  const opportunityId=String(body?.opportunityId||'');const {data,error}=await db.from('mission365_volunteer_signups').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('opportunity_id',opportunityId).eq('user_id',user.id).select('*').maybeSingle();if(error)throw error;return json({signup:data})
 }
 return json({error:'Unsupported action'},400)
 }catch(error){console.error('mission365 entry failed',error);return json({error:error instanceof Error?error.message:'Entry request failed'},500)}})
