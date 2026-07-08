const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
  secondary: 'bg-ink-900 text-white hover:bg-ink-800 focus-visible:outline-ink-900',
  outline: 'border border-ink-200 text-ink-800 hover:bg-ink-50 focus-visible:outline-ink-400',
  ghost: 'text-ink-700 hover:bg-ink-100 focus-visible:outline-ink-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  as: Component = 'button',
  ...props
}) {
  return (
    <Component
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        disabled:opacity-50 disabled:pointer-events-none
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  )
}
