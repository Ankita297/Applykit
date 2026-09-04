import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JobFit — Job application workspace',
  description: 'Tailor your resume and track every job application.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
