import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeInput } from '../middleware/sanitize.js'

test('strips mongo operator keys from a request body, including nested and in arrays', () => {
  const req = {
    body: {
      email: { $ne: null },
      nested: { ok: 1, $where: 'return true' },
      list: [{ $gt: 0 }, { keep: 'me' }],
    },
    query: {},
    params: {},
  }

  let nextCalled = false
  sanitizeInput(req, {}, () => { nextCalled = true })

  assert.equal(nextCalled, true)
  assert.deepEqual(req.body.email, {})
  assert.deepEqual(req.body.nested, { ok: 1 })
  assert.deepEqual(req.body.list, [{}, { keep: 'me' }])
})

test('strips dotted keys used for query path traversal', () => {
  const req = { body: { 'a.b': 1, ok: 2 }, query: {}, params: {} }
  sanitizeInput(req, {}, () => {})
  assert.deepEqual(req.body, { ok: 2 })
})

test('leaves ordinary values untouched', () => {
  const req = { body: { email: 'a@b.com', n: 3, arr: [1, 2] }, query: {}, params: {} }
  sanitizeInput(req, {}, () => {})
  assert.deepEqual(req.body, { email: 'a@b.com', n: 3, arr: [1, 2] })
})
