import { useState } from 'react'
import {
  BarChart3,
  Building2,
  CreditCard,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const navItems = [
  { to: '/platform/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/platform/tenants', label: 'Tenants', icon: Building2 },
  { to: '/platform/subscription-plans', label: 'Subscription Plans', icon: ReceiptText },
  { to: '/platform/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/platform/payments', label: 'Payments', icon: BarChart3 },
  { to: '/platform/users', label: 'Users', icon: Users },
  { to: '/platform/support', label: 'Support', icon: Headphones },
  { to: '/platform/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
  { to: '/platform/settings', label: 'Platform Settings', icon: Settings },
]

const pageMeta = {
  '/platform/dashboard': {
    eyebrow: 'Cablix platform',
    title: 'Platform Dashboard',
    description: 'Monitor tenants, subscriptions, trials, revenue, and support activity.',
  },
  '/platform/tenants': {
    eyebrow: 'Tenant management',
    title: 'Tenants',
    description: 'Create, activate, suspend, and monitor car rental company accounts.',
  },
  '/platform/subscription-plans': {
    eyebrow: 'Plans',
    title: 'Subscription Plans',
    description: 'Manage SaaS plan limits, pricing, and trial configuration.',
  },
  '/platform/subscriptions': {
    eyebrow: 'Subscriptions',
    title: 'Tenant Subscriptions',
    description: 'Track subscription status, expiry, grace period, and payment state.',
  },
  '/platform/payments': {
    eyebrow: 'SaaS billing',
    title: 'Payments',
    description: 'Review subscription payment records and outstanding amounts.',
  },
  '/platform/users': {
    eyebrow: 'Platform access',
    title: 'Platform Users',
    description: 'Manage Cablix platform administrators separately from tenant users.',
  },
  '/platform/support': {
    eyebrow: 'Support',
    title: 'Support Controls',
    description: 'Track tenant support requests and operational escalations.',
  },
  '/platform/audit-logs': {
    eyebrow: 'Audit',
    title: 'Platform Audit Logs',
    description: 'Review platform-level tenant, subscription, and support actions.',
  },
  '/platform/settings': {
    eyebrow: 'Platform settings',
    title: 'Platform Settings',
    description: 'Configure SaaS platform defaults and support policies.',
  },
}

function PlatformBrand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
        CB
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-brand-600">Cablix</p>
        <h1 className="text-base font-semibold text-slate-950">Platform Admin</h1>
      </div>
    </div>
  )
}

function Sidebar({ onNavigate }) {
  const location = useLocation()

  return (
    <nav className="space-y-1 px-3 py-4">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)

        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 ring-1 ring-inset ring-current/10">
              <Icon size={17} strokeWidth={2.2} />
            </span>
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

function PlatformLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const meta = pageMeta[location.pathname] || pageMeta['/platform/dashboard']

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="border-b border-slate-200 p-5">
          <PlatformBrand />
        </div>
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/40" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-80 max-w-[85vw] border-r border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <PlatformBrand />
              <button
                type="button"
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
                onClick={() => setMobileOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-20 items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                aria-label="Open navigation"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-600">{meta.eyebrow}</p>
                <h2 className="truncate text-xl font-semibold text-slate-950">{meta.title}</h2>
                <p className="mt-1 hidden text-sm text-slate-500 md:block">{meta.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="hidden rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex"
                onClick={() => navigate('/dashboard')}
              >
                Tenant ERP
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600"
                aria-label="Sign out"
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default PlatformLayout
