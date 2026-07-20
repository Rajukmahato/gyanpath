import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BadgeCheck, ShieldAlert } from 'lucide-react'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Input, { Label } from '../components/ui/Input.jsx'

export default function VerifyCertificate() {
  const [params] = useSearchParams()
  const [certificateId, setCertificateId] = useState('')
  const [result, setResult] = useState(null)

  const verify = useCallback(async (id) => {
    try {
      const data = await api.verifyCertificate(id.trim())
      setResult(data)
    } catch (err) {
      // an unknown/tampered certificate comes back as a non-2xx carrying { valid: false } —
      // treat that as a normal "not verified" result, not a thrown error that shows nothing
      setResult(err.body?.valid === false ? err.body : { valid: false })
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await verify(certificateId)
  }

  // support deep links from the certificate QR code: /verify-certificate?id=...
  useEffect(() => {
    const id = params.get('id')
    if (id) {
      setCertificateId(id)
      verify(id)
    }
  }, [params, verify])

  return (
    <Layout>
      <Container className="max-w-md py-16">
        <h1 className="font-display text-2xl font-bold text-ink-900">Verify a certificate</h1>
        <p className="mt-1 text-sm text-ink-500">
          Paste a GyanPath certificate ID below to confirm it's genuine — no login required.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
          <div className="flex-1">
            <Label className="sr-only">Certificate ID</Label>
            <Input
              placeholder="e.g. 8b1f0c2a-..."
              value={certificateId}
              onChange={(e) => setCertificateId(e.target.value)}
              required
            />
          </div>
          <Button type="submit">Verify</Button>
        </form>

        {result && (
          <Card className={`mt-6 p-5 ${result.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            {result.valid ? (
              <div className="flex gap-3">
                <BadgeCheck className="h-6 w-6 shrink-0 text-green-600" />
                <div className="text-sm">
                  <p className="font-semibold text-green-800">Genuine certificate</p>
                  <p className="mt-1 text-green-700">{result.studentName} completed "{result.courseTitle}"</p>
                  <p className="mt-1 text-green-700/70">Issued {new Date(result.issuedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <ShieldAlert className="h-6 w-6 shrink-0 text-red-600" />
                <p className="text-sm font-semibold text-red-800">This certificate ID could not be verified.</p>
              </div>
            )}
          </Card>
        )}
      </Container>
    </Layout>
  )
}
