import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { extractResumeFile } from '@/lib/pdfText'

export const runtime = 'nodejs'

function saveResume(body: string) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO resumes (user_id, body, updated_at) VALUES ('local', ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at
  `).run(body, now)
  return { body, updated_at: now }
}

export function GET() {
  const resume = db.prepare('SELECT body, updated_at FROM resumes WHERE user_id = ?').get('local')
  return NextResponse.json(resume ?? { body: '', updated_at: null })
}

export async function PUT(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('multipart/form-data')) {
      const file = (await request.formData()).get('file')
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'Choose a resume file.' }, { status: 400 })
      }
      const body = await extractResumeFile(Buffer.from(await file.arrayBuffer()), file.name || 'resume.pdf')
      return NextResponse.json(saveResume(body))
    }

    const { body } = await request.json()
    if (typeof body !== 'string') {
      return NextResponse.json({ error: 'Resume text is required.' }, { status: 400 })
    }
    return NextResponse.json(saveResume(body.trim()))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save resume.' },
      { status: 400 },
    )
  }
}
