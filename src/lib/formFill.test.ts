import assert from 'node:assert/strict'
import test from 'node:test'
import { matchFillKey } from './formFill'

test('maps common Workday-style labels and skips sensitive fields', () => {
  assert.equal(matchFillKey('Legal First Name'), 'first_name')
  assert.equal(matchFillKey('Email Address'), 'email')
  assert.equal(matchFillKey('ZIP Code'), 'postal_code')
  assert.equal(matchFillKey('Are you legally authorized to work in this country?'), 'work_authorization')
  assert.equal(matchFillKey('Gender'), null)
  assert.equal(matchFillKey('Social Security Number'), null)
  assert.equal(matchFillKey('Desired salary'), null)
})
