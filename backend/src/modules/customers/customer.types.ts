import type {
  CustomerStatus,
  CustomerType,
  Salutation,
} from '../../generated/prisma/enums'

export interface CustomerContext {
  tenantId: string
  userId: string
}

export interface CustomerContactInput {
  salutation?: Salutation | null
  name: string
  role?: string | null
  phone?: string | null
  email?: string | null
  isPrimary?: boolean
}

export interface CustomerInput {
  type?: CustomerType
  salutation?: Salutation | null
  name?: string
  billingName?: string
  email?: string | null
  phone?: string
  city?: string | null
  gstin?: string | null
  billingAddress?: string | null
  creditLimit?: number
  status?: CustomerStatus
  contacts?: CustomerContactInput[]
}

export interface TravellerInput {
  travellerType: string
  salutation?: Salutation | null
  name: string
  phone?: string | null
  email?: string | null
  department?: string | null
  employeeId?: string | null
  notes?: string | null
  status?: CustomerStatus
}
