import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function Label({ className = '', ...props }) {
  return <label className={`block text-sm font-medium text-ink-700 mb-1.5 ${className}`} {...props} />
}

export default function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900
        placeholder:text-ink-400 outline-none transition-shadow
        focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${className}`}
      {...props}
    />
  )
}

export function PasswordInput({ className = '', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className={`w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-ink-900
          placeholder:text-ink-400 outline-none transition-shadow
          focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 focus:outline-none"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900
        placeholder:text-ink-400 outline-none transition-shadow
        focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${className}`}
      {...props}
    />
  )
}
