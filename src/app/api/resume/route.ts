import fs from 'node:fs'
import { NextResponse } from 'next/server'
import db, { masterResumeNamePath, masterResumePdfPath } from '@/lib/db'
import { extractResumeFile } from '@/lib/pdfText'

export const runtime = 'nodejs'

function hasPdf() {
  return fs.existsSync(masterResumePdfPath)
}

function pdfName() {
  return fs.existsSync(masterResumeNamePath) ? fs.readFileSync(masterResumeNamePath, 'utf8').trim() : ''
}

function saveResume(body: string, keepPdf: boolean, filename = '') {
  if (!keepPdf && hasPdf()) fs.unlinkSync(masterResumePdfPath)
  if (!keepPdf && fs.existsSync(masterResumeNamePath)) fs.unlinkSync(masterResumeNamePath)
  if (keepPdf && filename) fs.writeFileSync(masterResumeNamePath, filename)
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO resumes (user_id, body, updated_at) VALUES ('local', ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at
  `).run(body, now)
  return { body, hasPdf: keepPdf, filename: keepPdf ? filename || pdfName() : '', updated_at: now }
}

export function GET() {
  const resume = db.prepare('SELECT body, updated_at FROM resumes WHERE user_id = ?').get('local') as
    | { body: string; updated_at: string }
    | undefined
  return NextResponse.json({
    body: resume?.body ?? '',
    hasPdf: hasPdf(),
    filename: pdfName(),
    updated_at: resume?.updated_at ?? null,
  })
}

export async function PUT(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('multipart/form-data')) {
      const file = (await request.formData()).get('file')
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'Choose a resume file.' }, { status: 400 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const name = file.name || 'resume.pdf'
      const body = await extractResumeFile(buffer, name)
      const isPdf = name.toLowerCase().endsWith('.pdf')
      if (isPdf) fs.writeFileSync(masterResumePdfPath, buffer)
      else if (hasPdf()) fs.unlinkSync(masterResumePdfPath)
      return NextResponse.json(saveResume(body, isPdf, isPdf ? name : ''))
    }

    const { body } = await request.json()
    if (typeof body !== 'string') {
      return NextResponse.json({ error: 'Resume text is required.' }, { status: 400 })
    }
    return NextResponse.json(saveResume(body.trim(), false))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save resume.' },
      { status: 400 },
    )
  }
}
