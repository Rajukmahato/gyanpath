import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import { PageSpinner } from '../components/ui/Spinner.jsx'

// Khalti's own words for a transaction that didn't complete
const STATUS_MESSAGE = {
  Pending: 'Khalti still shows this payment as pending. Give it a moment and retry.',
  Initiated: 'The payment was started but not completed on Khalti.',
  Expired: 'This payment link expired before it was completed.',
  'User canceled': 'The payment was cancelled.',
  Refunded: 'This payment was refunded.',
  UNKNOWN: 'The payment could not be confirmed. Please try again.',
}

export default function KhaltiReturn() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState('checking') // checking | success | failed
  const [message, setMessage] = useState(null)
  const courseId = sessionStorage.getItem('pendingCourseId')
  // Khalti sends pidx back on the return URL; fall back to what we stashed at checkout
  const pidx = params.get('pidx') || sessionStorage.getItem('pendingPidx')

  useEffect(() => {
    if (!pidx) {
      setMessage(STATUS_MESSAGE.UNKNOWN)
      setState('failed')
      return undefined
    }
    let cancelled = false
    api
      .confirmKhaltiPayment(pidx)
      .then((r) => {
        if (cancelled) return
        if (r.enrolled) {
          sessionStorage.removeItem('pendingPidx')
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
  }, [pidx])

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
              <p className="mt-3 text-sm text-ink-500">Confirming your payment with Khalti…</p>
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
