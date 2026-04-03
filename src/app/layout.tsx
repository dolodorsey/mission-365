import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mission 365 | Give Every Day',
  description: 'Subscription-based giving platform supporting verified causes through recurring donations with transparent impact tracking.',
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
