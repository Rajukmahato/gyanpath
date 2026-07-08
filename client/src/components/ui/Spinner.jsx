import { Loader2 } from 'lucide-react'

export default function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin text-brand-500 ${className}`} />
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  )
}
