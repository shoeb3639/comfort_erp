import type {
  AccountPaymentMode,
  CashDepositMode,
  CashDepositStatus,
  CollectionPaymentMode,
  CollectionStatus,
} from '../../generated/prisma/client'

export interface CollectionQuery {
  dateFrom?: Date
  dateTo?: Date
  paymentMode?: CollectionPaymentMode
  status?: CollectionStatus
  booking?: string
  customerId?: string
  search?: string
  page: number
  limit: number
}

export interface CashDepositQuery {
  dateFrom?: Date
  dateTo?: Date
  status?: CashDepositStatus
  managerId?: string
  booking?: string
  customerId?: string
  search?: string
  page: number
  limit: number
}

export interface DepositCashInput {
  depositedAmount: number
  depositDate: Date
  depositMode: CashDepositMode
  bankReference: string
  attachmentName?: string | null
  depositedBy: string
  remarks?: string | null
}

export interface VerifyCashDepositInput {
  verifiedAmount: number
  verifiedBy: string
  mismatchReason?: string | null
  remarks?: string | null
}

export interface ManagerLedgerQuery {
  search?: string
  status?: 'ACTIVE' | 'INACTIVE'
  managerId?: string
  locationId?: string
}

export interface CreateManagerLedgerInput {
  managerId: string
  locationId: string
  openingBalance: number
  remarks?: string | null
}

export interface FundReleaseQuery {
  ledgerId?: string
  status?: 'PENDING' | 'APPROVED' | 'VERIFIED' | 'REJECTED'
  paymentMode?: AccountPaymentMode
  dateFrom?: Date
  dateTo?: Date
  search?: string
}

export interface CreateFundReleaseInput {
  ledgerId: string
  releaseDate: Date
  amount: number
  paymentMode: AccountPaymentMode
  referenceNumber: string
  description: string
  attachmentName?: string | null
  remarks?: string | null
}
