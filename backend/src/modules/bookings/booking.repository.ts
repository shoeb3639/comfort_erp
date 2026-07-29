import type { BookingStatus, Prisma } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'

const include = {
  customer: true,
  traveller: true,
  vendor: true,
  vehicle: { include: { vehicleType: true } },
  driver: true,
  closure: true,
  collections: {
    where: { status: { not: 'VOID' as const } },
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
  filters: { search?: string; status?: string; view?: string },
) {
  return prisma.booking.findMany({
    where: {
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
    },
    include,
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  })
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
) {
  return prisma.$transaction(async (transaction) => {
    const collection = await transaction.bookingCollection.create({
      data: { ...data, tenantId, bookingId, recordedById: userId },
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'BOOKING_COLLECTION',
        action: 'CREATE',
        referenceId: collection.id,
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
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'BOOKING_COLLECTION',
        action: 'VERIFY',
        referenceId: collectionId,
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
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'BOOKING_COLLECTION',
        action: 'VOID',
        referenceId: collectionId,
      },
    })
    return true
  })
}
