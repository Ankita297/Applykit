import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeAts, applyFitResponse, parseFitResponse } from './ats'

test('heuristic fit splits match, missing, improve, and keep', () => {
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
  assert(!result.missing.includes('experience'))
  assert(result.keep.some((line) => /job history/i.test(line)))
  assert(result.score > 50)
})

test('parses model JSON and drops filler plus ungrounded matches', () => {
  const resume = `Jane Doe jane@example.com
Experience
React and TypeScript at Acme, 2024 - Present
Skills
React, TypeScript, accessibility`
  const raw = `Here you go
\`\`\`json
{"matched":["React","TypeScript","Kubernetes","experience"],"missing":["Storybook","GraphQL","React"],"improve":["If you have used Storybook, add it under Skills."],"keep":["Keep Acme, title, and dates."]}
\`\`\``
  const parsed = parseFitResponse(raw)
  assert.deepEqual(parsed?.matched, ['React', 'TypeScript', 'Kubernetes', 'experience'])
  const result = applyFitResponse(raw, resume, 'We need React, TypeScript, Storybook, GraphQL')
  assert(result.matched.includes('React'))
  assert(result.matched.includes('TypeScript'))
  assert(!result.matched.includes('Kubernetes'))
  assert(!result.matched.includes('experience'))
  assert(result.missing.includes('Storybook'))
  assert(result.missing.includes('GraphQL'))
  assert(!result.missing.includes('React'))
  assert(result.improve[0].includes('Storybook'))
})
