import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BadgeCheck, GraduationCap, Languages, Lock, Star } from 'lucide-react'
import { setLanguage } from '../i18n/index.js'
import Logo from './Logo.jsx'

function LanguageToggle() {
  const { i18n } = useTranslation()
  const next = i18n.language === 'ne' ? 'en' : 'ne'
  return (
    <button
      onClick={() => setLanguage(next)}
      aria-label="Switch language"
      className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/20"
    >
      <Languages className="h-3.5 w-3.5" />
      {next === 'ne' ? 'नेपाली' : 'EN'}
    </button>
  )
}

const FEATURES = [
  { icon: BadgeCheck, text: 'Verified Nepali instructors' },
  { icon: GraduationCap, text: 'Signed certificates on completion' },
  { icon: Lock, text: 'Anti-piracy content protection' },
  { icon: Star, text: 'NPR-priced for Nepali learners' },
]

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left panel: decorative ───────────────────────── */}
      <div className="relative hidden w-[42%] flex-col overflow-hidden lg:flex"
        style={{ background: 'linear-gradient(135deg, #6E0E20 0%, #8A1128 40%, #4a0613 100%)' }}>

        {/* floating blobs */}
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-40 w-40 rounded-full bg-brand-400/20 blur-2xl" />

        {/* dot grid watermark */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* content */}
        <div className="relative flex flex-1 flex-col justify-between p-10">
          {/* top */}
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <GraduationCap className="h-5 w-5 text-gold-300" strokeWidth={1.5} />
            </div>
            <span className="font-display text-lg font-bold text-white">GyanPath</span>
          </div>

          {/* middle hero */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-gold-300">
              ✦ Nepal's Learning Platform
            </div>
            <h2 className="font-display text-3xl font-extrabold leading-tight text-white">
              ज्ञान पथ<br />
              <span className="text-gold-300">Path of Knowledge</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Structured courses built for Nepali learners — priced in NPR, taught by verified instructors, with signed certificates.
            </p>
            <ul className="mt-8 space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-3.5 w-3.5 text-gold-300" />
                  </span>
                  <span className="text-sm text-white/75">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* bottom stats */}
          <div className="grid grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            {[['7+', 'Courses'], ['100%', 'NPR Priced'], ['Free', 'Preview']].map(([val, label]) => (
              <div key={label} className="text-center">
                <p className="font-display text-xl font-bold text-white">{val}</p>
                <p className="mt-0.5 text-xs text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: form ────────────────────────────── */}
      <div className="flex flex-1 flex-col"
        style={{ background: 'linear-gradient(160deg, #fdf6f0 0%, #fff7f5 50%, #f9f5ff 100%)' }}>

        {/* top bar */}
        <div className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
            <ArrowLeft className="h-4 w-4" /> Back to courses
          </Link>
          <div className="flex items-center gap-3">
            {/* mobile logo */}
            <div className="lg:hidden"><Logo /></div>
            <div className="rounded-full border border-ink-200 bg-white px-3 py-1.5">
              <LanguageToggle2 />
            </div>
          </div>
        </div>

        {/* centered form */}
        <div className="flex flex-1 items-center justify-center px-6 py-6 sm:px-10">
          <div className="w-full max-w-md">
            {/* card */}
            <div className="rounded-3xl border border-ink-100 bg-white p-8 shadow-xl shadow-brand-900/5">
              <h1 className="font-display text-2xl font-extrabold text-ink-900">{title}</h1>
              {subtitle && <p className="mt-1.5 text-sm text-ink-400">{subtitle}</p>}
              <div className="mt-6">{children}</div>
            </div>

            {/* footer note */}
            <p className="mt-5 text-center text-xs text-ink-400">
              Protected by GyanPath security — your data is encrypted and never shared.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// plain version for the right-panel top bar (light background)
function LanguageToggle2() {
  const { i18n } = useTranslation()
  const next = i18n.language === 'ne' ? 'en' : 'ne'
  return (
    <button
      onClick={() => setLanguage(next)}
      aria-label="Switch language"
      className="flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800"
    >
      <Languages className="h-3.5 w-3.5" />
      {next === 'ne' ? 'नेपाली' : 'EN'}
    </button>
  )
}
