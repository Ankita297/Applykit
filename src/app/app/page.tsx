import JobApp from '@/components/JobApp'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Workspace — JobFit',
}

export default function AppPage() {
  return <JobApp />
}
