export const RESUME_TEMPLATE = `Your Name
Software Engineer
LinkedIn : https://linkedin.com/in/your-handle
Email : you@email.com
Mobile : +91 0000000000

Skills & Tech Stack
Languages: JavaScript · TypeScript
Frontend: React · Next.js

Experience
Company Name	City, Country
Job Title	Month YYYY - Present
- Replace this with a result you owned. Use a metric if you have one.

Education
School Name	City, Country
Degree	YYYY
`

export function cleanGeneratedResume(text: string) {
  return text
    .trim()
    .replace(/^```(?:markdown|md|text)?\s*/i, '')
    .replace(/\s*```$/ , '')
    .replace(/^\s*markdown\s*\n/i, '')
    .replace(/\n(?:generated|written|added) by ai\.?\s*$/i, '')
    .trim()
}

function inlineParts(text: string) {
  const parts: Array<{ text: string; bold?: boolean }> = []
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\([^)]+\)/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) })
    parts.push({ text: match[1] ?? match[2] ?? '', bold: Boolean(match[1]) })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

export function resumePreviewBlocks(text: string) {
  const body = cleanGeneratedResume(text)
  return body.split('\n').map((line) => {
    const trimmed = line.trim()
    if (!trimmed) return { kind: 'gap' as const }
    if (/^#{1,6}\s+/.test(trimmed)) {
      const depth = trimmed.match(/^#+/)?.[0].length ?? 1
      return { kind: 'heading' as const, level: Math.min(depth, 3), parts: inlineParts(trimmed.replace(/^#{1,6}\s+/, '')) }
    }
    if (/^[-*]\s+/.test(trimmed)) {
      return { kind: 'bullet' as const, parts: inlineParts(trimmed.replace(/^[-*]\s+/, '')) }
    }
    return { kind: 'line' as const, parts: inlineParts(trimmed) }
  })
}
