const TONES = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-50 text-brand-700',
  gold: 'bg-gold-300/30 text-gold-600',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
}

export default function Badge({ tone = 'neutral', className = '', ...props }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
      {...props}
    />
  )
}
