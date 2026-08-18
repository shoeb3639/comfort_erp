import type { Prisma } from '../../generated/prisma/client'
import type { Salutation } from '../../generated/prisma/enums'

export function mapVendor<T extends { rating: Prisma.Decimal }>(vendor: T) {
  return { ...vendor, rating: vendor.rating.toNumber() }
}

export function mapVendorDriver<
  T extends {
    name: string
    salutation: Salutation | null
    mobile?: string
    licenceNumber?: string | null
    address?: string | null
  },
>(driver: T) {
  return {
    ...driver,
    ...(driver.mobile !== undefined ? { phone: driver.mobile } : {}),
    ...(driver.licenceNumber !== undefined
      ? { license: driver.licenceNumber }
      : {}),
    ...(driver.address !== undefined ? { city: driver.address } : {}),
    displayName: `${driver.salutation === 'MR' ? 'Mr. ' : driver.salutation === 'MS' ? 'Ms. ' : ''}${driver.name}`,
  }
}

export function mapVendorVehicle<
  T extends {
    registrationNumber: string
    vehicleType?: { name: string }
  },
>(vehicle: T) {
  return {
    ...vehicle,
    plate: vehicle.registrationNumber,
    ...(vehicle.vehicleType ? { type: vehicle.vehicleType.name } : {}),
  }
}
