import Link from 'next/link'
import type { ReactNode } from 'react'
import AppRoleNav from './AppRoleNav'

export function MissionAppShell({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}){
  return <main className="status-page"><section className="status-card" style={{maxWidth:1180,width:'94vw',textAlign:'left'}}>
    <div style={{display:'flex',gap:18,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
      <Link className="brand" href="/app"><span className="brand-mark">M</span><span>MISSION <b>365</b></span></Link>
      <AppRoleNav/>
    </div>
    <div style={{marginTop:32}}><p className="eyebrow">MISSION 365</p><h1>{title}</h1><p>{subtitle}</p></div>
    <div style={{marginTop:24}}>{children}</div>
  </section></main>
}

export function MetricGrid({items}:{items:Array<[string,string,string]>}){
  return <div className="role-grid">{items.map(([label,value,detail])=><article className="role-card" key={label}><p className="eyebrow">{label}</p><h2>{value}</h2><p>{detail}</p></article>)}</div>
}

export function WorkGrid({items}:{items:Array<[string,string]>}){
  return <div className="role-grid">{items.map(([title,body])=><article className="role-card" key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
}
