import assert from 'node:assert/strict'
import test from 'node:test'
import { jsPDF } from 'jspdf'
import { extractResumeFile } from './pdfText'

test('extracts text from a PDF and from markdown', async () => {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
  pdf.text('Jane Doe TypeScript', 72, 72)
  const fromPdf = await extractResumeFile(Buffer.from(pdf.output('arraybuffer')), 'resume.pdf')
  assert.match(fromPdf, /Jane Doe TypeScript/)

  const fromMd = await extractResumeFile(Buffer.from('# Ankita\nReact'), 'resume.md')
  assert.equal(fromMd, '# Ankita\nReact')
})
