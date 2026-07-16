// Khalti KPG-2. Server-to-server initiation returns a hosted payment_url + pidx;
// after the user pays and is redirected back, we verify by looking up the pidx —
// the authoritative status, no signatures to juggle. Sandbox defaults baked in.
const SECRET = process.env.KHALTI_SECRET_KEY
const BASE = process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2'

export function isKhaltiConfigured() {
  return Boolean(SECRET)
}

async function khaltiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `key ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(`khalti ${path} ${res.status}: ${JSON.stringify(data)}`)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

// amount is in paisa (NPR * 100). Returns { pidx, payment_url, expires_at, expires_in }.
export function initiateKhalti({ amountPaisa, purchaseOrderId, purchaseOrderName, returnUrl, websiteUrl, customer }) {
  return khaltiPost('/epayment/initiate/', {
    amount: amountPaisa,
    purchase_order_id: purchaseOrderId,
    purchase_order_name: purchaseOrderName,
    return_url: returnUrl,
    website_url: websiteUrl,
    customer_info: customer,
  })
}

// Returns { pidx, total_amount, status, transaction_id, fee, refunded }.
// status is one of: Completed | Pending | Initiated | Refunded | Expired | User canceled
export async function lookupKhalti(pidx) {
  try {
    return await khaltiPost('/epayment/lookup/', { pidx })
  } catch {
    return null
  }
}
