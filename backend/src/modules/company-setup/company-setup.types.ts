import type {
  SetupRecordStatus,
  UserStatus,
} from '../../generated/prisma/enums'

export interface SetupContext {
  tenantId: string
  userId: string
}

export interface CompanyProfileInput {
  legalName?: string
  tradeName?: string | null
  email?: string
  mobile?: string
  alternateNumber?: string | null
  website?: string | null
  logoUrl?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  pinCode?: string | null
  country?: string
  billingAddress?: Record<string, unknown> | null
  defaultCurrency?: string
  timeZone?: string
  financialYearStartMonth?: number
  dateFormat?: string
  bookingPrefix?: string | null
  invoicePrefix?: string | null
  smsPrefix?: string | null
}

export interface TaxSettingsInput {
  gstin?: string | null
  pan?: string | null
  companyRegistrationNumber?: string | null
  stateCode?: string | null
  taxRegistrationType?: string | null
  taxSettings: Record<string, unknown>
}

export interface InvoiceSettingsInput {
  invoicePrefix?: string | null
  invoiceNumberLength?: number
  invoiceSettings: Record<string, unknown>
}

export interface LocationInput {
  name?: string
  code?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  pinCode?: string | null
  country?: string
  phone?: string | null
  email?: string | null
  isPrimary?: boolean
  status?: SetupRecordStatus
}

export interface BankAccountInput {
  accountName?: string
  bankName?: string
  branchName?: string | null
  accountNumber?: string
  ifscCode?: string
  accountType?: string | null
  upiId?: string | null
  isDefault?: boolean
  status?: SetupRecordStatus
}

export interface GstRegistrationInput {
  registrationName?: string
  legalName?: string
  tradeName?: string | null
  registrationType?: string
  gstin?: string | null
  pan?: string | null
  registeredAddress?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  district?: string | null
  state?: string
  stateCode?: string
  pinCode?: string | null
  country?: string
  effectiveFrom?: Date | null
  effectiveTo?: Date | null
  isDefault?: boolean
  status?: SetupRecordStatus
  notes?: string | null
  locationIds?: string[]
}

export interface TenantUserInput {
  name?: string
  email?: string
  mobile?: string | null
  designation?: string | null
  password?: string
  roleId?: string
  locationIds?: string[]
  status?: UserStatus
}

export interface RoleInput {
  name?: string
  code?: string
  description?: string | null
  permissionIds?: string[]
  status?: UserStatus
}
