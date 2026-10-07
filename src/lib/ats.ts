import type { AtsResult } from './types'

const STOP_WORDS = new Set([
  'about', 'able', 'across', 'after', 'also', 'and', 'api', 'are', 'backend',
  'build', 'building', 'but', 'can', 'candidate', 'clean', 'code', 'company',
  'component', 'components', 'contribute', 'contributing', 'data', 'deliver',
  'delivery', 'design', 'end-to-end', 'error', 'etc', 'experience', 'extend',
  'feature', 'features', 'for', 'from', 'frontend', 'have', 'including', 'into',
  'job', 'like', 'looking', 'modular', 'more', 'must', 'our', 'patterns',
  'performance', 'plus', 'position', 'preferred', 'qualifications',
  'requirements', 'required', 'responsibilities', 'role', 'seeking', 'should',
  'strong', 'such', 'team', 'that', 'the', 'their', 'this', 'through',
  'tradeoff', 'tradeoffs', 'using', 'well', 'will', 'with', 'within', 'work',
  'you', 'your', 'years', 'tools', 'tool',
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

function strings(value: unknown, max: number) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length >= 2 && item.length <= 80)
    .slice(0, max)
}

function inText(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

export function parseFitResponse(raw: string) {
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const start = json.indexOf('{')
  const end = json.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(json.slice(start, end + 1)) as Record<string, unknown>
    return {
      matched: strings(parsed.matched, 16),
      missing: strings(parsed.missing, 16),
      improve: strings(parsed.improve, 8),
      keep: strings(parsed.keep, 8),
    }
  } catch {
    return null
  }
}

export function groundFit(
  parsed: { matched: string[]; missing: string[]; improve: string[]; keep: string[] },
  resume: string,
): Pick<AtsResult, 'matched' | 'missing' | 'improve' | 'keep'> {
  const matched = parsed.matched.filter((item) => inText(resume, item) && !STOP_WORDS.has(item.toLowerCase()))
  const missing = parsed.missing.filter((item) => !inText(resume, item) && !STOP_WORDS.has(item.toLowerCase()))
  return {
    matched,
    missing,
    improve: parsed.improve,
    keep: parsed.keep.length ? parsed.keep : [
      'Employer names, titles, dates, and metrics already on the resume',
      'Do not invent tools, teams, or results to chase the job description',
    ],
  }
}

export function analyzeAts(resume: string, jobDescription: string): AtsResult {
  const keywords = terms(jobDescription)
  const matched = keywords.filter((keyword) => inText(resume, keyword))
  const missing = keywords.filter((keyword) => !inText(resume, keyword))
  const hasContact = /@|linkedin\.com|github\.com|\+?\d[\d\s()-]{7,}/i.test(resume)
  const hasExperience = /\b(experience|employment|work history)\b/i.test(resume)
  const hasSkills = /\b(skills|technologies|technical skills)\b/i.test(resume)
  const hasTables = /\|.+\|/.test(resume)

  const improve: string[] = []
  const keep: string[] = [
    'Employer names, titles, dates, and metrics already on the resume',
    'Do not invent tools, teams, or results to chase the job description',
  ]

  if (!hasContact) improve.push('Add email or LinkedIn so a recruiter can reach you')
  else keep.push('Keep the contact line as it is')

  if (!hasExperience) improve.push('Add a clear Experience heading and keep jobs in order')
  else keep.push('Keep the job history and its order')

  if (!hasSkills) improve.push('Add a Skills section listing tools you actually use')
  else keep.push('Keep the Skills section; only add a tool you have used')

  if (hasTables) improve.push('Replace table or pipe columns with simple bullets')
  else keep.push('Keep a single-column layout')

  if (missing.length) {
    improve.push('Treat missing terms as a checklist. Add one only if it already describes your work')
  }
  if (matched.length) {
    keep.push('Phrases that already overlap the JD can stay as written')
  }

  return scoreFit({ matched, missing, improve, keep }, resume)
}

function scoreFit(parts: Pick<AtsResult, 'matched' | 'missing' | 'improve' | 'keep'>, resume: string): AtsResult {
  const keywordTotal = parts.matched.length + parts.missing.length
  const keywordScore = keywordTotal ? parts.matched.length / keywordTotal : 0
  const formatScore = [
    /@|linkedin\.com|github\.com|\+?\d[\d\s()-]{7,}/i.test(resume),
    /\b(experience|employment|work history)\b/i.test(resume),
    /\b(skills|technologies|technical skills)\b/i.test(resume),
    !/\|.+\|/.test(resume),
  ].filter(Boolean).length / 4

  return {
    ...parts,
    score: Math.round((keywordScore * 0.8 + formatScore * 0.2) * 100),
  }
}

export function fitPrompt(resume: string, jobDescription: string) {
  return `Compare MASTER RESUME to JOB DESCRIPTION.

Return ONLY JSON:
{"matched":["..."],"missing":["..."],"improve":["..."],"keep":["..."]}

matched: concrete requirements from the JD that already appear in the resume (languages, frameworks, libraries, products, methods, domains). Prefer the resume's wording when it is close. 8-16 items.

missing: concrete JD requirements that do NOT appear in the resume. Name the actual thing (Storybook, GraphQL, CI/CD, WCAG, Redis, system design). 8-16 items.

NEVER put filler in matched or missing. Banned examples: requirements, features, experience, team, like, clean, build, deliver, code, design, tools, data, error, api, performance, contribute, modular, tradeoffs, extend, patterns, components, frontend, backend, end-to-end.

improve: 4-6 specific edit suggestions that do not invent jobs. Example: "If you have used Storybook, add it under Skills and one bullet." Not "be more senior."

keep: 4-6 things they must not change: employers, titles, dates, metrics, stack already listed.

Do not rewrite the resume. Do not invent experience.

MASTER RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}`
}

export function applyFitResponse(raw: string, resume: string, jobDescription: string) {
  const parsed = parseFitResponse(raw)
  if (!parsed || (!parsed.matched.length && !parsed.missing.length)) {
    return analyzeAts(resume, jobDescription)
  }
  return scoreFit(groundFit(parsed, resume), resume)
}
