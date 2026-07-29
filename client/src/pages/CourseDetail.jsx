import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, CircleCheck, GraduationCap, Lock, PlayCircle } from 'lucide-react'
import { api } from '../api/client.js'
import { useAuth } from '../hooks/useAuth.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Badge from '../components/ui/Badge.jsx'
import { PageSpinner } from '../components/ui/Spinner.jsx'

export default function CourseDetail() {
  const { id } = useParams()
  const { t } = useTranslation()
  const [course, setCourse] = useState(null)
  const [enrollment, setEnrollment] = useState({ enrolled: false, progress: [] })
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    api.getCourse(id).then(setCourse)
  }, [id])

  useEffect(() => {
    if (user) api.myEnrollmentForCourse(id).then(setEnrollment).catch(() => {})
  }, [id, user])

  if (!course) return <Layout><PageSpinner /></Layout>

  const { enrolled, progress } = enrollment
  const isOwner = user && course.instructorId && String(course.instructorId) === String(user.id)
  const canWatchAll = enrolled || isOwner || user?.role === 'admin'
  // enrolling is a learner action — visitors get nudged to sign in, students can buy,
  // but instructors/moderators/admins have no "buy" flow
  const canEnroll = !user || user.role === 'student'

  const completedIds = new Set(progress.filter((p) => p.completed).map((p) => String(p.lessonId)))
  const completedCount = course.lessons?.filter((l) => completedIds.has(String(l._id))).length || 0
  const pct = course.lessons?.length ? Math.round((completedCount / course.lessons.length) * 100) : 0
  const firstUnwatched = course.lessons?.find((l) => !completedIds.has(String(l._id))) || course.lessons?.[0]

  function handleEnroll() {
    if (!user) return navigate('/login')
    navigate(`/checkout/${id}`)
  }

  return (
    <Layout>
      <section className="border-b border-ink-100 bg-ink-900 text-white">
        <Container className="py-12">
          {course.category && <Badge tone="gold" className="mb-3">{course.category}</Badge>}
          <h1 className="font-display text-3xl font-bold">{course.title}</h1>
          <p className="mt-3 max-w-2xl text-ink-100/80">{course.description}</p>
          {enrolled && (
            <div className="mt-5 max-w-md">
              <div className="flex items-center justify-between text-sm text-ink-100/80">
                <span>{completedCount} / {course.lessons.length} lessons</span>
                <span>{pct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gold-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </Container>
      </section>

      <Container className="grid gap-8 py-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-ink-900">{t('course.about')}</h2>
          <p className="mt-2 text-sm text-ink-600">{course.description || '—'}</p>

          <h2 className="mt-8 font-display text-lg font-semibold text-ink-900">{t('course.lessons')}</h2>
          <ul className="mt-3 divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-100">
            {course.lessons?.map((lesson, i) => {
              const done = completedIds.has(String(lesson._id))
              const playable = lesson.isPreview || canWatchAll
              return (
                <li key={lesson._id} className="flex items-center justify-between gap-3 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? 'bg-green-100 text-green-700' : 'bg-ink-100 text-ink-500'}`}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="text-sm text-ink-800">{lesson.title}</span>
                    {lesson.isPreview && !enrolled && <Badge tone="brand">{t('course.preview')}</Badge>}
                  </div>
                  {playable ? (
                    <Button as={Link} to={`/learn/${course._id}/${lesson._id}`} variant="ghost" size="sm">
                      <PlayCircle className="h-4 w-4" /> {done ? 'Rewatch' : 'Play'}
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-ink-400">
                      <Lock className="h-3.5 w-3.5" /> {t('course.locked')}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <Card className="sticky top-24 p-5">
            <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-50 to-gold-300/20">
              {course.thumbnailUrl ? (
                <img src={course.thumbnailUrl} alt={course.title} className="h-full w-full object-cover" />
              ) : (
                <GraduationCap className="h-10 w-10 text-brand-300" strokeWidth={1.5} />
              )}
            </div>
            {enrolled ? (
              <>
                <Badge tone="success" className="mt-4">Enrolled</Badge>
                <Button as={Link} to={`/learn/${course._id}/${firstUnwatched?._id}`} className="mt-3 w-full" size="lg">
                  {pct > 0 ? 'Continue learning' : 'Start course'}
                </Button>
              </>
            ) : isOwner ? (
              <>
                <Badge tone="brand" className="mt-4">Your course</Badge>
                <Button as={Link} to="/instructor" variant="outline" className="mt-3 w-full" size="lg">Manage course</Button>
              </>
            ) : canEnroll ? (
              <>
                <p className="mt-4 font-display text-2xl font-bold text-ink-900">NPR {course.priceNPR.toLocaleString()}</p>
                <Button onClick={handleEnroll} className="mt-4 w-full" size="lg">{t('course.enroll')}</Button>
              </>
            ) : (
              <>
                <p className="mt-4 font-display text-2xl font-bold text-ink-900">NPR {course.priceNPR.toLocaleString()}</p>
                <p className="mt-3 text-sm text-ink-500">Enrolling is available on learner accounts.</p>
              </>
            )}
            <ul className="mt-5 space-y-2 text-sm text-ink-600">
              <li className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-brand-600" /> Lifetime access</li>
              <li className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-brand-600" /> Signed certificate on completion</li>
              <li className="flex items-center gap-2"><CircleCheck className="h-4 w-4 text-brand-600" /> 7-day refund window</li>
            </ul>
          </Card>
        </div>
      </Container>
    </Layout>
  )
}
