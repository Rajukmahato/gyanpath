import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, GraduationCap, Headphones, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { api } from '../api/client.js'
import { useAuth } from '../hooks/useAuth.js'
import Layout from '../components/Layout.jsx'
import Container from '../components/ui/Container.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Badge from '../components/ui/Badge.jsx'
import Input from '../components/ui/Input.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { PageSpinner } from '../components/ui/Spinner.jsx'

const FEATURES = [
  { icon: ShieldCheck, key: 'whyVerified', descKey: 'whyVerifiedDesc' },
  { icon: Sparkles, key: 'whySecure', descKey: 'whySecureDesc' },
  { icon: GraduationCap, key: 'whyCertificates', descKey: 'whyCertificatesDesc' },
  { icon: Headphones, key: 'whyBandwidth', descKey: 'whyBandwidthDesc' },
]

// the second hero CTA points at whatever the current role's home is, instead of
// always nudging "become an instructor" — which makes no sense for someone who
// already is one (or is a moderator/admin)
function heroSecondaryCta(user) {
  switch (user?.role) {
    case 'student': return { to: '/my-learning', labelKey: 'nav.myLearning' }
    case 'instructor': return { to: '/instructor', labelKey: 'nav.instructorDashboard' }
    case 'moderator': return { to: '/moderator', labelKey: 'nav.moderationQueue' }
    case 'admin': return { to: '/admin/payouts', labelKey: 'nav.payouts' }
    default: return { to: '/register', labelKey: 'home.heroCtaSecondary' }
  }
}

function CourseCard({ course }) {
  return (
    <Link to={`/courses/${course._id}`}>
      <Card className="group h-full overflow-hidden transition-shadow hover:shadow-md hover:shadow-ink-900/[0.06]">
        <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 to-gold-300/20">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <GraduationCap className="h-10 w-10 text-brand-300" strokeWidth={1.5} />
          )}
        </div>
        <div className="p-4">
          {course.category && <Badge tone="brand" className="mb-2">{course.category}</Badge>}
          <h3 className="font-display font-semibold text-ink-900 group-hover:text-brand-700">{course.title}</h3>
          <p className="mt-2 text-sm font-medium text-ink-700">NPR {course.priceNPR.toLocaleString()}</p>
        </div>
      </Card>
    </Link>
  )
}

export default function Browse() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [courses, setCourses] = useState(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  const secondaryCta = heroSecondaryCta(user)

  useEffect(() => {
    api.listCourses().then(setCourses)
  }, [])

  const categories = useMemo(
    () => [...new Set((courses || []).map((c) => c.category).filter(Boolean))],
    [courses],
  )

  const filtered = (courses || []).filter((c) => {
    const matchesQuery = c.title.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = !category || c.category === category
    return matchesQuery && matchesCategory
  })

  // real content for the hero, instead of hardcoded placeholders
  const eyebrow = categories.length ? categories.slice(0, 4).join(' · ') : t('home.heroEyebrow')
  const featured = (courses || []).find((c) => c.thumbnailUrl) || (courses || [])[0]

  return (
    <Layout>
      <section className="border-b border-ink-100 bg-gradient-to-b from-brand-50/60 to-white">
        <Container className="grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2">
          <div>
            <Badge tone="gold" className="mb-4">{eyebrow}</Badge>
            <h1 className="font-display text-3xl font-extrabold leading-tight text-ink-900 sm:text-4xl">
              {t('home.heroTitle')}
            </h1>
            <p className="mt-4 max-w-lg text-ink-600">{t('home.heroSubtitle')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button as="a" href="#courses" size="lg">
                {t('home.heroCtaPrimary')} <ArrowRight className="h-4 w-4" />
              </Button>
              <Button as={Link} to={secondaryCta.to} variant="outline" size="lg">
                {t(secondaryCta.labelKey)}
              </Button>
            </div>
            <div className="mt-10 flex gap-8">
              <div>
                <p className="font-display text-2xl font-bold text-ink-900">{(courses || []).length}+</p>
                <p className="text-sm text-ink-400">{t('home.statCourses')}</p>
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-ink-900">NPR</p>
                <p className="text-sm text-ink-400">Priced for Nepal</p>
              </div>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-brand-100 to-gold-300/30 blur-2xl" />
            {featured && (
              <Card as={Link} to={`/courses/${featured._id}`} className="relative block p-6 transition-shadow hover:shadow-lg">
                <div className="flex h-56 items-center justify-center overflow-hidden rounded-lg bg-ink-900">
                  {featured.thumbnailUrl ? (
                    <img src={featured.thumbnailUrl} alt={featured.title} className="h-full w-full object-cover" />
                  ) : (
                    <GraduationCap className="h-16 w-16 text-gold-400" strokeWidth={1.2} />
                  )}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink-800">{featured.title}</p>
                    <p className="text-xs text-ink-400">
                      {featured.category ? `${featured.category} · ` : ''}Certificate on completion
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </Container>
      </section>

      <section className="border-b border-ink-100 py-14">
        <Container>
          <h2 className="text-center font-display text-2xl font-bold text-ink-900">{t('home.whyTitle')}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, key, descKey }) => (
              <div key={key}>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <p className="mt-3 font-display font-semibold text-ink-800">{t(`home.${key}`)}</p>
                <p className="mt-1 text-sm text-ink-400">{t(`home.${descKey}`)}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="courses" className="py-14">
        <Container>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-2xl font-bold text-ink-900">{t('browse.title')}</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  className="pl-9 sm:w-64"
                  placeholder={t('browse.searchPlaceholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {categories.length > 0 && (
                <select
                  className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-700"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">{t('browse.allCategories')}</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="mt-8">
            {courses === null && <PageSpinner />}
            {courses !== null && filtered.length === 0 && (
              <EmptyState icon={GraduationCap} title={t('browse.empty')} description={t('browse.emptyDesc')} />
            )}
            {filtered.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c) => <CourseCard key={c._id} course={c} />)}
              </div>
            )}
          </div>
        </Container>
      </section>
    </Layout>
  )
}
