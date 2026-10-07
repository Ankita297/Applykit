import { NextResponse } from 'next/server'
import { analyzeAts, applyFitResponse, fitPrompt } from '@/lib/ats'
import { completeChat } from '@/lib/openai'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { resume, jobDescription } = await request.json()
  if (typeof resume !== 'string' || typeof jobDescription !== 'string') {
    return NextResponse.json({ error: 'Resume and job description are required.' }, { status: 400 })
  }

  const fallback = analyzeAts(resume, jobDescription)
  try {
    const raw = await completeChat(
      fitPrompt(resume, jobDescription),
      'You extract concrete job requirements. Return JSON only. Never invent experience. Never use filler words as keywords.',
      0,
    )
    if (!raw) {
      return NextResponse.json({
        ...fallback,
        warning: 'Add OPENAI_API_KEY to .env.local for a concrete skill list. This run used local word overlap.',
      })
    }
    return NextResponse.json(applyFitResponse(raw, resume, jobDescription))
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The AI provider rejected the request.'
    return NextResponse.json({
      ...fallback,
      warning: `${detail} Fit used local word overlap. Update OPENAI_API_KEY in .env.local, then Score again.`,
    })
  }
}
