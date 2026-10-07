// ponytail: pdf-parse's main entry runs a debug parse when webpack hides module.parent
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
  buffer: Buffer,
  options?: { pagerender?: (page: { getTextContent: Function }) => Promise<string> },
) => Promise<{ text: string }>

function promoteNameLine(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const name = lines.find((line) =>
    !line.includes(':') && !/skills|experience|education|engineer|linkedin|http/i.test(line) && line.split(/\s+/).length <= 3,
  )
  if (!name) return text
  return [name, ...lines.filter((line) => line !== name)].join('\n')
}

function renderPage(pageData: { getTextContent: (options: object) => Promise<{ items: { str: string; transform: number[] }[] }> }) {
  return pageData.getTextContent({ normalizeWhitespace: true }).then((textContent) => {
    const items = textContent.items.filter((item) => item.str?.trim())
    items.sort((a, b) => {
      const y = b.transform[5] - a.transform[5]
      if (Math.abs(y) > 2.5) return y
      return a.transform[4] - b.transform[4]
    })
    const lines: string[] = []
    let row: string[] = []
    let lastY: number | undefined
    for (const item of items) {
      const y = item.transform[5]
      if (lastY != null && Math.abs(y - lastY) > 2.5) {
        lines.push(row.join(' ').replace(/\s+/g, ' ').trim())
        row = []
      }
      row.push(item.str)
      lastY = y
    }
    if (row.length) lines.push(row.join(' ').replace(/\s+/g, ' ').trim())
    return lines.filter(Boolean).join('\n')
  })
}

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

  let result: { text: string }
  try {
    result = await pdfParse(buffer, { pagerender: renderPage, max: 0, version: 'v1.10.100' })
  } catch {
    result = await pdfParse(buffer)
  }
  const text = promoteNameLine(result.text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim())
  if (!text) {
    throw new Error('Could not read text from that PDF. Image-only scans will not work.')
  }
  return text
}
