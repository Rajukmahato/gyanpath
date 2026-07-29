import { useEffect, useState } from 'react'
import { BadgeCheck, Check, ClipboardCheck, UserCheck, X } from 'lucide-react'
import { api } from '../api/client.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'

export default function ModeratorQueue() {
  const [tab, setTab] = useState('courses')
  const [courses, setCourses] = useState(null)
  const [instructors, setInstructors] = useState(null)

  function refresh() {
    api.pendingCourses().then(setCourses)
    api.pendingInstructors().then(setInstructors).catch(() => setInstructors([]))
  }

  useEffect(refresh, [])

  async function reviewCourse(id, decision) {
    await api.reviewCourse(id, decision)
    refresh()
  }

  async function verify(id) {
    await api.verifyInstructor(id)
    refresh()
  }

  const tabs = [
    { key: 'courses', label: 'Courses', count: courses?.length },
    { key: 'instructors', label: 'Instructors', count: instructors?.length },
  ]

  return (
    <Layout>
      <Container className="max-w-3xl py-10">
        <h1 className="font-display text-2xl font-bold text-ink-900">Moderation queue</h1>

        <div className="mt-5 flex gap-1 border-b border-ink-100">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === tb.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'
              }`}
            >
              {tb.label}{tb.count ? ` (${tb.count})` : ''}
            </button>
          ))}
        </div>

        {tab === 'courses' && (
          <div className="mt-6 space-y-3">
            {courses?.length === 0 && (
              <EmptyState icon={ClipboardCheck} title="No courses pending" description="New course submissions show up here." />
            )}
            {courses?.map((c) => (
              <Card key={c._id} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-display font-semibold text-ink-900">{c.title}</p>
                  <p className="text-sm text-ink-400">{c.instructorId?.email} · NPR {c.priceNPR.toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => reviewCourse(c._id, 'approved')}><Check className="h-4 w-4" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => reviewCourse(c._id, 'rejected')}><X className="h-4 w-4" /> Reject</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === 'instructors' && (
          <div className="mt-6 space-y-3">
            {instructors?.length === 0 && (
              <EmptyState icon={UserCheck} title="No instructors to verify" description="Unverified instructors appear here for the trust check." />
            )}
            {instructors?.map((u) => (
              <Card key={u._id} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-display font-semibold text-ink-900">{u.profile?.name || u.email}</p>
                  <p className="text-sm text-ink-400">{u.email}</p>
                </div>
                <Button size="sm" onClick={() => verify(u._id)}><BadgeCheck className="h-4 w-4" /> Verify</Button>
              </Card>
            ))}
          </div>
        )}
      </Container>
    </Layout>
  )
}
