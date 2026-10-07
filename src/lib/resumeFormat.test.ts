import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanGeneratedResume, RESUME_TEMPLATE } from './resumeFormat'

test('strips markdown fences and markdown label the model often prepends', () => {
  const raw = '```markdown\n# Ankita\n**Engineer**\n```'
  assert.equal(cleanGeneratedResume(raw), '# Ankita\n**Engineer**')
})

test('base template has the header and section skeleton the PDF layout expects', () => {
  assert.match(RESUME_TEMPLATE, /^Your Name\nSoftware Engineer\nLinkedIn/)
  assert.match(RESUME_TEMPLATE, /\nExperience\n/)
  assert.match(RESUME_TEMPLATE, /\tCity, Country\n/)
})
