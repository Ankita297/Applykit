export const STATUSES = ['draft', 'applied', 'interview', 'rejected', 'offer'] as const
export type ApplicationStatus = (typeof STATUSES)[number]
export type DocumentType = 'resume' | 'cover_letter' | 'cold_email'

export type ApplyProfile = {
  first_name: string
  last_name: string
  email: string
  phone: string
  linkedin: string
  github: string
  website: string
  address: string
  city: string
  region: string
  postal_code: string
  country: string
  work_authorization: string
}

export type Application = {
  id: number
  company: string
  role: string
  job_url: string
  jd_text: string
  status: ApplicationStatus
  applied_at: string | null
  notes: string
  recruiter_name: string
  recruiter_email: string
  created_at: string
  updated_at: string
  documents: Partial<Record<DocumentType, string>>
}

export type AtsResult = {
  score: number
  matched: string[]
  missing: string[]
  checks: { label: string; passed: boolean }[]
}
