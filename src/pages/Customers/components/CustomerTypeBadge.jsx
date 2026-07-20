const typeStyles = {
  Retail: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Corporate: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  'Travel Agent': 'bg-amber-50 text-amber-700 ring-amber-600/20',
}

function CustomerTypeBadge({ type }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        typeStyles[type] || 'bg-slate-100 text-slate-700 ring-slate-500/20'
      }`}
    >
      {type}
    </span>
  )
}

export default CustomerTypeBadge
