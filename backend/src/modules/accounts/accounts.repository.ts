import { prisma } from '../../config/prisma'
import type {
  CashDepositMode,
  CashDepositStatus,
  CollectionPaymentMode,
  CollectionStatus,
  AccountPaymentMode,
  Prisma,
} from '../../generated/prisma/client'

export interface CollectionFilters {
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

export interface CashDepositFilters {
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

export interface ManagerLedgerFilters {
  search?: string
  status?: 'ACTIVE' | 'INACTIVE'
  managerId?: string
  locationId?: string
}

export interface FundReleaseFilters {
  ledgerId?: string
  status?: 'PENDING' | 'APPROVED' | 'VERIFIED' | 'REJECTED'
  paymentMode?: AccountPaymentMode
  dateFrom?: Date
  dateTo?: Date
  search?: string
}

function collectionWhere(
  tenantId: string,
  filters: CollectionFilters,
): Prisma.BookingCollectionWhereInput {
  return {
    tenantId,
    ...(filters.status
      ? { status: filters.status }
      : { status: { not: 'VOID' } }),
    ...(filters.paymentMode ? { paymentMode: filters.paymentMode } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          collectionDate: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
    ...(filters.customerId || filters.booking || filters.search
      ? {
          booking: {
            ...(filters.customerId ? { customerId: filters.customerId } : {}),
            ...(filters.booking
              ? {
                  bookingNumber: {
                    contains: filters.booking,
                    mode: 'insensitive' as const,
                  },
                }
              : {}),
            ...(filters.search
              ? {
                  OR: [
                    {
                      bookingNumber: {
                        contains: filters.search,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      customer: {
                        billingName: {
                          contains: filters.search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  ],
                }
              : {}),
          },
        }
      : {}),
  }
}

const collectionInclude = {
  booking: {
    include: {
      customer: true,
      closure: true,
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          netPayable: true,
        },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    },
  },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      netPayable: true,
    },
  },
} satisfies Prisma.BookingCollectionInclude

export async function listCollections(
  tenantId: string,
  filters: CollectionFilters,
) {
  const where = collectionWhere(tenantId, filters)
  const [records, total] = await prisma.$transaction([
    prisma.bookingCollection.findMany({
      where,
      include: collectionInclude,
      orderBy: [{ collectionDate: 'desc' }, { createdAt: 'desc' }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.bookingCollection.count({ where }),
  ])
  return { records, total }
}

export function listBookingBalances(
  tenantId: string,
  filters: Pick<CollectionFilters, 'booking' | 'customerId' | 'search'>,
) {
  return prisma.booking.findMany({
    where: {
      tenantId,
      deletedAt: null,
      closure: { isNot: null },
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.booking
        ? {
            bookingNumber: {
              contains: filters.booking,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              {
                bookingNumber: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
              {
                customer: {
                  billingName: {
                    contains: filters.search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      bookingNumber: true,
      customerId: true,
      customer: { select: { billingName: true } },
      closure: { select: { totalBillAmount: true, closedAt: true } },
      collections: {
        where: { status: { not: 'VOID' } },
        select: { amount: true, status: true, paymentMode: true },
      },
      invoices: {
        select: { id: true, invoiceNumber: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export function findCollection(tenantId: string, collectionId: string) {
  return prisma.bookingCollection.findFirst({
    where: { tenantId, id: collectionId },
    include: collectionInclude,
  })
}

export function collectionAuditTrail(tenantId: string, collectionId: string) {
  return prisma.tenantAuditLog.findMany({
    where: {
      tenantId,
      module: 'BOOKING_COLLECTION',
      referenceId: collectionId,
    },
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export function collectionFilterOptions(tenantId: string) {
  return Promise.all([
    prisma.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        bookings: { some: { closure: { isNot: null } } },
      },
      select: { id: true, billingName: true },
      orderBy: { billingName: 'asc' },
    }),
    prisma.booking.findMany({
      where: { tenantId, deletedAt: null, closure: { isNot: null } },
      select: {
        id: true,
        bookingNumber: true,
        customer: { select: { billingName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
  ])
}

const cashDepositInclude = {
  collection: {
    include: {
      booking: {
        include: {
          customer: true,
          invoices: {
            select: { id: true, invoiceNumber: true },
            orderBy: { createdAt: 'desc' as const },
            take: 1,
          },
        },
      },
    },
  },
} satisfies Prisma.BookingCashDepositInclude

function cashDepositWhere(
  tenantId: string,
  filters: CashDepositFilters,
): Prisma.BookingCashDepositWhereInput {
  return {
    tenantId,
    deletedAt: null,
    ...(filters.status
      ? { status: filters.status }
      : { status: { not: 'VOID' } }),
    ...(filters.managerId ? { receiverManagerId: filters.managerId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          collection: {
            collectionDate: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          },
        }
      : {}),
    ...(filters.booking || filters.customerId || filters.search
      ? {
          collection: {
            ...(filters.dateFrom || filters.dateTo
              ? {
                  collectionDate: {
                    ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                    ...(filters.dateTo ? { lte: filters.dateTo } : {}),
                  },
                }
              : {}),
            booking: {
              ...(filters.customerId ? { customerId: filters.customerId } : {}),
              ...(filters.booking
                ? {
                    bookingNumber: {
                      contains: filters.booking,
                      mode: 'insensitive' as const,
                    },
                  }
                : {}),
              ...(filters.search
                ? {
                    OR: [
                      {
                        bookingNumber: {
                          contains: filters.search,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        customer: {
                          billingName: {
                            contains: filters.search,
                            mode: 'insensitive' as const,
                          },
                        },
                      },
                    ],
                  }
                : {}),
            },
          },
        }
      : {}),
  }
}

export async function listCashDeposits(
  tenantId: string,
  filters: CashDepositFilters,
) {
  const where = cashDepositWhere(tenantId, filters)
  const [records, total, aggregate, statusGroups] = await prisma.$transaction([
    prisma.bookingCashDeposit.findMany({
      where,
      include: cashDepositInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.bookingCashDeposit.count({ where }),
    prisma.bookingCashDeposit.aggregate({
      where,
      _sum: {
        amountCollected: true,
        depositedAmount: true,
        verifiedAmount: true,
        mismatchAmount: true,
      },
    }),
    prisma.bookingCashDeposit.groupBy({
      by: ['status'],
      where,
      orderBy: { status: 'asc' },
      _sum: {
        amountCollected: true,
        depositedAmount: true,
        verifiedAmount: true,
        mismatchAmount: true,
      },
    }),
  ])
  return { records, total, aggregate, statusGroups }
}

export function findCashDeposit(tenantId: string, depositId: string) {
  return prisma.bookingCashDeposit.findFirst({
    where: { tenantId, id: depositId, deletedAt: null },
    include: cashDepositInclude,
  })
}

export function findTenantManager(tenantId: string, managerId: string) {
  return prisma.tenantUser.findFirst({
    where: {
      tenantId,
      id: managerId,
      status: 'ACTIVE',
      deletedAt: null,
      OR: [
        { role: { code: { in: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'] } } },
        { role: { code: { contains: 'MANAGER', mode: 'insensitive' } } },
      ],
    },
    select: { id: true, name: true, email: true },
  })
}

export function cashDepositFilterOptions(tenantId: string) {
  return Promise.all([
    prisma.tenantUser.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          { role: { code: { in: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'] } } },
          { role: { code: { contains: 'MANAGER', mode: 'insensitive' } } },
        ],
      },
      select: { id: true, name: true, role: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        bookings: {
          some: {
            collections: { some: { paymentMode: 'CASH' } },
          },
        },
      },
      select: { id: true, billingName: true },
      orderBy: { billingName: 'asc' },
    }),
  ])
}

export function cashDepositAuditTrail(tenantId: string, depositId: string) {
  return prisma.tenantAuditLog.findMany({
    where: {
      tenantId,
      module: 'BOOKING_CASH_DEPOSIT',
      referenceId: depositId,
    },
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export function receiveCashDeposit(
  tenantId: string,
  depositId: string,
  manager: { id: string; name: string },
  userId: string,
  remarks: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.bookingCashDeposit.findFirst({
      where: {
        tenantId,
        id: depositId,
        deletedAt: null,
        status: 'COLLECTED',
      },
    })
    if (!current) return null
    const updated = await transaction.bookingCashDeposit.update({
      where: { tenantId_id: { tenantId, id: depositId } },
      data: {
        receiverManagerId: manager.id,
        receiverManagerName: manager.name,
        receivedAt: new Date(),
        status: 'WITH_MANAGER',
        remarks,
        updatedById: userId,
      },
    })
    await transaction.bookingCollection.update({
      where: {
        tenantId_id: { tenantId, id: current.collectionId },
      },
      data: { status: 'WITH_MANAGER', receiverName: manager.name },
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'BOOKING_CASH_DEPOSIT',
        action: 'RECEIVE',
        referenceId: depositId,
        oldValues: { status: current.status },
        newValues: {
          status: updated.status,
          receiverManagerId: manager.id,
          receiverManagerName: manager.name,
        },
        remarks,
      },
    })
    return updated
  })
}

export function depositCash(
  tenantId: string,
  depositId: string,
  userId: string,
  input: {
    depositedAmount: number
    depositDate: Date
    depositMode: CashDepositMode
    bankReference: string
    normalizedBankReference: string
    attachmentName: string | null
    depositedByName: string
    remarks: string | null
  },
) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.bookingCashDeposit.findFirst({
      where: {
        tenantId,
        id: depositId,
        deletedAt: null,
        status: { in: ['COLLECTED', 'WITH_MANAGER'] },
      },
    })
    if (!current) return null
    const updated = await transaction.bookingCashDeposit.update({
      where: { tenantId_id: { tenantId, id: depositId } },
      data: {
        depositedAmount: input.depositedAmount,
        depositDate: input.depositDate,
        depositMode: input.depositMode,
        bankReference: input.bankReference,
        attachmentName: input.attachmentName,
        depositedById: userId,
        depositedByName: input.depositedByName,
        status: 'DEPOSITED',
        remarks: input.remarks,
        updatedById: userId,
      },
    })
    await transaction.accountReference.create({
      data: {
        tenantId,
        referenceNumber: input.bankReference,
        normalizedReferenceNumber: input.normalizedBankReference,
        source: 'CASH_DEPOSIT',
        sourceId: depositId,
        createdById: userId,
        updatedById: userId,
      },
    })
    await transaction.bookingCollection.update({
      where: {
        tenantId_id: { tenantId, id: current.collectionId },
      },
      data: {
        status: 'DEPOSITED',
        depositDate: input.depositDate,
        depositMode: input.depositMode
          .split('_')
          .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
          .join(' '),
        depositReferenceNumber: input.bankReference,
        depositedByName: input.depositedByName,
      },
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'BOOKING_CASH_DEPOSIT',
        action: 'DEPOSIT',
        referenceId: depositId,
        oldValues: { status: current.status },
        newValues: {
          status: updated.status,
          depositedAmount: input.depositedAmount,
          bankReference: input.bankReference,
        },
        remarks: input.remarks,
      },
    })
    return updated
  })
}

export function verifyCashDeposit(
  tenantId: string,
  depositId: string,
  userId: string,
  input: {
    verifiedAmount: number
    verifiedByName: string
    mismatchReason: string | null
    remarks: string | null
  },
) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.bookingCashDeposit.findFirst({
      where: {
        tenantId,
        id: depositId,
        deletedAt: null,
        status: 'DEPOSITED',
      },
    })
    if (!current) return null
    const mismatchAmount = Math.abs(
      Number(current.amountCollected) - input.verifiedAmount,
    )
    const status = mismatchAmount === 0 ? 'VERIFIED' : 'MISMATCH'
    const now = new Date()
    const updated = await transaction.bookingCashDeposit.update({
      where: { tenantId_id: { tenantId, id: depositId } },
      data: {
        verifiedAmount: input.verifiedAmount,
        verifiedById: userId,
        verifiedByName: input.verifiedByName,
        verifiedAt: now,
        mismatchAmount,
        mismatchReason: status === 'MISMATCH' ? input.mismatchReason : null,
        status,
        remarks: input.remarks,
        updatedById: userId,
      },
    })
    await transaction.bookingCollection.update({
      where: {
        tenantId_id: { tenantId, id: current.collectionId },
      },
      data:
        status === 'VERIFIED'
          ? {
              status: 'VERIFIED',
              verifiedAt: now,
              verifiedById: userId,
              verifiedByName: input.verifiedByName,
            }
          : { status: 'DEPOSITED' },
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'BOOKING_CASH_DEPOSIT',
        action: status === 'VERIFIED' ? 'VERIFY' : 'MISMATCH',
        referenceId: depositId,
        oldValues: { status: current.status },
        newValues: {
          status,
          verifiedAmount: input.verifiedAmount,
          mismatchAmount,
        },
        remarks: input.remarks ?? input.mismatchReason,
      },
    })
    return updated
  })
}

const managerLedgerInclude = {
  manager: {
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      role: { select: { id: true, name: true, code: true } },
    },
  },
  location: {
    select: { id: true, name: true, code: true, city: true, state: true },
  },
  _count: { select: { entries: true } },
} satisfies Prisma.ManagerLedgerInclude

export function listManagerLedgers(
  tenantId: string,
  filters: ManagerLedgerFilters,
) {
  return prisma.managerLedger.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.managerId ? { managerId: filters.managerId } : {}),
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                manager: {
                  name: { contains: filters.search, mode: 'insensitive' },
                },
              },
              {
                manager: {
                  email: { contains: filters.search, mode: 'insensitive' },
                },
              },
              {
                location: {
                  name: { contains: filters.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    },
    include: managerLedgerInclude,
    orderBy: [{ status: 'asc' }, { manager: { name: 'asc' } }],
  })
}

export function managerLedgerOptions(tenantId: string) {
  return Promise.all([
    prisma.tenantUser.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          { role: { code: { in: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'] } } },
          { role: { code: { contains: 'MANAGER', mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.tenantLocation.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, code: true, city: true },
      orderBy: { name: 'asc' },
    }),
  ])
}

export function findActiveLocation(tenantId: string, locationId: string) {
  return prisma.tenantLocation.findFirst({
    where: { tenantId, id: locationId, status: 'ACTIVE' },
    select: { id: true, name: true, code: true },
  })
}

export function findManagerLedger(tenantId: string, ledgerId: string) {
  return prisma.managerLedger.findFirst({
    where: { tenantId, id: ledgerId, deletedAt: null },
    include: {
      ...managerLedgerInclude,
      entries: {
        orderBy: [{ entryNumber: 'desc' }],
      },
    },
  })
}

export function createManagerLedger(
  tenantId: string,
  userId: string,
  input: {
    managerId: string
    locationId: string
    openingBalance: number
    remarks: string | null
  },
) {
  return prisma.$transaction(async (transaction) => {
    const ledger = await transaction.managerLedger.create({
      data: {
        tenantId,
        managerId: input.managerId,
        locationId: input.locationId,
        openingBalance: input.openingBalance,
        currentBalance: input.openingBalance,
        remarks: input.remarks,
        createdById: userId,
        updatedById: userId,
      },
    })
    await transaction.managerLedgerEntry.create({
      data: {
        tenantId,
        ledgerId: ledger.id,
        entryNumber: 1,
        entryDate: new Date(),
        entryType: 'OPENING_BALANCE',
        description: 'Opening Balance',
        credit: input.openingBalance,
        debit: 0,
        balanceBefore: 0,
        runningBalance: input.openingBalance,
        remarks: input.remarks,
        createdById: userId,
      },
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'MANAGER_LEDGER',
        action: 'CREATE',
        referenceId: ledger.id,
        newValues: {
          managerId: input.managerId,
          locationId: input.locationId,
          openingBalance: input.openingBalance,
          status: 'ACTIVE',
        },
        remarks: input.remarks,
      },
    })
    return ledger
  })
}

export function updateManagerLedgerStatus(
  tenantId: string,
  ledgerId: string,
  userId: string,
  status: 'ACTIVE' | 'INACTIVE',
  reason: string,
) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.managerLedger.findFirst({
      where: { tenantId, id: ledgerId, deletedAt: null },
    })
    if (!current) return null
    if (current.status === status) return current
    const updated = await transaction.managerLedger.update({
      where: { tenantId_id: { tenantId, id: ledgerId } },
      data: { status, updatedById: userId },
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'MANAGER_LEDGER',
        action: status === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE',
        referenceId: ledgerId,
        oldValues: { status: current.status },
        newValues: { status },
        remarks: reason,
      },
    })
    return updated
  })
}

export function managerLedgerAuditTrail(tenantId: string, ledgerId: string) {
  return prisma.tenantAuditLog.findMany({
    where: {
      tenantId,
      module: 'MANAGER_LEDGER',
      referenceId: ledgerId,
    },
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

const fundReleaseInclude = {
  ledger: {
    include: {
      manager: { select: { id: true, name: true, email: true } },
      location: { select: { id: true, name: true, code: true } },
    },
  },
  releasedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  verifiedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.CompanyFundReleaseInclude

export function listFundReleases(
  tenantId: string,
  filters: FundReleaseFilters,
) {
  return prisma.companyFundRelease.findMany({
    where: {
      tenantId,
      ...(filters.ledgerId ? { ledgerId: filters.ledgerId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.paymentMode ? { paymentMode: filters.paymentMode } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            releaseDate: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              {
                referenceNumber: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
              {
                ledger: {
                  manager: {
                    name: { contains: filters.search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: fundReleaseInclude,
    orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
  })
}

export function findFundRelease(tenantId: string, releaseId: string) {
  return prisma.companyFundRelease.findFirst({
    where: { tenantId, id: releaseId },
    include: fundReleaseInclude,
  })
}

export function fundReleaseAuditTrail(tenantId: string, releaseId: string) {
  return prisma.tenantAuditLog.findMany({
    where: {
      tenantId,
      module: 'FUND_RELEASE',
      referenceId: releaseId,
    },
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export function createAndPostFundRelease(
  tenantId: string,
  userId: string,
  input: {
    ledgerId: string
    releaseDate: Date
    amount: number
    paymentMode: AccountPaymentMode
    referenceNumber: string
    description: string
    attachmentName: string | null
    remarks: string | null
  },
) {
  return prisma.$transaction(
    async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "manager_ledgers"
        WHERE "tenant_id" = ${tenantId}::uuid
          AND "id" = ${input.ledgerId}::uuid
          AND "status" = 'ACTIVE'
          AND "deleted_at" IS NULL
        FOR UPDATE
      `
      if (!locked.length) return null

      const ledger = await transaction.managerLedger.findUniqueOrThrow({
        where: {
          tenantId_id: { tenantId, id: input.ledgerId },
        },
      })
      const latest = await transaction.managerLedgerEntry.aggregate({
        where: { tenantId, ledgerId: input.ledgerId },
        _max: { entryNumber: true },
      })
      const release = await transaction.companyFundRelease.create({
        data: {
          tenantId,
          ledgerId: input.ledgerId,
          releaseDate: input.releaseDate,
          amount: input.amount,
          paymentMode: input.paymentMode,
          referenceNumber: input.referenceNumber,
          description: input.description,
          attachmentName: input.attachmentName,
          status: 'PENDING',
          releasedById: userId,
          remarks: input.remarks,
        },
      })
      await transaction.accountReference.create({
        data: {
          tenantId,
          referenceNumber: input.referenceNumber,
          normalizedReferenceNumber: input.referenceNumber,
          source: 'FUND_RELEASE',
          sourceId: release.id,
          createdById: userId,
          updatedById: userId,
        },
      })
      const entry = await transaction.managerLedgerEntry.create({
        data: {
          tenantId,
          ledgerId: input.ledgerId,
          entryNumber: (latest._max.entryNumber ?? 0) + 1,
          entryDate: input.releaseDate,
          entryType: 'FUND_RELEASE',
          description: input.description,
          credit: input.amount,
          debit: 0,
          balanceBefore: ledger.currentBalance,
          runningBalance: Number(ledger.currentBalance) + input.amount,
          referenceNumber: input.referenceNumber,
          sourceId: release.id,
          remarks: input.remarks,
          createdById: userId,
        },
      })
      await transaction.managerLedger.update({
        where: { tenantId_id: { tenantId, id: input.ledgerId } },
        data: {
          totalCredits: { increment: input.amount },
          currentBalance: { increment: input.amount },
          updatedById: userId,
        },
      })
      await transaction.companyFundRelease.update({
        where: { tenantId_id: { tenantId, id: release.id } },
        data: {
          status: 'VERIFIED',
          approvedById: userId,
          approvedAt: new Date(),
          verifiedById: userId,
          verifiedAt: new Date(),
          ledgerEntryId: entry.id,
        },
      })
      await transaction.tenantAuditLog.create({
        data: {
          tenantId,
          actorUserId: userId,
          module: 'FUND_RELEASE',
          action: 'CREATE_AND_VERIFY',
          referenceId: release.id,
          newValues: {
            ledgerId: input.ledgerId,
            amount: input.amount,
            referenceNumber: input.referenceNumber,
            ledgerEntryId: entry.id,
            status: 'VERIFIED',
          },
          remarks: input.remarks,
        },
      })
      return release.id
    },
    { isolationLevel: 'Serializable' },
  )
}

export async function findReferenceUsage(
  tenantId: string,
  normalizedReferenceNumber: string,
) {
  const [registered, collection, deposit] = await Promise.all([
    prisma.accountReference.findFirst({
      where: { tenantId, normalizedReferenceNumber },
      select: { id: true, source: true, sourceId: true, deletedAt: true },
    }),
    prisma.bookingCollection.findFirst({
      where: {
        tenantId,
        referenceNumber: {
          equals: normalizedReferenceNumber,
          mode: 'insensitive',
        },
        status: { not: 'VOID' },
      },
      select: { id: true },
    }),
    prisma.bookingCollection.findFirst({
      where: {
        tenantId,
        depositReferenceNumber: {
          equals: normalizedReferenceNumber,
          mode: 'insensitive',
        },
        status: { not: 'VOID' },
      },
      select: { id: true },
    }),
  ])

  if (registered)
    return {
      source: registered.source,
      sourceId: registered.sourceId ?? registered.id,
      voided: Boolean(registered.deletedAt),
    }
  if (collection)
    return {
      source: 'COLLECTION' as const,
      sourceId: collection.id,
      voided: false,
    }
  if (deposit)
    return {
      source: 'CASH_DEPOSIT' as const,
      sourceId: deposit.id,
      voided: false,
    }
  return null
}
