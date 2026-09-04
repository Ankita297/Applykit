import type { AtsResult } from './types'

const STOP_WORDS = new Set([
  'about', 'after', 'also', 'and', 'are', 'but', 'can', 'company', 'for', 'from',
  'have', 'into', 'job', 'more', 'our', 'role', 'that', 'the', 'their', 'this',
  'through', 'using', 'will', 'with', 'work', 'you', 'your', 'years',
])

function terms(text: string) {
  const counts = new Map<string, number>()
  const words = text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []

  for (const word of words) {
    if (!STOP_WORDS.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1)
  }

  return Array.from(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([word]) => word)
}

export function analyzeAts(resume: string, jobDescription: string): AtsResult {
  const keywords = terms(jobDescription)
  const normalizedResume = resume.toLowerCase()
  const matched = keywords.filter((keyword) => normalizedResume.includes(keyword))
  const missing = keywords.filter((keyword) => !normalizedResume.includes(keyword))
  const checks = [
    { label: 'Includes contact details', passed: /@|linkedin\.com|github\.com|\+?\d[\d\s()-]{7,}/i.test(resume) },
    { label: 'Uses a standard experience heading', passed: /\b(experience|employment|work history)\b/i.test(resume) },
    { label: 'Includes a skills section', passed: /\b(skills|technologies|technical skills)\b/i.test(resume) },
    { label: 'Avoids table-like formatting', passed: !/\|.+\|/.test(resume) },
  ]
  const keywordScore = keywords.length ? matched.length / keywords.length : 0
  const formatScore = checks.filter((check) => check.passed).length / checks.length

  return {
    score: Math.round((keywordScore * 0.8 + formatScore * 0.2) * 100),
    matched,
    missing,
    checks,
  }
}
