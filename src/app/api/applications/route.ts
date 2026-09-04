import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { STATUSES, type Application, type DocumentType } from '@/lib/types'

export const runtime = 'nodejs'

type DocumentRow = { application_id: number; type: DocumentType; body: string }

export function GET() {
  const applications = db.prepare(
    'SELECT * FROM applications WHERE user_id = ? ORDER BY updated_at DESC',
  ).all('local') as Omit<Application, 'documents'>[]
  const documents = db.prepare(
    `SELECT application_id, type, body FROM documents
     WHERE application_id IN (SELECT id FROM applications WHERE user_id = ?)`,
  ).all('local') as DocumentRow[]

  return NextResponse.json(applications.map((application) => ({
    ...application,
    documents: Object.fromEntries(
      documents
        .filter((document) => document.application_id === application.id)
        .map((document) => [document.type, document.body]),
    ),
  })))
}

export async function POST(request: Request) {
  const input = await request.json()
  if (!input.company?.trim() || !input.role?.trim() || !input.jd_text?.trim()) {
    return NextResponse.json(
      { error: 'Company, role, and job description are required.' },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const result = db.prepare(`
    INSERT INTO applications
      (user_id, company, role, job_url, jd_text, status, notes, recruiter_name,
       recruiter_email, created_at, updated_at)
    VALUES ('local', ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
  `).run(
    input.company.trim(),
    input.role.trim(),
    input.job_url?.trim() ?? '',
    input.jd_text.trim(),
    input.notes?.trim() ?? '',
    input.recruiter_name?.trim() ?? '',
    input.recruiter_email?.trim() ?? '',
    now,
    now,
  )

  return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 })
}

export async function PATCH(request: Request) {
  const input = await request.json()
  const status = STATUSES.includes(input.status) ? input.status : 'draft'
  const now = new Date().toISOString()
  const appliedAt = status === 'applied' ? input.applied_at || now : input.applied_at || null

  const result = db.prepare(`
    UPDATE applications SET company = ?, role = ?, job_url = ?, jd_text = ?,
      status = ?, applied_at = ?, notes = ?, recruiter_name = ?,
      recruiter_email = ?, updated_at = ?
    WHERE id = ? AND user_id = 'local'
  `).run(
    input.company?.trim() ?? '',
    input.role?.trim() ?? '',
    input.job_url?.trim() ?? '',
    input.jd_text?.trim() ?? '',
    status,
    appliedAt,
    input.notes?.trim() ?? '',
    input.recruiter_name?.trim() ?? '',
    input.recruiter_email?.trim() ?? '',
    now,
    Number(input.id),
  )

  return result.changes
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Application not found.' }, { status: 404 })
}

export async function DELETE(request: Request) {
  const { id } = await request.json()
  db.prepare("DELETE FROM applications WHERE id = ? AND user_id = 'local'").run(Number(id))
  return NextResponse.json({ ok: true })
}
