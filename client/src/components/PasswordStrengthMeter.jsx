import zxcvbn from 'zxcvbn'

const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']
const COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-600']

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null

  const { score } = zxcvbn(password)

  return (
    <div className="mt-1">
      <div className="flex gap-1 h-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`flex-1 rounded ${i <= score ? COLORS[score] : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-xs text-gray-600 mt-1">{LABELS[score]}</p>
    </div>
  )
}
