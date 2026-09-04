import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeAts } from './ats'

test('ATS analysis rewards truthful keyword and structure matches', () => {
  const result = analyzeAts(
    `Jane Doe · jane@example.com
Experience
Built TypeScript and React applications.
Skills
TypeScript, React, accessibility`,
    'Seeking an engineer with TypeScript, React, accessibility, and Kubernetes experience.',
  )

  assert(result.matched.includes('typescript'))
  assert(result.missing.includes('kubernetes'))
  assert(result.checks.find((check) => check.label.includes('experience'))?.passed)
  assert(result.score > 50)
})
