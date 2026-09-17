import type { Metadata, Viewport } from 'next'
import KHGTrackingHost from '@/components/KHGTrackingHost'
import InstallAppPrompt from '@/components/InstallAppPrompt'
import './globals.css'
import './dashboard.css'
import './mission-registry.css'

export const viewport:Viewport={themeColor:'#9a4dff',colorScheme:'dark',width:'device-width',initialScale:1,viewportFit:'cover'}
export const metadata: Metadata = {
  title: 'Mission 365 | Everyday Giving. Verified Impact.',
  description: 'A verification-first giving platform connecting donors, businesses, and mission owners through transparent, year-round impact.',
  applicationName:'Mission 365',
  appleWebApp:{capable:true,title:'Mission 365',statusBarStyle:'black-translucent'},
  icons:{icon:[{url:'/api/pwa-icon?size=192',sizes:'192x192',type:'image/png'},{url:'/api/pwa-icon?size=512',sizes:'512x512',type:'image/png'}],apple:[{url:'/api/pwa-icon?size=180',sizes:'180x180',type:'image/png'}]},
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-midnight text-cream antialiased"><KHGTrackingHost />{children}<InstallAppPrompt/></body>
    </html>
  )
}
