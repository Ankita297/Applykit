import { NextResponse } from 'next/server'
import { analyzeAts } from '@/lib/ats'

export async function POST(request: Request) {
  const { resume, jobDescription } = await request.json()
  if (typeof resume !== 'string' || typeof jobDescription !== 'string') {
    return NextResponse.json({ error: 'Resume and job description are required.' }, { status: 400 })
  }
  return NextResponse.json(analyzeAts(resume, jobDescription))
}
