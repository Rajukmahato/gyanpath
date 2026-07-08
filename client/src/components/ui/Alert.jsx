import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

const TONES = {
  error: { wrap: 'bg-red-50 text-red-700 border-red-100', Icon: AlertCircle },
  success: { wrap: 'bg-green-50 text-green-700 border-green-100', Icon: CheckCircle2 },
  info: { wrap: 'bg-ink-50 text-ink-700 border-ink-100', Icon: Info },
}

export default function Alert({ tone = 'info', className = '', children }) {
  const { wrap, Icon } = TONES[tone]
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${wrap} ${className}`} role="alert">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
