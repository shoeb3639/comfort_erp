import type { BookingStatus, Prisma } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'
import type { PageRequest } from '../../shared/pagination'
import { pageWindow } from '../../shared/pagination'

const include = {
  customer: true,
  traveller: true,
  vendor: true,
  vehicle: { include: { vehicleType: true } },
  driver: true,
  closure: true,
  collections: {
    where: { status: { not: 'VOID' as const } },
    include: { cashDeposit: true },
    orderBy: { collectionDate: 'desc' as const },
  },
  invoices: {
    include: { items: { orderBy: { sortOrder: 'asc' as const } } },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.BookingInclude

export function getTenantPrefix(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { bookingPrefix: true },
  })
}

export function updateTenantPrefix(tenantId: string, bookingPrefix: string) {
  return prisma.tenant.update({
    where: { id: tenantId },
    data: { bookingPrefix },
    select: { bookingPrefix: true },
  })
}

export function list(
  tenantId: string,
  filters: { search?: string; status?: string; view?: string } & PageRequest,
) {
  const where = {
    tenantId,
    deletedAt: null,
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.view === 'CLOSED'
      ? { status: 'CLOSED' }
      : filters.view === 'ACTIVE'
        ? { status: { notIn: ['CLOSED', 'CANCELLED'] } }
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
              serviceCity: { contains: filters.search, mode: 'insensitive' },
            },
            {
              pickupReportingAddress: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
            {
              customer: {
                name: { contains: filters.search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.BookingWhereInput
  return Promise.all([
    prisma.booking.findMany({
      where,
      include,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      ...pageWindow(filters),
    }),
    prisma.booking.count({ where }),
  ])
}

export function find(tenantId: string, idOrNumber: string) {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idOrNumber,
    )
  return prisma.booking.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      ...(isUuid
        ? { id: idOrNumber }
        : { bookingNumber: idOrNumber.toUpperCase() }),
    },
    include,
  })
}

export function findCustomer(tenantId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { tenantId, id: customerId, deletedAt: null, status: 'ACTIVE' },
  })
}

export function findTraveller(tenantId: string, travellerId: string) {
  return prisma.customerTraveller.findFirst({
    where: { tenantId, id: travellerId, status: 'ACTIVE' },
  })
}

export function findAssignmentResources(
  tenantId: string,
  vendorId: string | null,
  vehicleId: string,
  driverId: string,
) {
  return Promise.all([
    vendorId
      ? prisma.vendor.findFirst({
          where: { tenantId, id: vendorId, deletedAt: null, status: 'ACTIVE' },
        })
      : null,
    prisma.vehicle.findFirst({
      where: { tenantId, id: vehicleId, deletedAt: null, status: 'ACTIVE' },
    }),
    prisma.driver.findFirst({
      where: { tenantId, id: driverId, deletedAt: null, status: 'ACTIVE' },
    }),
  ])
}

export function hasResourceConflict(
  tenantId: string,
  bookingId: string,
  vehicleId: string,
  driverId: string,
  startDate: Date,
  endDate: Date,
) {
  return prisma.booking.findFirst({
    where: {
      tenantId,
      id: { not: bookingId },
      deletedAt: null,
      status: { in: ['ASSIGNED', 'RUNNING'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      OR: [{ vehicleId }, { driverId }],
    },
    select: { bookingNumber: true, vehicleId: true, driverId: true },
  })
}

export function create(data: Prisma.BookingUncheckedCreateInput) {
  return prisma.booking.create({ data, include })
}

export function update(
  tenantId: string,
  bookingId: string,
  data: Prisma.BookingUncheckedUpdateInput,
) {
  return prisma.booking.updateMany({
    where: { tenantId, id: bookingId, deletedAt: null },
    data,
  })
}

export function assign(
  tenantId: string,
  bookingId: string,
  data: Prisma.BookingUncheckedUpdateInput,
  userId: string,
) {
  return lifecycleTransition(
    tenantId,
    bookingId,
    ['CONFIRMED', 'ASSIGNED'],
    data,
    userId,
    'ASSIGN',
  )
}

export function lifecycleTransition(
  tenantId: string,
  bookingId: string,
  expectedStatuses: BookingStatus[],
  data: Prisma.BookingUncheckedUpdateInput,
  userId: string,
  action: string,
) {
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.booking.updateMany({
      where: {
        tenantId,
        id: bookingId,
        deletedAt: null,
        status: { in: expectedStatuses },
      },
      data,
    })
    if (!result.count) return null
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'BOOKING',
        action,
        referenceId: bookingId,
        newValues: {
          status: typeof data.status === 'string' ? data.status : undefined,
        },
      },
    })
    return transaction.booking.findUniqueOrThrow({
      where: { tenantId_id: { tenantId, id: bookingId } },
      include,
    })
  })
}

export function softDelete(
  tenantId: string,
  bookingId: string,
  userId: string,
) {
  return prisma.booking.updateMany({
    where: {
      tenantId,
      id: bookingId,
      deletedAt: null,
      status: { in: ['DRAFT', 'CONFIRMED'] },
    },
    data: { deletedAt: new Date(), deletedById: userId, updatedById: userId },
  })
}

export interface CloseBookingData {
  closure: Prisma.BookingClosureUncheckedCreateWithoutBookingInput
  invoice: Omit<Prisma.InvoiceUncheckedCreateInput, 'tenantId' | 'bookingId'>
  invoiceItems: Prisma.InvoiceItemUncheckedCreateWithoutInvoiceInput[]
  initialCollection: {
    collectionDate: Date
    amount: number
    paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE'
    collectedByName: string
    referenceNumber: string | null
    normalizedReferenceNumber: string | null
    status: 'PENDING' | 'DIRECTLY_RECEIVED'
  } | null
}

export function closeBooking(
  tenantId: string,
  bookingId: string,
  userId: string,
  data: CloseBookingData,
) {
  return prisma.$transaction(async (transaction) => {
    const locked = await transaction.booking.updateMany({
      where: {
        tenantId,
        id: bookingId,
        deletedAt: null,
        status: { in: ['CONFIRMED', 'ASSIGNED', 'COMPLETED'] },
        closure: null,
      },
      data: { status: 'CLOSED', updatedById: userId },
    })
    if (!locked.count) return null
    await transaction.bookingClosure.create({
      data: {
        ...data.closure,
        tenantId,
        bookingId,
      },
    })
    const invoice = await transaction.invoice.create({
      data: {
        ...data.invoice,
        tenantId,
        bookingId,
      },
    })
    await transaction.invoiceItem.createMany({
      data: data.invoiceItems.map((item) => ({
        ...item,
        tenantId,
        invoiceId: invoice.id,
      })),
    })
    if (data.initialCollection) {
      const collection = await transaction.bookingCollection.create({
        data: {
          collectionDate: data.initialCollection.collectionDate,
          amount: data.initialCollection.amount,
          paymentMode: data.initialCollection.paymentMode,
          collectedByName: data.initialCollection.collectedByName,
          referenceNumber: data.initialCollection.referenceNumber,
          status: data.initialCollection.status,
          tenantId,
          bookingId,
          invoiceId: invoice.id,
          recordedById: userId,
        },
      })
      if (collection.paymentMode === 'CASH')
        await transaction.bookingCashDeposit.create({
          data: {
            tenantId,
            collectionId: collection.id,
            amountCollected: collection.amount,
            receiverManagerName: collection.collectedByName,
            status: 'COLLECTED',
            createdById: userId,
            updatedById: userId,
          },
        })
      if (collection.referenceNumber)
        await transaction.accountReference.create({
          data: {
            tenantId,
            referenceNumber: collection.referenceNumber,
            normalizedReferenceNumber:
              data.initialCollection.normalizedReferenceNumber!,
            source: 'COLLECTION',
            sourceId: collection.id,
            createdById: userId,
            updatedById: userId,
          },
        })
      await transaction.tenantAuditLog.create({
        data: {
          tenantId,
          actorUserId: userId,
          module: 'BOOKING_COLLECTION',
          action: 'CREATE',
          referenceId: collection.id,
          newValues: {
            bookingId,
            status: collection.status,
            paymentMode: collection.paymentMode,
            referenceNumber: collection.referenceNumber,
          },
        },
      })
    }
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'BOOKING',
        action: 'CLOSE',
        referenceId: bookingId,
        newValues: { status: 'CLOSED' },
      },
    })
    return transaction.booking.findUniqueOrThrow({
      where: { tenantId_id: { tenantId, id: bookingId } },
      include,
    })
  })
}

export function createCollection(
  tenantId: string,
  bookingId: string,
  userId: string,
  data: Omit<
    Prisma.BookingCollectionUncheckedCreateInput,
    'tenantId' | 'bookingId' | 'recordedById'
  >,
  references: Array<{
    referenceNumber: string
    normalizedReferenceNumber: string
    source: 'COLLECTION' | 'CASH_DEPOSIT'
  }>,
) {
  return prisma.$transaction(async (transaction) => {
    const collection = await transaction.bookingCollection.create({
      data: { ...data, tenantId, bookingId, recordedById: userId },
    })
    if (collection.paymentMode === 'CASH') {
      const depositMode =
        collection.depositMode === 'UPI'
          ? 'UPI'
          : collection.depositMode === 'Bank Transfer'
            ? 'BANK_TRANSFER'
            : collection.depositMode === 'Cash Deposit'
              ? 'CASH_DEPOSIT'
              : null
      const hasDeposit = ['DEPOSITED', 'VERIFIED'].includes(collection.status)
      await transaction.bookingCashDeposit.create({
        data: {
          tenantId,
          collectionId: collection.id,
          amountCollected: collection.amount,
          depositedAmount: hasDeposit ? collection.amount : 0,
          receiverManagerName: collection.receiverName,
          status:
            collection.status === 'WITH_MANAGER'
              ? 'WITH_MANAGER'
              : collection.status === 'DEPOSITED'
                ? 'DEPOSITED'
                : collection.status === 'VERIFIED'
                  ? 'VERIFIED'
                  : 'COLLECTED',
          depositDate: collection.depositDate,
          depositMode,
          bankReference: collection.depositReferenceNumber,
          depositedByName: collection.depositedByName,
          verifiedAmount:
            collection.status === 'VERIFIED' ? collection.amount : null,
          verifiedById: collection.verifiedById,
          verifiedByName: collection.verifiedByName,
          verifiedAt: collection.verifiedAt,
          createdById: userId,
          updatedById: userId,
        },
      })
    }
    if (references.length)
      await transaction.accountReference.createMany({
        data: references.map((reference) => ({
          ...reference,
          tenantId,
          sourceId: collection.id,
          createdById: userId,
          updatedById: userId,
        })),
      })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'BOOKING_COLLECTION',
        action: 'CREATE',
        referenceId: collection.id,
        newValues: {
          bookingId,
          status: collection.status,
          paymentMode: collection.paymentMode,
          referenceNumber: collection.referenceNumber,
          depositReferenceNumber: collection.depositReferenceNumber,
        },
      },
    })
    return collection
  })
}

export function verifyCollection(
  tenantId: string,
  bookingId: string,
  collectionId: string,
  userId: string,
  verifiedByName: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.bookingCollection.findFirst({
      where: { tenantId, bookingId, id: collectionId },
      select: { status: true, verifiedByName: true, amount: true },
    })
    const updated = await transaction.bookingCollection.updateMany({
      where: {
        tenantId,
        bookingId,
        id: collectionId,
        status: { notIn: ['VERIFIED', 'VOID'] },
      },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedById: userId,
        verifiedByName,
      },
    })
    if (!updated.count) return null
    await transaction.bookingCashDeposit.updateMany({
      where: {
        tenantId,
        collectionId,
        status: 'DEPOSITED',
        deletedAt: null,
      },
      data: {
        status: 'VERIFIED',
        verifiedAmount: current?.amount ?? null,
        verifiedAt: new Date(),
        verifiedById: userId,
        verifiedByName,
        updatedById: userId,
      },
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'BOOKING_COLLECTION',
        action: 'VERIFY',
        referenceId: collectionId,
        ...(current ? { oldValues: current } : {}),
        newValues: { status: 'VERIFIED', verifiedByName },
      },
    })
    return transaction.bookingCollection.findUniqueOrThrow({
      where: { tenantId_id: { tenantId, id: collectionId } },
    })
  })
}

export function voidCollection(
  tenantId: string,
  bookingId: string,
  collectionId: string,
  userId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.bookingCollection.findFirst({
      where: { tenantId, bookingId, id: collectionId },
      select: { status: true },
    })
    const updated = await transaction.bookingCollection.updateMany({
      where: {
        tenantId,
        bookingId,
        id: collectionId,
        status: { not: 'VOID' },
      },
      data: {
        status: 'VOID',
        voidedAt: new Date(),
        voidedById: userId,
      },
    })
    if (!updated.count) return null
    await transaction.bookingCashDeposit.updateMany({
      where: { tenantId, collectionId, status: { not: 'VOID' } },
      data: {
        status: 'VOID',
        deletedAt: new Date(),
        deletedById: userId,
        updatedById: userId,
      },
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'BOOKING_COLLECTION',
        action: 'VOID',
        referenceId: collectionId,
        ...(current ? { oldValues: current } : {}),
        newValues: { status: 'VOID' },
      },
    })
    return true
  })
}
