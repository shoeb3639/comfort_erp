import type { Prisma } from '../../generated/prisma/client'
import type { Salutation } from '../../generated/prisma/enums'

export function mapCustomer<
  T extends {
    name: string
    salutation: Salutation | null
    creditLimit: Prisma.Decimal
    outstanding: Prisma.Decimal
  },
>(customer: T) {
  return {
    ...customer,
    displayName: `${customer.salutation === 'MR' ? 'Mr. ' : customer.salutation === 'MS' ? 'Ms. ' : ''}${customer.name}`,
    creditLimit: customer.creditLimit.toNumber(),
    outstanding: customer.outstanding.toNumber(),
    bookings: [],
    invoices: [],
    payments: [],
    rateCards: [],
    documents: [],
  }
}
