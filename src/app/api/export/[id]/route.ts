import { NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import db from '@/lib/db'

export const runtime = 'nodejs'

export function GET(_: Request, { params }: { params: { id: string } }) {
  const row = db.prepare(`
    SELECT d.body, a.company, a.role
    FROM documents d JOIN applications a ON a.id = d.application_id
    WHERE d.application_id = ? AND d.type = 'resume' AND a.user_id = 'local'
  `).get(Number(params.id)) as { body: string; company: string; role: string } | undefined

  if (!row) return NextResponse.json({ error: 'Generate a resume first.' }, { status: 404 })

  const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  const margin = 50
  const pageHeight = pdf.internal.pageSize.getHeight()
  let y = margin

  for (const rawLine of row.body.split('\n')) {
    const line = rawLine.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').replace(/^[-*]\s+/, '• ')
    const wrapped = pdf.splitTextToSize(line || ' ', 512) as string[]
    for (const part of wrapped) {
      if (y > pageHeight - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.text(part, margin, y)
      y += 14
    }
    y += rawLine ? 2 : 6
  }

  const fileName = `${row.company}-${row.role}-resume`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return new NextResponse(Buffer.from(pdf.output('arraybuffer')), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
    },
  })
}
