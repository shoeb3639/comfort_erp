import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  CircleDollarSign,
  Clock3,
  ReceiptText,
  TrendingUp,
} from 'lucide-react'

const numberFormatter = new Intl.NumberFormat('en-IN')

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function WidgetCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      {(title || subtitle || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="truncate text-sm font-semibold text-slate-950">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function SummaryCard({ label, value, caption, icon: Icon = TrendingUp, tone = 'brand', progress }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  }

  return (
    <WidgetCard className="min-h-[142px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <span className={cx('flex h-10 w-10 items-center justify-center rounded-lg ring-1', tones[tone])}>
          <Icon size={19} strokeWidth={2.2} />
        </span>
      </div>
      {caption && <p className="mt-3 text-sm text-slate-500">{caption}</p>}
      {typeof progress === 'number' && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
    </WidgetCard>
  )
}

export function SectionHeader({ title, subtitle }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}

export function KpiCard({
  label,
  value,
  comparisonLabel = 'vs yesterday',
  comparisonValue = 0,
  sparkline = [],
  icon: Icon = TrendingUp,
  tone = 'brand',
}) {
  const isUp = comparisonValue >= 0
  const TrendIcon = isUp ? ArrowUpRight : ArrowDownRight
  const tones = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  }
  const maxValue = Math.max(...sparkline, 1)

  return (
    <WidgetCard className="min-h-[154px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-3 truncate text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <span className={cx('flex h-10 w-10 items-center justify-center rounded-lg ring-1', tones[tone])}>
          <Icon size={18} strokeWidth={2.2} />
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold', isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
          <TrendIcon size={13} strokeWidth={2.4} />
          {Math.abs(comparisonValue)}%
        </span>
        <span className="truncate text-xs text-slate-500">{comparisonLabel}</span>
      </div>

      <div className="mt-4 flex h-8 items-end gap-1">
        {sparkline.map((point, index) => (
          <span
            key={`${label}-${index}`}
            className="flex-1 rounded-t bg-brand-500/70"
            style={{ height: `${Math.max((point / maxValue) * 100, 12)}%` }}
          />
        ))}
      </div>
    </WidgetCard>
  )
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    brand: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    sky: 'bg-sky-50 text-sky-700',
  }

  return (
    <span className={cx('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  )
}

export function DonutChart({ title, subtitle, data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let offset = 25

  return (
    <WidgetCard title={title} subtitle={subtitle}>
      <div className="flex items-center gap-5">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
            <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#e2e8f0" strokeWidth="6" />
            {data.map((item) => {
              const length = total ? (item.value / total) * 100 : 0
              const dashArray = `${length} ${100 - length}`
              const dashOffset = offset
              offset -= length

              return (
                <circle
                  key={item.label}
                  cx="21"
                  cy="21"
                  r="15.9"
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth="6"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-slate-950">{numberFormatter.format(total)}</span>
            <span className="text-xs text-slate-500">Total</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {data.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-semibold text-slate-950">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </WidgetCard>
  )
}

export function BarChart({ title, subtitle, data }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)

  return (
    <WidgetCard title={title} subtitle={subtitle}>
      <div className="flex h-52 items-end gap-3 border-b border-slate-200 pt-4">
        {data.map((item) => (
          <div key={item.label} className="flex h-full flex-1 flex-col justify-end gap-2">
            <div className="flex flex-1 items-end">
              <div
                className="w-full rounded-t-lg bg-brand-500/85 transition"
                style={{ height: `${Math.max((item.value / maxValue) * 100, 8)}%` }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
            <div className="text-center">
              <p className="truncate text-[11px] font-semibold text-slate-600">{item.label}</p>
              <p className="text-[11px] text-slate-400">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

function buildPoints(data, width, height) {
  const values = data.map((item) => item.value)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const range = max - min || 1

  return data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width
    const y = height - ((item.value - min) / range) * height
    return { ...item, x, y }
  })
}

export function LineChart({ title, subtitle, data }) {
  const width = 320
  const height = 130
  const points = buildPoints(data, width, height)
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <WidgetCard title={title} subtitle={subtitle}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible">
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={line} />
        {points.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] font-medium text-slate-500">
        {data.slice(-4).map((item) => (
          <div key={item.label} className="truncate">
            {item.label}
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

export function AreaChart({ title, subtitle, data }) {
  const width = 320
  const height = 130
  const points = buildPoints(data, width, height)
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${points.map((point) => `${point.x},${point.y}`).join(' ')} ${width},${height} 0,${height}`

  return (
    <WidgetCard title={title} subtitle={subtitle}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible">
        <polygon points={area} fill="#10b981" opacity="0.16" />
        <polyline fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={line} />
      </svg>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] font-medium text-slate-500">
        {data.slice(-4).map((item) => (
          <div key={item.label} className="truncate">
            {item.label}
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

export function ProgressList({ title, subtitle, data }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)

  return (
    <WidgetCard title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-slate-700">{item.label}</span>
              <span className="text-xs font-semibold text-slate-500">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${Math.max((item.value / maxValue) * 100, 6)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

export function DataTableWidget({ title, subtitle, columns, rows }) {
  return (
    <WidgetCard title={title} subtitle={subtitle} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {columns.map((column) => (
                  <td key={`${row.id}-${column.key}`} className="px-3 py-3 text-slate-700">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={columns.length}>
                  No records available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </WidgetCard>
  )
}

export function CashFlowWidget({ title, subtitle, steps, cards }) {
  return (
    <WidgetCard title={title} subtitle={subtitle}>
      <div className="grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-3 md:block">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{step.label}</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{step.value}</p>
            </div>
            {index < steps.length - 1 && (
              <span className="text-slate-300 md:mt-3 md:block md:text-center">↓</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-100 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{card.value}</p>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

export function TimelineWidget({ title, subtitle, items }) {
  return (
    <WidgetCard title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="relative flex gap-3">
            <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Clock3 size={15} strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                <Badge tone={item.tone}>{item.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              <p className="mt-1 text-xs font-medium text-slate-400">{item.date}</p>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

export function AlertList({ title, subtitle, alerts }) {
  return (
    <WidgetCard title={title} subtitle={subtitle}>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', alert.iconTone)}>
              <AlertTriangle size={16} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
              <p className="mt-1 text-sm text-slate-500">{alert.description}</p>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

export const summaryIcons = {
  bookings: CalendarCheck,
  revenue: CircleDollarSign,
  invoices: ReceiptText,
  utilization: BarChart3,
  growth: ArrowUpRight,
}
