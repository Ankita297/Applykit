import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JobFit — Job application workspace',
  description: 'Score your resume against each job and track applications.',
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
