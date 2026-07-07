import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Languages, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { setLanguage } from '../i18n/index.js'
import Logo from './Logo.jsx'
import Button from './ui/Button.jsx'
import Badge from './ui/Badge.jsx'

const navLinkClass = ({ isActive }) =>
  `text-sm font-medium transition-colors ${isActive ? 'text-brand-700' : 'text-ink-600 hover:text-ink-900'}`

function LanguageToggle() {
  const { i18n } = useTranslation()
  const next = i18n.language === 'ne' ? 'en' : 'ne'
  return (
    <button
      onClick={() => setLanguage(next)}
      aria-label="Switch language"
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100"
    >
      <Languages className="h-4 w-4" />
      {next === 'ne' ? 'नेपाली' : 'EN'}
    </button>
  )
}

export default function Header() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  async function confirmLogout() {
    setShowLogoutConfirm(false)
    await logout()
    navigate('/')
  }

  const links = [
    { to: '/', label: t('nav.browse') },
    ...(user?.role === 'student' ? [
      { to: '/my-learning', label: t('nav.myLearning') },
      { to: '/certificates', label: t('nav.certificates') },
    ] : []),
    ...(user?.role === 'instructor' ? [{ to: '/instructor', label: t('nav.instructorDashboard') }] : []),
    ...(user?.role === 'moderator' || user?.role === 'admin' ? [{ to: '/moderator', label: t('nav.moderationQueue') }] : []),
    ...(user?.role === 'admin' ? [
      { to: '/admin', label: 'Admin' },
      { to: '/admin/payouts', label: t('nav.payouts') },
    ] : []),
  ]

  return (
    <>
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClass} end={link.to === '/'}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          <LanguageToggle />
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-100">
                {user.avatarUrl ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL}${user.avatarUrl}`}
                    alt={user.email}
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-brand-200"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                    {user.email[0].toUpperCase()}
                  </span>
                )}
                <span className="text-sm text-ink-700">{user.email}</span>
                <Badge tone="brand" className="capitalize">{user.role}</Badge>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setShowLogoutConfirm(true)}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button as={Link} to="/login" variant="ghost" size="sm">{t('nav.login')}</Button>
              <Button as={Link} to="/register" size="sm">{t('nav.register')}</Button>
            </div>
          )}
        </div>

        <button className="ml-auto md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-100 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-3">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass} onClick={() => setOpen(false)} end={link.to === '/'}>
                {link.label}
              </NavLink>
            ))}
            <div className="flex items-center justify-between pt-2">
              <LanguageToggle />
              {user ? (
                <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setShowLogoutConfirm(true) }}>{t('nav.logout')}</Button>
              ) : (
                <div className="flex gap-2">
                  <Button as={Link} to="/login" variant="ghost" size="sm">{t('nav.login')}</Button>
                  <Button as={Link} to="/register" size="sm">{t('nav.register')}</Button>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>

    {showLogoutConfirm && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
        <div className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <h3 className="font-display text-lg font-bold text-ink-900">Log out?</h3>
          <p className="mt-2 text-sm text-ink-500">Are you sure you want to log out of your account?</p>
          <div className="mt-5 flex gap-3">
            <Button className="flex-1" onClick={confirmLogout}>Yes, log out</Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowLogoutConfirm(false)}>Cancel</Button>
          </div>
        </div>
      </div>,
      document.body,
    )}
    </>
  )
}
