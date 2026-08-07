import { NextResponse } from 'next/server'
import { getSupabaseClients, requireUser } from '@/lib/server-auth'

export const dynamic='force-dynamic'

type ApplicationBody={
  applicationType?:'mission_owner'|'business_partner'
  legalName?:string
  publicName?:string
  contactEmail?:string
  missionSummary?:string
  requestedAmountCents?:number|null
}

export async function POST(request:Request){
  try{
    const user=await requireUser(request)
    if(!user) return NextResponse.json({error:'Authentication required'},{status:401})
    const body=await request.json() as ApplicationBody
    if(!body.applicationType||!['mission_owner','business_partner'].includes(body.applicationType))
      return NextResponse.json({error:'Choose a valid application type'},{status:400})
    if(!body.legalName?.trim()||!body.publicName?.trim()||!body.contactEmail?.trim()||!body.missionSummary?.trim())
      return NextResponse.json({error:'Complete all required fields'},{status:400})
    const {adminClient}=getSupabaseClients()
    if(!adminClient) return NextResponse.json({error:'Mission 365 backend is not fully configured'},{status:503})

    const {data,error}=await adminClient.from('mission365_applications').insert({
      applicant_user_id:user.id,
      application_type:body.applicationType,
      legal_name:body.legalName.trim(),
      public_name:body.publicName.trim(),
      contact_email:body.contactEmail.trim().toLowerCase(),
      mission_summary:body.missionSummary.trim(),
      requested_amount_cents:body.requestedAmountCents&&body.requestedAmountCents>0?body.requestedAmountCents:null,
      status:'submitted',submitted_at:new Date().toISOString()
    }).select('id,status,submitted_at').single()
    if(error) throw error
    return NextResponse.json({application:data},{status:201})
  }catch(error){
    console.error('mission365 application submission failed',error)
    return NextResponse.json({error:error instanceof Error?error.message:'Application could not be submitted'},{status:500})
  }
}
