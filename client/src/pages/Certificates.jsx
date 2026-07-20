import { useEffect, useState } from 'react'
import { Award, Download } from 'lucide-react'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { PageSpinner } from '../components/ui/Spinner.jsx'

export default function Certificates() {
  const [certificates, setCertificates] = useState(null)

  useEffect(() => {
    api.myCertificates().then(setCertificates)
  }, [])

  return (
    <Layout>
      <Container className="max-w-3xl py-10">
        <h1 className="font-display text-2xl font-bold text-ink-900">My certificates</h1>

        <div className="mt-6">
          {certificates === null && <PageSpinner />}
          {certificates?.length === 0 && (
            <EmptyState icon={Award} title="No certificates yet" description="Finish a course to earn your first one." />
          )}
          <div className="space-y-3">
            {certificates?.map((cert) => (
              <Card key={cert._id} className="flex items-center gap-4 border-l-4 border-l-gold-500 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-300/20 text-gold-600">
                  <Award className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <p className="font-display font-semibold text-ink-900">{cert.courseId?.title}</p>
                  <p className="text-xs text-ink-400">
                    Issued {new Date(cert.issuedAt).toLocaleDateString()} · ID {cert.certificateId}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => api.downloadCertificate(cert.certificateId)}>
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </Layout>
  )
}
