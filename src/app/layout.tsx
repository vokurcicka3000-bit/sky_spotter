import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sky Spotter',
  description: 'Track flights for plane spotting – find the best spots and see planes near you.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  )
}
