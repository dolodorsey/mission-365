import type { Metadata } from 'next'
import './globals.css'
import './dashboard.css'
import './mission-registry.css'

export const metadata: Metadata = {
  title: 'Mission 365 | Everyday Giving. Verified Impact.',
  description: 'A verification-first giving platform connecting donors, businesses, and mission owners through transparent, year-round impact.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-midnight text-cream antialiased">{children}</body>
    </html>
  )
}
