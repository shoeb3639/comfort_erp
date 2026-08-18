import type {
  BillingCycle,
  PaymentStatus,
  SubscriptionStatus,
  TenantStatus,
} from '../../generated/prisma/enums'

export interface RegisterTenantInput {
  tenant: {
    legalName: string
    tradeName?: string
    email: string
    mobile: string
    alternateNumber?: string
    website?: string
    logoUrl?: string
    addressLine1?: string
    addressLine2?: string
    city?: string
    state?: string
    pinCode?: string
    country: string
    gstin?: string
    pan?: string
    companyRegistrationNumber?: string
    stateCode?: string
    taxRegistrationType?: string
    billingAddress?: Record<string, unknown>
    defaultCurrency: string
    timeZone: string
    financialYearStartMonth: number
    dateFormat: string
    invoicePrefix?: string
    invoiceNumberLength: number
    taxSettings?: Record<string, unknown>
    status: TenantStatus
  }
  owner: {
    name: string
    email: string
    mobile?: string
    designation?: string
    password: string
  }
  subscription: {
    planId: string
    status: SubscriptionStatus
    billingCycle?: BillingCycle
    startsAt: Date
    expiresAt: Date
    trialEndsAt?: Date
    graceEndsAt?: Date
    userLimit?: number
    vehicleLimit?: number
    bookingLimit?: number
    storageLimitMb?: number
    currency: string
    amount?: number
    discountAmount: number
    taxAmount: number
    finalAmount?: number
    paymentStatus: PaymentStatus
  }
}

export interface ResolvedSubscription {
  billingCycle: BillingCycle
  amount: number
  finalAmount: number
  userLimit?: number
  vehicleLimit?: number
  bookingLimit?: number
  storageLimitMb?: number
}

export interface RegistrationMetadata {
  actorUserId: string
  ipAddress: string | null
}
