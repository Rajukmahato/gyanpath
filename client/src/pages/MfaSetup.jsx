import { useState, useEffect, useRef } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Input, { Label } from '../components/ui/Input.jsx'
import Button from '../components/ui/Button.jsx'
import Alert from '../components/ui/Alert.jsx'
import { PageSpinner } from '../components/ui/Spinner.jsx'

export default function MfaSetup() {
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [token, setToken] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    // guard against React StrictMode's double-invoke — calling setup twice would
    // generate (and save) two different secrets, so the scanned QR wouldn't match
    if (startedRef.current) return
    startedRef.current = true
    api.setupMfa().then((data) => setQrDataUrl(data.qrDataUrl))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await api.enableMfa({ token })
      setDone(true)
    } catch (err) {
      setError(err.body?.error || err.message)
    }
  }

  return (
    <Layout>
      <Container className="max-w-md py-14">
        <h1 className="font-display text-2xl font-bold text-ink-900">Two-factor authentication</h1>
        <p className="mt-1 text-sm text-ink-500">Scan the QR code with an authenticator app, then confirm with a code.</p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Important:</strong> If you have a previous GyanPath entry in your authenticator app, <strong>delete it first</strong> before scanning this new QR code — otherwise you'll get "invalid code" errors.
        </div>

        <Card className="mt-4 p-6 text-center">
          {done ? (
            <div className="flex flex-col items-center py-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="mt-3 font-display font-semibold text-ink-900">Two-factor authentication is on</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!qrDataUrl && <PageSpinner />}
              {qrDataUrl && <img src={qrDataUrl} alt="MFA QR code" className="mx-auto rounded-lg border border-ink-100" />}
              {error && <Alert tone="error">{error}</Alert>}
              <div className="text-left">
                <Label>6-digit code</Label>
                <Input placeholder="123456" required value={token} onChange={(e) => setToken(e.target.value)} className="tracking-widest" />
              </div>
              <Button className="w-full" type="submit">Enable</Button>
            </form>
          )}
        </Card>
      </Container>
    </Layout>
  )
}
