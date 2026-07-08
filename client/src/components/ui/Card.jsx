export default function Card({ className = '', as: Component = 'div', ...props }) {
  return (
    <Component
      className={`rounded-xl border border-ink-100 bg-white shadow-sm shadow-ink-900/[0.03] ${className}`}
      {...props}
    />
  )
}
