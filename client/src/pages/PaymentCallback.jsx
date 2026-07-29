import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import { PageSpinner } from '../components/ui/Spinner.jsx'

// eSewa's own words for a transaction that didn't complete
const STATUS_MESSAGE = {
  FAILED: 'eSewa reports this payment as failed. No money was taken — please try again.',
  PENDING: 'eSewa still shows this payment as pending. Give it a moment and retry.',
  NOT_FOUND: 'eSewa has no record of this payment — it looks like it was cancelled.',
  UNKNOWN: 'The payment could not be confirmed. Please try again.',
}

export default function PaymentCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState('checking') // checking | success | failed
  const [message, setMessage] = useState(null)
  const courseId = params.get('course') || sessionStorage.getItem('pendingCourseId')
  const txn = params.get('txn') || sessionStorage.getItem('pendingTxn')

  useEffect(() => {
    // ask our server to confirm against eSewa's status API (authoritative) — this works
    // even when eSewa's redirect didn't carry the signed data back to us
    if (!txn) {
      setMessage(STATUS_MESSAGE.UNKNOWN)
      setState('failed')
      return undefined
    }
    let cancelled = false
    api
      .confirmEsewaPayment(txn)
      .then((r) => {
        if (cancelled) return
        if (r.enrolled) {
          sessionStorage.removeItem('pendingTxn')
          sessionStorage.removeItem('pendingCourseId')
          setState('success')
        } else {
          setMessage(STATUS_MESSAGE[r.status] || STATUS_MESSAGE.UNKNOWN)
          setState('failed')
        }
      })
      .catch(() => {
        if (!cancelled) { setMessage(STATUS_MESSAGE.UNKNOWN); setState('failed') }
      })
    return () => { cancelled = true }
  }, [txn])

  useEffect(() => {
    if (state === 'success') {
      const t = setTimeout(() => navigate('/my-learning'), 1500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [state, navigate])

  return (
    <Layout footer={false}>
      <Container className="max-w-md py-20">
        <Card className="flex flex-col items-center p-8 text-center">
          {state === 'checking' && (
            <>
              <PageSpinner />
              <p className="mt-3 text-sm text-ink-500">Confirming your payment with eSewa…</p>
            </>
          )}
          {state === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="mt-3 font-display text-lg font-semibold text-ink-900">Payment successful</p>
              <p className="mt-1 text-sm text-ink-500">You're enrolled — taking you to your courses.</p>
            </>
          )}
          {state === 'failed' && (
            <>
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="mt-3 font-display text-lg font-semibold text-ink-900">Payment not completed</p>
              <p className="mt-1 text-sm text-ink-500">{message}</p>
              <Button as={Link} to={courseId ? `/courses/${courseId}` : '/'} variant="outline" className="mt-5">
                Back to course
              </Button>
            </>
          )}
        </Card>
      </Container>
    </Layout>
  )
}
