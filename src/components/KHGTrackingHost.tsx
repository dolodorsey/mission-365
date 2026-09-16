'use client'

import { useEffect } from 'react'

const CAPTURE_URL='https://wfkohcwxxsrhcxhepfql.supabase.co/functions/v1/marketing-event-capture'
const BRAND_KEY='mission-365'

function getStored(key:string){try{return localStorage.getItem(key)}catch{return null}}
function setStored(key:string,value:string){try{localStorage.setItem(key,value)}catch{}}
function clean(value:unknown,max=180){const text=String(value||'').replace(/\s+/g,' ').trim();return text?text.slice(0,max):undefined}
function visitorKey(){const existing=getStored('khg_vid');if(existing)return existing;const created=crypto.randomUUID();setStored('khg_vid',created);return created}
function trackingCode(){const incoming=clean(new URLSearchParams(location.search).get('khg_track'),80);const key=`khg_track:${BRAND_KEY}`;if(incoming){setStored(key,incoming);return incoming}return getStored(key)||undefined}
function classify(element:HTMLElement){
  const forced=clean(element.dataset.khgEvent,60)
  if(forced)return forced
  const text=clean(element.dataset.khgCta||element.textContent,160)?.toLowerCase()||''
  const href=element instanceof HTMLAnchorElement?element.href.toLowerCase():''
  if(href.includes('apps.apple.com')||href.includes('play.google.com')||/download app|app store|google play/.test(text))return 'app_install_click'
  if(/donate|give now|fund mission|contribute|sponsor mission|support mission/.test(text))return 'checkout_started'
  if(/submit mission|start a mission|mission owner|apply|become a partner/.test(text))return 'application'
  if(/join|sign up|create account/.test(text))return 'signup'
  return 'cta_click'
}

export default function KHGTrackingHost(){
  useEffect(()=>{
    let code=trackingCode()
    const visitor=visitorKey()
    async function track(eventType:string,metadata:Record<string,unknown>={}){
      try{
        const response=await fetch(CAPTURE_URL,{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({
          ...(code?{code}:{brand_key:BRAND_KEY}),event_type:eventType,visitor_key:visitor,
          metadata:{event_id:crypto.randomUUID(),path:`${location.pathname}${location.search}`.slice(0,500),app:'mission-365',channel:'app',...metadata},
        })})
        if(!response.ok)return
        const result=await response.json().catch(()=>null)
        const returnedCode=typeof result?.tracking_code==='string'?result.tracking_code:''
        if(returnedCode){code=returnedCode;setStored(`khg_track:${BRAND_KEY}`,returnedCode)}
      }catch{}
    }
    ;(window as unknown as {khgTrack?:typeof track}).khgTrack=track
    void track('page_view',{page:clean(document.title,200),platform:(window as unknown as {Capacitor?:unknown}).Capacitor?'capacitor':'web'})
    const onClick=(event:MouseEvent)=>{
      const target=event.target
      if(!(target instanceof Element))return
      const element=target.closest<HTMLElement>('a,button,[role="button"],[data-khg-event]')
      if(!element)return
      const eventType=classify(element)
      void track(eventType,{cta:clean(element.dataset.khgCta||element.textContent,200),conversion_type:['application','signup'].includes(eventType)?eventType:undefined})
    }
    const onSubmit=(event:SubmitEvent)=>{
      const form=event.target
      if(!(form instanceof HTMLFormElement))return
      const text=`${location.pathname} ${form.id} ${form.getAttribute('aria-label')||''}`.toLowerCase()
      const eventType=/mission|partner|apply/.test(text)?'application':'form_submission'
      void track(eventType,{cta:clean(form.dataset.khgCta||form.getAttribute('aria-label')||form.id,200),conversion_type:eventType})
    }
    document.addEventListener('click',onClick,{capture:true})
    document.addEventListener('submit',onSubmit,{capture:true})
    return()=>{
      document.removeEventListener('click',onClick,{capture:true})
      document.removeEventListener('submit',onSubmit,{capture:true})
      const w=window as unknown as {khgTrack?:typeof track}
      if(w.khgTrack===track)delete w.khgTrack
    }
  },[])
  return null
}
