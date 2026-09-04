// ponytail: pdf-parse's main entry runs a debug parse when webpack hides module.parent
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buffer: Buffer) => Promise<{ text: string }>

const MAX_BYTES = 8 * 1024 * 1024

export async function extractResumeFile(buffer: Buffer, filename: string) {
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error('File is too large. Use a resume under 8 MB.')
  }

  const name = filename.toLowerCase()
  if (name.endsWith('.txt') || name.endsWith('.md')) {
    const text = buffer.toString('utf8').trim()
    if (!text) throw new Error('That file is empty.')
    return text
  }

  if (!name.endsWith('.pdf')) {
    throw new Error('Upload a PDF, Markdown, or text resume.')
  }

  const result = await pdfParse(buffer)
  const text = result.text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim()
  if (!text) {
    throw new Error('Could not read text from that PDF. Image-only scans will not work.')
  }
  return text
}
