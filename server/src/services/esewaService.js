import crypto from 'node:crypto'

// eSewa ePay v2. Sandbox (UAT) defaults are baked in so checkout works out of the box;
// set ESEWA_* in .env to point at production. Amounts are billed in NPR directly —
// no currency conversion, unlike a Stripe-style gateway.
const PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST'
const SECRET = process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q'
const PAYMENT_URL = process.env.ESEWA_PAYMENT_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'
const STATUS_URL = process.env.ESEWA_STATUS_URL || 'https://rc.esewa.com.np/api/epay/transaction/status/'

export function isEsewaConfigured() {
  // the sandbox secret is a public test key; treat "no explicit secret" as dev mode
  return Boolean(process.env.ESEWA_SECRET_KEY)
}

function sign(message) {
  return crypto.createHmac('sha256', SECRET).update(message).digest('base64')
}

// eSewa signs "field=value" pairs (for the given field names, in order) joined by commas.
function signedMessage(fields, fieldNames) {
  return fieldNames.map((name) => `${name}=${fields[name]}`).join(',')
}

// Everything the browser needs to POST itself to eSewa's hosted payment page.
export function buildEsewaPayment({ amountNPR, transactionUuid, successUrl, failureUrl }) {
  const fields = {
    amount: String(amountNPR),
    tax_amount: '0',
    total_amount: String(amountNPR),
    transaction_uuid: transactionUuid,
    product_code: PRODUCT_CODE,
    product_service_charge: '0',
    product_delivery_charge: '0',
    success_url: successUrl,
    failure_url: failureUrl,
    signed_field_names: 'total_amount,transaction_uuid,product_code',
  }
  fields.signature = sign(signedMessage(fields, fields.signed_field_names.split(',')))
  return { url: PAYMENT_URL, fields }
}

// eSewa redirects back with base64(JSON). Decode it here. When the value arrives via
// a URL/form field, '+' in the base64 gets turned into a space, so restore it first.
export function decodeEsewaResponse(data) {
  if (!data) return null
  try {
    const normalized = String(data).replace(/ /g, '+')
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

// The callback is authenticated by re-signing the fields eSewa says it signed and
// comparing — a forged callback can't produce a valid signature without the secret.
export function verifyEsewaSignature(decoded) {
  if (!decoded?.signature || !decoded?.signed_field_names) return false
  const expected = sign(signedMessage(decoded, decoded.signed_field_names.split(',')))
  const a = Buffer.from(expected)
  const b = Buffer.from(decoded.signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Belt-and-suspenders: ask eSewa directly whether the transaction really completed.
// Best-effort — a network hiccup shouldn't strand a cryptographically-valid callback.
export async function fetchEsewaStatus({ transactionUuid, totalAmount }) {
  const url = `${STATUS_URL}?product_code=${PRODUCT_CODE}&total_amount=${totalAmount}&transaction_uuid=${transactionUuid}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
