import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { analyzeAts } from '@/lib/ats'
import type { Application, DocumentType } from '@/lib/types'

export const runtime = 'nodejs'

const VALID_TYPES: DocumentType[] = ['resume', 'cover_letter', 'cold_email']

function promptFor(type: DocumentType, application: Application, masterResume: string) {
  const context = `
MASTER RESUME:
${masterResume}

JOB:
${application.role} at ${application.company}

JOB DESCRIPTION:
${application.jd_text}`

  if (type === 'resume') {
    return `Rewrite the resume in clean ATS-friendly Markdown for this job.
Keep every claim truthful: never invent employment, skills, education, dates, or metrics.
Prioritize relevant evidence and naturally use matching job-description language only when supported.
Use a single-column structure with standard headings. Return only the complete resume.\n${context}`
  }
  if (type === 'cover_letter') {
    return `Write a concise, specific cover letter (250-350 words) for this application.
Use only facts in the resume. Avoid clichés, placeholders, and invented claims.
Return only the letter.\n${context}`
  }
  return `Write a concise cold email to ${application.recruiter_name || 'the hiring team'} about this role.
Include a strong subject line, 3 short paragraphs, and a clear ask. Keep it under 150 words.
Use only facts in the resume. Return only the email.\n${context}`
}

async function generateText(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Add OPENAI_API_KEY to .env.local before generating documents.')

  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a careful career-writing assistant. Accuracy matters more than keyword stuffing.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message ?? 'The AI provider rejected the request.')

  return data.choices?.[0]?.message?.content?.trim() as string | undefined
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
    const body = await generateText(promptFor(type, application, resume.body))
    if (!body) throw new Error('The AI provider returned an empty response.')

    db.prepare(`
      INSERT INTO documents (application_id, type, body, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(application_id, type) DO UPDATE SET body = excluded.body, created_at = excluded.created_at
    `).run(application.id, type, body, new Date().toISOString())

    return NextResponse.json({
      body,
      ats: type === 'resume' ? analyzeAts(body, application.jd_text) : undefined,
    })
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
