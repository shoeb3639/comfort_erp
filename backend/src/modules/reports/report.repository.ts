import type { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'

export interface ReportFilters {
  dateFrom?: Date
  dateTo?: Date
  status?: string
  customerId?: string
  vendorId?: string
  vehicleId?: string
  assignmentSource?: 'OWN' | 'VENDOR'
  search?: string
  page: number
  limit: number
}

function dateRange(dateFrom?: Date, dateTo?: Date) {
  return {
    ...(dateFrom ? { gte: dateFrom } : {}),
    ...(dateTo ? { lte: dateTo } : {}),
  }
}

function bookingWhere(
  tenantId: string,
  filters: ReportFilters,
): Prisma.BookingWhereInput {
  return {
    tenantId,
    deletedAt: null,
    ...(filters.dateFrom || filters.dateTo
      ? { startDate: dateRange(filters.dateFrom, filters.dateTo) }
      : {}),
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
    ...(filters.assignmentSource
      ? { assignmentSource: filters.assignmentSource }
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
            {
              serviceCity: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  }
}

export async function bookings(tenantId: string, filters: ReportFilters) {
  const where = bookingWhere(tenantId, filters)
  const [rows, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      include: {
        customer: { select: { billingName: true } },
        vendor: { select: { name: true } },
        vehicle: { select: { registrationNumber: true } },
        driver: { select: { name: true } },
        closure: true,
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.booking.count({ where }),
  ])
  return { rows, total }
}

export async function invoices(tenantId: string, filters: ReportFilters) {
  const where: Prisma.InvoiceWhereInput = {
    tenantId,
    ...(filters.dateFrom || filters.dateTo
      ? { invoiceDate: dateRange(filters.dateFrom, filters.dateTo) }
      : {}),
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.search
      ? {
          OR: [
            {
              invoiceNumber: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
            {
              billingName: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
            {
              booking: {
                bookingNumber: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
            },
          ],
        }
      : {}),
  }
  const [rows, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: {
        booking: { select: { bookingNumber: true } },
        collections: { where: { status: { not: 'VOID' } } },
      },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.invoice.count({ where }),
  ])
  return { rows, total }
}

export async function expenses(tenantId: string, filters: ReportFilters) {
  const where: Prisma.AccountTransactionWhereInput = {
    tenantId,
    transactionType: 'EXPENSE',
    direction: 'DEBIT',
    ...(filters.dateFrom || filters.dateTo
      ? { transactionDate: dateRange(filters.dateFrom, filters.dateTo) }
      : {}),
    ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
    ...(filters.search
      ? {
          OR: [
            {
              description: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
            {
              referenceNumber: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  }
  const [rows, total] = await prisma.$transaction([
    prisma.accountTransaction.findMany({
      where,
      include: {
        ledger: {
          include: {
            manager: { select: { name: true } },
            location: { select: { name: true } },
          },
        },
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.accountTransaction.count({ where }),
  ])
  return { rows, total }
}

export async function vehicles(tenantId: string, filters: ReportFilters) {
  return prisma.vehicle.findMany({
    where: {
      tenantId,
      ownershipType: 'OWN',
      deletedAt: null,
      ...(filters.vehicleId ? { id: filters.vehicleId } : {}),
      ...(filters.search
        ? {
            registrationNumber: {
              contains: filters.search,
              mode: 'insensitive',
            },
          }
        : {}),
    },
    include: {
      vehicleType: { select: { name: true } },
      bookings: {
        where: {
          deletedAt: null,
          status: { not: 'CANCELLED' },
          ...(filters.dateFrom || filters.dateTo
            ? { startDate: dateRange(filters.dateFrom, filters.dateTo) }
            : {}),
        },
        include: { closure: true },
      },
    },
    orderBy: { registrationNumber: 'asc' },
  })
}

export function reportOptions(tenantId: string) {
  return Promise.all([
    prisma.customer.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, billingName: true },
      orderBy: { billingName: 'asc' },
    }),
    prisma.vendor.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.vehicle.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, registrationNumber: true, ownershipType: true },
      orderBy: { registrationNumber: 'asc' },
    }),
  ])
}
