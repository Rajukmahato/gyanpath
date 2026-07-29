import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { BookOpen, GraduationCap, PlayCircle } from 'lucide-react'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Alert from '../components/ui/Alert.jsx'
import { PageSpinner } from '../components/ui/Spinner.jsx'

const STATUS_TONE = { active: 'success', refunded: 'neutral' }

export default function MyLearning() {
  const [enrollments, setEnrollments] = useState(null)
  const [message, setMessage] = useState(null)

  function refresh() {
    api.myEnrollments().then(setEnrollments)
  }

  useEffect(refresh, [])

  async function refund(id) {
    try {
      await api.requestRefund(id)
      setMessage({ tone: 'success', text: 'Refund processed.' })
      refresh()
    } catch (err) {
      setMessage({ tone: 'error', text: err.body?.error || err.message })
    }
  }

  return (
    <Layout>
      <Container className="max-w-3xl py-10">
        <h1 className="font-display text-2xl font-bold text-ink-900">My learning</h1>

        {message && <div className="mt-4"><Alert tone={message.tone}>{message.text}</Alert></div>}

        <div className="mt-6 space-y-3">
          {enrollments === null && <PageSpinner />}
          {enrollments?.length === 0 && (
            <EmptyState
              icon={GraduationCap}
              title="No enrollments yet"
              description="Browse the catalog and start your first course."
              action={<Button as={Link} to="/">Browse courses</Button>}
            />
          )}
          {enrollments?.map((e) => {
            const pct = e.totalLessons ? Math.round((e.completedLessons / e.totalLessons) * 100) : 0
            return (
              <Card key={e._id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <Link to={`/courses/${e.courseId?._id}`} className="font-display font-semibold text-ink-900 hover:text-brand-700">
                        {e.courseId?.title}
                      </Link>
                      <p className="text-xs text-ink-400">{e.completedLessons} / {e.totalLessons} lessons · {pct}%</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone={STATUS_TONE[e.status]} className="capitalize">{e.status}</Badge>
                    {e.status === 'active' && (
                      <Button variant="ghost" size="sm" onClick={() => refund(e._id)}>Refund</Button>
                    )}
                  </div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
                </div>

                {e.status === 'active' && e.firstLessonId && (
                  <div className="mt-3">
                    <Button as={Link} to={`/learn/${e.courseId?._id}/${e.firstLessonId}`} variant="outline" size="sm">
                      <PlayCircle className="h-4 w-4" /> {pct > 0 ? 'Continue' : 'Start'}
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </Container>
    </Layout>
  )
}
