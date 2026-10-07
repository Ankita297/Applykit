import assert from 'node:assert/strict'
import test from 'node:test'
import { emphasizeTerms, parseKeywordList } from './emphasize'

test('bolds only terms already in the resume and keeps company order', () => {
  const resume = `Experience
Orange Health Labs
- Clinic Front-Desk: Built Next.js booking.
Netix.ai
- Platform Development: React.js asset management.
AppyHigh
- Design to Production UI: Figma to Material UI.`
  const out = emphasizeTerms(resume, ['Next.js', 'React.js', 'Kubernetes'])
  assert.match(out, /\*\*Next\.js\*\*/)
  assert.match(out, /\*\*React\.js\*\*/)
  assert.doesNotMatch(out, /Kubernetes/)
  assert.ok(out.indexOf('Orange Health') < out.indexOf('Netix.ai'))
  assert.ok(out.indexOf('Netix.ai') < out.indexOf('AppyHigh'))
})

test('parses a JSON keyword array from model output', () => {
  assert.deepEqual(parseKeywordList('Here you go:\n["TypeScript","Next.js"]\n'), ['TypeScript', 'Next.js'])
})
