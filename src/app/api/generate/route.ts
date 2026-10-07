import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { completeChat } from '@/lib/openai'
import { cleanGeneratedResume } from '@/lib/resumeFormat'
import type { Application, DocumentType } from '@/lib/types'

export const runtime = 'nodejs'

const VALID_TYPES: DocumentType[] = ['cover_letter', 'cold_email']

function promptFor(type: DocumentType, application: Application, masterResume: string) {
  const context = `
MASTER RESUME:
${masterResume}

JOB:
${application.role} at ${application.company}

JOB DESCRIPTION:
${application.jd_text}`

  if (type === 'cover_letter') {
    return `Write a concise, specific cover letter (250-350 words) for this application.
Use only facts in the resume. Avoid clichés, placeholders, and invented claims.
Return only the letter.\n${context}`
  }
  return `Write a concise cold email to ${application.recruiter_name || 'the hiring team'} about this role.
Include a strong subject line, 3 short paragraphs, and a clear ask. Keep it under 150 words.
Use only facts in the resume. Return only the email.\n${context}`
}

export async function POST(request: Request) {
  const { applicationId, type } = await request.json()
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Unknown document type.' }, { status: 400 })
  }

  const application = db.prepare(
    "SELECT * FROM applications WHERE id = ? AND user_id = 'local'",
  ).get(Number(applicationId)) as Application | undefined
  const resume = db.prepare(
    "SELECT body FROM resumes WHERE user_id = 'local'",
  ).get() as { body: string } | undefined
  if (!application || !resume?.body) {
    return NextResponse.json(
      { error: 'Save a master resume and application first.' },
      { status: 400 },
    )
  }

  try {
    const raw = (await completeChat(
      promptFor(type, application, resume.body),
      'Return only what was asked. Never rewrite a resume. Never merge or drop jobs.',
      0.3,
    )) ?? ''
    if (!raw) throw new Error('Add OPENAI_API_KEY to .env.local before generating documents.')
    const body = cleanGeneratedResume(raw)
    if (!body) throw new Error('The AI provider returned an empty response.')

    db.prepare(`
      INSERT INTO documents (application_id, type, body, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(application_id, type) DO UPDATE SET body = excluded.body, created_at = excluded.created_at
    `).run(application.id, type, body, new Date().toISOString())

    return NextResponse.json({ body })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed.' },
      { status: 502 },
    )
  }
}

export async function PUT(request: Request) {
  const { applicationId, type, body } = await request.json()
  if (!VALID_TYPES.includes(type) || typeof body !== 'string') {
    return NextResponse.json({ error: 'Invalid document.' }, { status: 400 })
  }

  db.prepare(`
    INSERT INTO documents (application_id, type, body, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(application_id, type) DO UPDATE SET body = excluded.body, created_at = excluded.created_at
  `).run(Number(applicationId), type, body, new Date().toISOString())

  return NextResponse.json({ ok: true })
}
