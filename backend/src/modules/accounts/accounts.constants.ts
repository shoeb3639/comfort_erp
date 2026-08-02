export const ACCOUNT_PERMISSIONS = [
  'accounts.collection.view',
  'accounts.deposit.manage',
  'accounts.ledger.view',
  'accounts.fund.release',
  'accounts.expense.manage',
  'accounts.daily_closing.manage',
  'accounts.audit.verify',
] as const

export const ACCOUNT_NAVIGATION = [
  {
    id: 'overview',
    label: 'Accounts Overview',
    path: '/accounts',
    permissions: ACCOUNT_PERMISSIONS,
  },
  {
    id: 'collections',
    label: 'Collections',
    path: '/accounts/collections',
    permissions: ['accounts.collection.view'],
  },
  {
    id: 'cash-deposits',
    label: 'Booking Cash Deposit',
    path: '/accounts/booking-cash-deposit',
    permissions: ['accounts.deposit.manage'],
  },
  {
    id: 'manager-ledger',
    label: 'Manager Ledger',
    path: '/accounts/manager-ledger',
    permissions: ['accounts.ledger.view'],
  },
  {
    id: 'fund-release',
    label: 'Fund Release',
    path: '/accounts/manager-ledger/release',
    permissions: ['accounts.fund.release'],
  },
  {
    id: 'expenses',
    label: 'Expense Entry',
    path: '/accounts/transactions',
    permissions: ['accounts.expense.manage'],
  },
  {
    id: 'daily-closing',
    label: 'Daily Closing',
    path: '/accounts/daily-closing',
    permissions: ['accounts.daily_closing.manage'],
  },
  {
    id: 'audit',
    label: 'Audit & Verification',
    path: '/accounts/audit-verification',
    permissions: ['accounts.audit.verify'],
  },
] as const
