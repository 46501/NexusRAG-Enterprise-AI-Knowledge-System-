const COLORS = {
  hr: 'bg-purple-100 text-purple-700',
  engineering: 'bg-blue-100 text-blue-700',
  finance: 'bg-green-100 text-green-700',
}

export default function RoleBadge({ role }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  )
}
