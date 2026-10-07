import fs from 'node:fs'
import path from 'node:path'
import { jsPDF } from 'jspdf'
import { cleanGeneratedResume } from './resumeFormat'

function loadGaramond(pdf: jsPDF) {
  const dir = path.join(process.cwd(), 'src/lib/fonts')
  pdf.addFileToVFS('EBGaramond-Regular.ttf', fs.readFileSync(path.join(dir, 'EBGaramond-Regular.ttf')).toString('base64'))
  pdf.addFont('EBGaramond-Regular.ttf', 'EBGaramond', 'normal')
  pdf.addFileToVFS('EBGaramond-Bold.ttf', fs.readFileSync(path.join(dir, 'EBGaramond-Bold.ttf')).toString('base64'))
  pdf.addFont('EBGaramond-Bold.ttf', 'EBGaramond', 'bold')
}

function pdfSafe(text: string) {
  return text
    .replace(/[•·◦]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/₹/g, 'Rs')
    .replace(/[^\u0000-\u00ff]/g, '')
}

function runs(line: string) {
  const parts: { text: string; bold: boolean }[] = []
  const safe = pdfSafe(line)
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(safe))) {
    if (match.index > last) parts.push({ text: safe.slice(last, match.index), bold: false })
    parts.push({ text: match[1], bold: true })
    last = match.index + match[0].length
  }
  if (last < safe.length) parts.push({ text: safe.slice(last), bold: false })
  const label = safe.match(/^([^:]{2,40}):\s/)
  if (label && !parts.some((part) => part.bold)) {
    return [
      { text: `${label[1]}: `, bold: true },
      { text: safe.slice(label[0].length), bold: false },
    ]
  }
  return parts.length ? parts : [{ text: safe, bold: false }]
}

function isSection(line: string) {
  return /^(skills(?:\s*&\s*|\s+and\s+)?tech\s+stack|experience|education)$/i.test(line.trim())
}

function isBullet(line: string) {
  return /^[-*◦•]\s+/.test(line.trim())
}

function isTitleLine(line: string) {
  return /^(software engineer|frontend engineer|frontend developer|intern)\b/i.test(line.trim())
    && !/20\d{2}|present|linkedin|email|mobile/i.test(line)
}

function isContactBit(bit: string) {
  return /linkedin|email|mobile|leetcode|github|https?:\/\/|@|\+91/i.test(bit)
}

function splitLocation(line: string) {
  const match = line.match(/^(.*?)\s+((?:Bengaluru|Bangalore|Chandigarh|Mumbai|Delhi|Hyderabad|Pune|Remote)\b.*)$/i)
  if (match) return [match[1].trim(), match[2].trim()] as const
  const india = line.match(/^(.*?)\s+([^,]+,\s*[^,]+,\s*India)$/i)
  if (india) return [india[1].trim(), india[2].trim()] as const
  return null
}

function splitDates(line: string) {
  const range = line.match(/^(.*?)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*[-–]\s*(?:Present|[A-Za-z]+\s+\d{4}))$/i)
  if (range) return [range[1].trim(), range[2].trim()] as const
  const year = line.match(/^(.*?)\s+(20\d{2})$/)
  if (year) return [year[1].trim(), year[2].trim()] as const
  return null
}

function splitPair(line: string) {
  const tab = line.split(/\t+/)
  if (tab.length >= 2) return [tab[0].trim(), tab.slice(1).join(' ').trim()] as const
  return splitLocation(line) ?? splitDates(line)
}

export function buildResumePdf(body: string) {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
  loadGaramond(pdf)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const left = 48
  const right = pageWidth - 48
  const width = right - left
  let y = 42
  const lineH = 11

  function setStyle(size: number, bold: boolean) {
    pdf.setFont('EBGaramond', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(20, 24, 22)
  }

  function wrapRuns(items: { text: string; bold: boolean }[], size: number, indent = 0) {
    const max = width - indent
    const words: { text: string; bold: boolean }[] = []
    for (const item of items) {
      const pieces = item.text.split(/(\s+)/)
      for (const piece of pieces) {
        if (piece) words.push({ text: piece, bold: item.bold })
      }
    }
    const rows: { text: string; bold: boolean }[][] = [[]]
    let rowWidth = 0
    for (const word of words) {
      setStyle(size, word.bold)
      const w = pdf.getTextWidth(word.text)
      if (rowWidth + w > max && rows[rows.length - 1].length) {
        rows.push([word])
        rowWidth = w
      } else {
        rows[rows.length - 1].push(word)
        rowWidth += w
      }
    }
    return rows
  }

  function drawRows(rows: { text: string; bold: boolean }[][], size: number, indent = 0) {
    for (const row of rows) {
      if (y > pageHeight - 40) return
      let x = left + indent
      for (const part of row) {
        setStyle(size, part.bold)
        pdf.text(part.text, x, y)
        x += pdf.getTextWidth(part.text)
      }
      y += lineH
    }
  }

  function drawRight(text: string, size: number, bold = false) {
    setStyle(size, bold)
    pdf.text(pdfSafe(text), right, y, { align: 'right' })
  }

  function drawContacts(bits: string[]) {
    const chunks: { text: string; link: boolean }[] = []
    bits.forEach((bit, index) => {
      if (index) chunks.push({ text: '  |  ', link: false })
      const re = /https?:\/\/\S+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
      let last = 0
      let match: RegExpExecArray | null
      while ((match = re.exec(bit))) {
        if (match.index > last) chunks.push({ text: bit.slice(last, match.index), link: false })
        chunks.push({ text: match[0], link: true })
        last = match.index + match[0].length
      }
      if (last < bit.length) chunks.push({ text: bit.slice(last), link: false })
    })
    const size = 8.5
    let x = left
    for (const chunk of chunks) {
      if (!chunk.text) continue
      setStyle(size, false)
      if (chunk.link) pdf.setTextColor(5, 99, 193)
      const pieces = pdf.splitTextToSize(chunk.text, Math.max(40, right - x)) as string[]
      for (let p = 0; p < pieces.length; p += 1) {
        if (p > 0) {
          y += 11
          x = left
        }
        pdf.text(pieces[p], x, y)
        x += pdf.getTextWidth(pieces[p])
      }
      pdf.setTextColor(20, 24, 22)
    }
    y += 12
  }

  const lines = cleanGeneratedResume(body).split('\n').map((line) => line.replace(/\s+$/, ''))
  let i = 0
  const preamble: string[] = []
  while (i < lines.length && !isSection(lines[i] ?? '') && !isBullet(lines[i] ?? '')) {
    if (lines[i].trim()) preamble.push(lines[i].trim().replace(/^#+\s*/, ''))
    i += 1
  }

  const bits = preamble.flatMap((line) => line.split(/\s*\|\s*/).map((bit) => bit.trim()).filter(Boolean))
  const name = bits.find((bit) => !isContactBit(bit) && !isTitleLine(bit) && !bit.includes(':') && bit.split(/\s+/).length <= 4) ?? bits[0] ?? ''
  const title = bits.find((bit) => isTitleLine(bit)) ?? bits.find((bit) => /engineer|developer/i.test(bit) && !isContactBit(bit) && !/20\d{2}/.test(bit)) ?? ''
  const contacts = bits.filter((bit) => bit !== name && bit !== title && isContactBit(bit))

  if (name) {
    setStyle(16, true)
    pdf.text(pdfSafe(name), left, y)
    y += 15
  }
  if (title) {
    setStyle(11, true)
    pdf.text(pdfSafe(title), left, y)
    y += 13
  }
  if (contacts.length) drawContacts(contacts)
  const leftover = bits.filter((bit) => bit !== name && bit !== title && !contacts.includes(bit))
  for (const bit of leftover) {
    drawRows(wrapRuns(runs(bit), 9), 9)
  }

  while (i < lines.length) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed) {
      y += 3
      i += 1
      continue
    }
    if (isSection(trimmed)) {
      y += 6
      setStyle(11, true)
      pdf.text(pdfSafe(trimmed.replace(/^#+\s*/, '')), left, y)
      y += 4
      pdf.setDrawColor(40, 44, 42)
      pdf.setLineWidth(0.6)
      pdf.line(left, y, right, y)
      y += 12
      i += 1
      continue
    }
    if (isBullet(trimmed)) {
      const text = trimmed.replace(/^[-*◦•]\s+/, '')
      setStyle(9, false)
      pdf.text('-', left, y)
      drawRows(wrapRuns(runs(text), 9, 12), 9, 12)
      i += 1
      continue
    }

    const pair = splitPair(trimmed.replace(/^#+\s*/, ''))
    if (pair) {
      setStyle(10, true)
      pdf.text(pdfSafe(pair[0]), left, y)
      drawRight(pair[1], 9)
      y += 12
      i += 1
      continue
    }

    drawRows(wrapRuns(runs(trimmed.replace(/^#+\s*/, '')), 9), 9)
    i += 1
  }

  return pdf
}
