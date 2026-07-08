export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 px-6 py-16 text-center">
      {Icon && <Icon className="mb-3 h-9 w-9 text-ink-300" strokeWidth={1.5} />}
      <p className="font-display text-base font-semibold text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
