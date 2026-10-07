import fs from 'node:fs'
import { NextResponse } from 'next/server'
import db, { masterResumeNamePath, masterResumePdfPath } from '@/lib/db'

export const runtime = 'nodejs'

export function GET() {
  if (!fs.existsSync(masterResumePdfPath)) {
    return NextResponse.json({ error: 'No PDF uploaded.' }, { status: 404 })
  }
  const file = fs.readFileSync(masterResumePdfPath)
  const filename = fs.existsSync(masterResumeNamePath)
    ? fs.readFileSync(masterResumeNamePath, 'utf8').trim() || 'master-resume.pdf'
    : 'master-resume.pdf'
  return new NextResponse(file, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export function DELETE() {
  if (fs.existsSync(masterResumePdfPath)) fs.unlinkSync(masterResumePdfPath)
  if (fs.existsSync(masterResumeNamePath)) fs.unlinkSync(masterResumeNamePath)
  const resume = db.prepare('SELECT body, updated_at FROM resumes WHERE user_id = ?').get('local') as
    | { body: string; updated_at: string }
    | undefined
  return NextResponse.json({
    body: resume?.body ?? '',
    hasPdf: false,
    filename: '',
    updated_at: resume?.updated_at ?? null,
  })
}
