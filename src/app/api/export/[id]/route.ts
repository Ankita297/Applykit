import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { buildResumePdf } from '@/lib/resumePdf'

export const runtime = 'nodejs'

export function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const row = db.prepare(`
      SELECT d.body, a.company, a.role
      FROM documents d JOIN applications a ON a.id = d.application_id
      WHERE d.application_id = ? AND d.type = 'resume' AND a.user_id = 'local'
    `).get(Number(params.id)) as { body: string; company: string; role: string } | undefined

    if (!row) return NextResponse.json({ error: 'Generate a resume first.' }, { status: 404 })

    const pdf = buildResumePdf(row.body)
    const fileName = `${row.company}-${row.role}-resume`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'resume'
    const inline = new URL(request.url).searchParams.has('inline')

    return new NextResponse(Buffer.from(pdf.output('arraybuffer')), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${fileName}.pdf"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not export PDF.' },
      { status: 500 },
    )
  }
}
