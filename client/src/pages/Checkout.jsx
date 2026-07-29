import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { ShieldCheck } from 'lucide-react'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Alert from '../components/ui/Alert.jsx'
import { PageSpinner } from '../components/ui/Spinner.jsx'

// eSewa's hosted page only accepts a real form POST, so we build one in the DOM and
// submit it — that navigates the browser to eSewa to complete payment.
function redirectToEsewa({ url, fields }) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = url
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}

export default function Checkout() {
  const { id } = useParams()
  const [error, setError] = useState(null)
  const startedRef = useRef(false)

  useEffect(() => {
    // guard against React StrictMode's double-invoke so we don't create two payments
    if (startedRef.current) return
    startedRef.current = true

    api
      .checkout(id)
      .then((data) => {
        if (data.devEnrolled) {
          // no gateway configured — enrollment already happened server-side
          window.location.assign('/my-learning')
          return
        }
        sessionStorage.setItem('pendingCourseId', id)
        if (data.khalti) {
          // Khalti (primary): hand the browser to Khalti's hosted payment page
          sessionStorage.setItem('pendingPidx', data.khalti.pidx)
          window.location.assign(data.khalti.paymentUrl)
          return
        }
        if (data.esewa) {
          // eSewa (alternative): remember the txn so the callback can confirm via status API
          sessionStorage.setItem('pendingTxn', data.esewa.fields.transaction_uuid)
          redirectToEsewa(data.esewa)
        }
      })
      .catch((err) => setError(err.body?.error || err.message))
  }, [id])

  return (
    <Layout footer={false}>
      <Container className="max-w-md py-14">
        <h1 className="font-display text-2xl font-bold text-ink-900">Checkout</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
          <ShieldCheck className="h-4 w-4" /> Secure payment via Khalti
        </p>

        <Card className="mt-6 p-6">
          {error ? (
            <Alert tone="error">{error}</Alert>
          ) : (
            <div className="text-center">
              <PageSpinner />
              <p className="mt-3 text-sm text-ink-500">Redirecting you to Khalti…</p>
            </div>
          )}
        </Card>
      </Container>
    </Layout>
  )
}
