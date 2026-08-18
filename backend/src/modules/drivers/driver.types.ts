import type {
  DriverEngagementType,
  Prisma,
  Salutation,
  SetupRecordStatus,
} from '../../generated/prisma/client'

export interface DriverContext {
  tenantId: string
  userId: string
}

export interface DriverInput {
  engagementType?: DriverEngagementType
  vendorId?: string | null
  salutation?: Salutation | null
  name?: string
  mobile?: string
  alternateMobile?: string | null
  licenceNumber?: string | null
  licenceType?: string | null
  licenceExpiry?: string | null
  address?: string | null
  identityDetails?: Prisma.InputJsonValue | null
  status?: SetupRecordStatus
}
