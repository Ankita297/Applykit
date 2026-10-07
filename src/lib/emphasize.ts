export function emphasizeTerms(resume: string, terms: string[]) {
  const unique = [...new Set(terms.map((term) => term.trim()).filter((term) => term.length > 2))]
    .sort((a, b) => b.length - a.length)
  let out = resume
  for (const term of unique) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const found = new RegExp(escaped, 'i').exec(out)
    if (!found) continue
    const re = new RegExp(`(?<![\\w*])(${escaped})(?![\\w*])`, 'gi')
    out = out.replace(re, '**$1**')
  }
  return out
}

export function parseKeywordList(raw: string) {
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return [] as string[]
  try {
    const parsed = JSON.parse(match[0]) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}
