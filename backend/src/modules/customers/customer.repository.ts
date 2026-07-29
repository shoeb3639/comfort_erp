import type { Prisma } from '../../generated/prisma/client'
import type { CustomerStatus, CustomerType } from '../../generated/prisma/enums'
import { prisma } from '../../config/prisma'

type Transaction = Prisma.TransactionClient

const customerInclude = {
  contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
  travellers: {
    where: { status: 'ACTIVE' as const },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.CustomerInclude

function audit(
  transaction: Transaction,
  tenantId: string,
  actorUserId: string,
  action: string,
  referenceId: string,
) {
  return transaction.tenantAuditLog.create({
    data: {
      tenantId,
      actorUserId,
      module: 'CUSTOMER',
      action,
      referenceId,
    },
  })
}

export function listCustomers(
  tenantId: string,
  filters: { search?: string; type?: CustomerType; status?: CustomerStatus },
) {
  const search = filters.search
  return prisma.customer.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(search
        ? {
            OR: [
              { customerCode: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { billingName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              {
                travellers: {
                  some: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { phone: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                      {
                        employeeId: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: customerInclude,
  })
}

export function findCustomer(tenantId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { tenantId, id: customerId, deletedAt: null },
    include: customerInclude,
  })
}

export function createCustomer(
  tenantId: string,
  customer: Omit<Prisma.CustomerUncheckedCreateInput, 'tenantId'>,
  contacts: Prisma.CustomerContactUncheckedCreateWithoutCustomerInput[],
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const record = await transaction.customer.create({
      data: { ...customer, tenantId },
    })
    if (contacts.length) {
      await transaction.customerContact.createMany({
        data: contacts.map((contact) => ({
          ...contact,
          tenantId,
          customerId: record.id,
        })),
      })
    }
    await audit(transaction, tenantId, actorUserId, 'CREATE', record.id)
    return transaction.customer.findUniqueOrThrow({
      where: { id: record.id },
      include: customerInclude,
    })
  })
}

export function updateCustomer(
  tenantId: string,
  customerId: string,
  data: Prisma.CustomerUncheckedUpdateInput,
  contacts:
    Prisma.CustomerContactUncheckedCreateWithoutCustomerInput[] | undefined,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.customer.findFirst({
      where: { tenantId, id: customerId, deletedAt: null },
    })
    if (!existing) return null
    if (contacts) {
      await transaction.customerContact.deleteMany({
        where: { tenantId, customerId },
      })
      await transaction.customerContact.createMany({
        data: contacts.map((contact) => ({
          ...contact,
          tenantId,
          customerId,
        })),
      })
    }
    await transaction.customer.update({ where: { id: customerId }, data })
    await audit(transaction, tenantId, actorUserId, 'UPDATE', customerId)
    return transaction.customer.findUniqueOrThrow({
      where: { id: customerId },
      include: customerInclude,
    })
  })
}

export function createTraveller(
  tenantId: string,
  customerId: string,
  data: Omit<
    Prisma.CustomerTravellerUncheckedCreateInput,
    'tenantId' | 'customerId'
  >,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const customer = await transaction.customer.findFirst({
      where: { tenantId, id: customerId, deletedAt: null },
    })
    if (!customer) return null
    const traveller = await transaction.customerTraveller.create({
      data: { ...data, tenantId, customerId },
    })
    await audit(
      transaction,
      tenantId,
      actorUserId,
      'CREATE_TRAVELLER',
      traveller.id,
    )
    return traveller
  })
}

export function findTraveller(
  tenantId: string,
  customerId: string,
  travellerId: string,
) {
  return prisma.customerTraveller.findFirst({
    where: { tenantId, customerId, id: travellerId, status: 'ACTIVE' },
  })
}

export function updateTraveller(
  tenantId: string,
  customerId: string,
  travellerId: string,
  data: Prisma.CustomerTravellerUncheckedUpdateInput,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.customerTraveller.findFirst({
      where: { tenantId, customerId, id: travellerId, status: 'ACTIVE' },
    })
    if (!existing) return null
    const traveller = await transaction.customerTraveller.update({
      where: { id: travellerId },
      data,
    })
    await audit(
      transaction,
      tenantId,
      actorUserId,
      'UPDATE_TRAVELLER',
      travellerId,
    )
    return traveller
  })
}
