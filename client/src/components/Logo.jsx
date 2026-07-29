import { BookOpenText } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

export default function Logo({ className = '' }) {
  const { t } = useTranslation()
  return (
    <Link to="/" className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <BookOpenText className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-ink-900">{t('brand.name')}</span>
    </Link>
  )
}
