import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { clientOrigin } from '../utils/clientOrigin.js'

const saved = process.env.CLIENT_ORIGIN

afterEach(() => {
  if (saved === undefined) delete process.env.CLIENT_ORIGIN
  else process.env.CLIENT_ORIGIN = saved
})

test('picks the first entry when CLIENT_ORIGIN lists several origins', () => {
  // this is the real shape in dev: localhost for the browser, a LAN IP for a Kali VM.
  // Handing the whole list to a payment gateway is what produced Khalti's
  // {"return_url":["Enter a valid URL."]} 400.
  process.env.CLIENT_ORIGIN = 'http://localhost:5173,http://172.25.0.222:5173'
  assert.equal(clientOrigin(), 'http://localhost:5173')
})

test('tolerates whitespace around the separator', () => {
  process.env.CLIENT_ORIGIN = 'http://localhost:5173 , https://gyanpath.example'
  assert.equal(clientOrigin(), 'http://localhost:5173')
})

test('passes a single origin through unchanged', () => {
  process.env.CLIENT_ORIGIN = 'https://gyanpath.example'
  assert.equal(clientOrigin(), 'https://gyanpath.example')
})

test('falls back to the dev origin when unset', () => {
  delete process.env.CLIENT_ORIGIN
  assert.equal(clientOrigin(), 'http://localhost:5173')
})

test('whatever it returns is always a parseable absolute URL', () => {
  for (const value of [
    'http://localhost:5173,http://172.25.0.222:5173',
    'http://localhost:5173 , https://gyanpath.example',
    'https://gyanpath.example',
  ]) {
    process.env.CLIENT_ORIGIN = value
    assert.doesNotThrow(() => new URL(clientOrigin()), `not a valid URL for CLIENT_ORIGIN=${value}`)
  }
})
