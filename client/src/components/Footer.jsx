import { Link } from 'react-router'
import Logo from './Logo.jsx'

export default function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-ink-50/60">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm text-ink-400">
              Curated skill and exam-prep courses from verified Nepali instructors — priced in NPR, protected against piracy.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <p className="font-display text-sm font-semibold text-ink-800">Learn</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-400">
                <li><Link to="/" className="hover:text-ink-700">Browse courses</Link></li>
                <li><Link to="/my-learning" className="hover:text-ink-700">My learning</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-ink-800">Teach</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-400">
                <li><Link to="/instructor" className="hover:text-ink-700">Instructor dashboard</Link></li>
                <li><Link to="/register" className="hover:text-ink-700">Become an instructor</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-ink-800">Trust</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-400">
                <li><Link to="/verify-certificate" className="hover:text-ink-700">Verify a certificate</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-10 text-xs text-ink-400">© {new Date().getFullYear()} GyanPath. Built for learners across Nepal.</p>
      </div>
    </footer>
  )
}
