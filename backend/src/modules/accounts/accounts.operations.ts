import type {
  AccountEntryDirection,
  AccountExpenseCategory,
  AccountPaymentMode,
  AccountReferenceSource,
  AccountTransactionType,
} from '../../generated/prisma/client'
import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/errors/app-error'
import type { PageRequest } from '../../shared/pagination'
import { pageWindow } from '../../shared/pagination'
import { normalizeReferenceNumber } from './accounts.service'

export interface TransactionInput {
  ledgerId: string
  transactionDate: Date
  transactionType: AccountTransactionType
  direction?: AccountEntryDirection
  category?: AccountExpenseCategory | null
  paymentMode: AccountPaymentMode
  amount: number
  description: string
  referenceNumber: string
  vehicleId?: string | null
  bookingId?: string | null
  driverId?: string | null
  employeeId?: string | null
  partnerId?: string | null
  details?: Prisma.InputJsonValue
  attachmentName?: string | null
  remarks?: string | null
}

const creditTypes = new Set<AccountTransactionType>(['DRIVER_RECOVERY'])
const sourceByType: Partial<
  Record<AccountTransactionType, AccountReferenceSource>
> = {
  EXPENSE: 'EXPENSE',
  ADJUSTMENT: 'ADJUSTMENT',
  FUND_RETURN: 'FUND_RETURN',
}

function directionFor(input: TransactionInput) {
  if (input.transactionType === 'ADJUSTMENT') {
    if (!input.direction)
      throw new AppError(
        'Adjustment direction is required',
        'VALIDATION_ERROR',
        400,
      )
    return input.direction
  }
  return creditTypes.has(input.transactionType) ? 'CREDIT' : 'DEBIT'
}

function validateCategory(input: TransactionInput) {
  if (input.transactionType === 'EXPENSE' && !input.category)
    throw new AppError('Expense category is required', 'VALIDATION_ERROR', 400)
  if (
    ['FUEL', 'VEHICLE_MAINTENANCE'].includes(input.category ?? '') &&
    !input.vehicleId
  )
    throw new AppError(
      'Vehicle is required for this expense category',
      'VALIDATION_ERROR',
      400,
    )
  if (input.category === 'DRIVER_PAYMENT' && !input.driverId)
    throw new AppError(
      'Driver is required for driver payment',
      'VALIDATION_ERROR',
      400,
    )
  if (input.category === 'RECOVERABLE_TRIP_CHARGE' && !input.bookingId)
    throw new AppError(
      'Booking is required for a recoverable trip charge',
      'VALIDATION_ERROR',
      400,
    )
}

async function validateLinks(tenantId: string, input: TransactionInput) {
  const [vehicle, booking, driver] = await Promise.all([
    input.vehicleId
      ? prisma.vehicle.findFirst({
          where: { tenantId, id: input.vehicleId, deletedAt: null },
          select: { id: true },
        })
      : null,
    input.bookingId
      ? prisma.booking.findFirst({
          where: { tenantId, id: input.bookingId, deletedAt: null },
          select: { id: true },
        })
      : null,
    input.driverId
      ? prisma.driver.findFirst({
          where: { tenantId, id: input.driverId, deletedAt: null },
          select: { id: true },
        })
      : null,
  ])
  if (input.vehicleId && !vehicle)
    throw new AppError('Vehicle was not found', 'NOT_FOUND', 404)
  if (input.bookingId && !booking)
    throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  if (input.driverId && !driver)
    throw new AppError('Driver was not found', 'NOT_FOUND', 404)
}

export async function listTransactions(
  tenantId: string,
  filters: {
    ledgerId?: string
    dateFrom?: Date
    dateTo?: Date
    search?: string
  } & PageRequest,
) {
  const where = {
    tenantId,
    ...(filters.ledgerId ? { ledgerId: filters.ledgerId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          transactionDate: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { description: { contains: filters.search, mode: 'insensitive' } },
            {
              referenceNumber: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.AccountTransactionWhereInput
  const [transactions, total, totals, options] = await Promise.all([
    prisma.accountTransaction.findMany({
      where,
      include: {
        ledger: {
          include: {
            manager: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      ...pageWindow(filters),
    }),
    prisma.accountTransaction.count({ where }),
    prisma.accountTransaction.groupBy({
      by: ['direction'],
      where,
      _sum: { amount: true },
    }),
    prisma.managerLedger.findMany({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
      include: {
        manager: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { manager: { name: 'asc' } },
    }),
  ])
  return {
    transactions: transactions.map((row) => ({
      ...row,
      amount: Number(row.amount),
      transactionDate: row.transactionDate.toISOString().slice(0, 10),
    })),
    ledgers: options.map((row) => ({
      id: row.id,
      manager: row.manager,
      location: row.location,
      currentBalance: Number(row.currentBalance),
    })),
    summary: {
      credits: Number(
        totals.find((row) => row.direction === 'CREDIT')?._sum.amount ?? 0,
      ),
      debits: Number(
        totals.find((row) => row.direction === 'DEBIT')?._sum.amount ?? 0,
      ),
    },
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.max(1, Math.ceil(total / filters.limit)),
      hasPrevious: filters.page > 1,
      hasNext: filters.page * filters.limit < total,
    },
  }
}

export async function createTransaction(
  tenantId: string,
  userId: string,
  input: TransactionInput,
) {
  validateCategory(input)
  await validateLinks(tenantId, input)
  const direction = directionFor(input)
  const referenceNumber = normalizeReferenceNumber(input.referenceNumber)
  try {
    await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM manager_ledgers
          WHERE tenant_id = ${tenantId}::uuid AND id = ${input.ledgerId}::uuid
            AND status = 'ACTIVE' AND deleted_at IS NULL
          FOR UPDATE`
        if (!locked.length)
          throw new AppError(
            'Active manager ledger was not found',
            'NOT_FOUND',
            404,
          )
        const ledger = await tx.managerLedger.findUniqueOrThrow({
          where: { tenantId_id: { tenantId, id: input.ledgerId } },
        })
        const before = Number(ledger.currentBalance)
        const after =
          before + (direction === 'CREDIT' ? input.amount : -input.amount)
        if (after < 0)
          throw new AppError(
            'Manager ledger has insufficient balance',
            'INSUFFICIENT_LEDGER_BALANCE',
            409,
          )
        const last = await tx.managerLedgerEntry.aggregate({
          where: { tenantId, ledgerId: input.ledgerId },
          _max: { entryNumber: true },
        })
        const entry = await tx.managerLedgerEntry.create({
          data: {
            tenantId,
            ledgerId: input.ledgerId,
            entryNumber: (last._max.entryNumber ?? 0) + 1,
            entryDate: input.transactionDate,
            entryType: input.transactionType,
            description: input.description.trim(),
            credit: direction === 'CREDIT' ? input.amount : 0,
            debit: direction === 'DEBIT' ? input.amount : 0,
            balanceBefore: before,
            runningBalance: after,
            referenceNumber,
            remarks: input.remarks?.trim() || null,
            createdById: userId,
          },
        })
        const record = await tx.accountTransaction.create({
          data: {
            tenantId,
            ledgerId: input.ledgerId,
            ledgerEntryId: entry.id,
            transactionDate: input.transactionDate,
            transactionType: input.transactionType,
            direction,
            category: input.category ?? null,
            paymentMode: input.paymentMode,
            amount: input.amount,
            description: input.description.trim(),
            referenceNumber,
            vehicleId: input.vehicleId ?? null,
            bookingId: input.bookingId ?? null,
            driverId: input.driverId ?? null,
            employeeId: input.employeeId ?? null,
            partnerId: input.partnerId ?? null,
            details: input.details ?? Prisma.JsonNull,
            attachmentName: input.attachmentName?.trim() || null,
            remarks: input.remarks?.trim() || null,
            createdById: userId,
          },
        })
        await tx.managerLedger.update({
          where: { tenantId_id: { tenantId, id: input.ledgerId } },
          data: {
            currentBalance: after,
            ...(direction === 'CREDIT'
              ? { totalCredits: { increment: input.amount } }
              : { totalDebits: { increment: input.amount } }),
            updatedById: userId,
          },
        })
        await tx.accountReference.create({
          data: {
            tenantId,
            referenceNumber,
            normalizedReferenceNumber: referenceNumber,
            source: sourceByType[input.transactionType] ?? 'EXPENSE',
            sourceId: record.id,
            createdById: userId,
            updatedById: userId,
          },
        })
        await tx.tenantAuditLog.create({
          data: {
            tenantId,
            actorUserId: userId,
            module: 'ACCOUNT_TRANSACTION',
            action: 'CREATE',
            referenceId: record.id,
            newValues: {
              ledgerId: input.ledgerId,
              transactionType: input.transactionType,
              direction,
              amount: input.amount,
              referenceNumber,
            },
          },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new AppError(
        'Reference number is already in use',
        'DUPLICATE_REFERENCE',
        409,
      )
    throw error
  }
  return listTransactions(tenantId, {
    ledgerId: input.ledgerId,
    page: 1,
    limit: 25,
  })
}

export async function getDailyClosing(
  tenantId: string,
  ledgerId: string,
  closingDate: Date,
) {
  const ledger = await prisma.managerLedger.findFirst({
    where: { tenantId, id: ledgerId, deletedAt: null },
    include: {
      manager: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
  })
  if (!ledger)
    throw new AppError('Manager ledger was not found', 'NOT_FOUND', 404)
  const nextDate = new Date(closingDate)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  const [entries, prior, deposits, closing] = await Promise.all([
    prisma.managerLedgerEntry.findMany({
      where: {
        tenantId,
        ledgerId,
        entryDate: { gte: closingDate, lt: nextDate },
      },
      orderBy: { entryNumber: 'asc' },
    }),
    prisma.managerLedgerEntry.findFirst({
      where: { tenantId, ledgerId, entryDate: { lt: closingDate } },
      orderBy: { entryNumber: 'desc' },
    }),
    prisma.bookingCashDeposit.findMany({
      where: {
        tenantId,
        receiverManagerId: ledger.managerId,
        collection: { collectionDate: { gte: closingDate, lt: nextDate } },
        status: { not: 'VOID' },
      },
      include: {
        collection: {
          include: { booking: { select: { bookingNumber: true } } },
        },
      },
    }),
    prisma.dailyClosing.findUnique({
      where: {
        tenantId_ledgerId_closingDate: { tenantId, ledgerId, closingDate },
      },
    }),
  ])
  const openingBalance = Number(prior?.runningBalance ?? ledger.openingBalance)
  const operationalEntries = entries.filter(
    (row) => row.entryType !== 'OPENING_BALANCE',
  )
  const credits = operationalEntries.reduce(
    (sum, row) => sum + Number(row.credit),
    0,
  )
  const debits = operationalEntries.reduce(
    (sum, row) => sum + Number(row.debit),
    0,
  )
  const pendingCashDeposit = deposits
    .filter((row) => row.status !== 'VERIFIED')
    .reduce((sum, row) => sum + Number(row.amountCollected), 0)
  return {
    ledger: {
      id: ledger.id,
      manager: ledger.manager,
      location: ledger.location,
    },
    date: closingDate.toISOString().slice(0, 10),
    openingBalance,
    credits,
    debits,
    closingBalance: openingBalance + credits - debits,
    pendingCashDeposit,
    status: closing?.status ?? 'OPEN',
    entries: entries.map((row) => ({
      ...row,
      credit: Number(row.credit),
      debit: Number(row.debit),
      runningBalance: Number(row.runningBalance),
      entryDate: row.entryDate.toISOString().slice(0, 10),
    })),
    deposits: deposits.map((row) => ({
      id: row.id,
      bookingNumber: row.collection.booking.bookingNumber,
      amountCollected: Number(row.amountCollected),
      depositedAmount: Number(row.depositedAmount),
      status: row.status,
      reference: row.bankReference,
    })),
  }
}

export async function setDailyClosingStatus(
  tenantId: string,
  userId: string,
  ledgerId: string,
  closingDate: Date,
  status: 'OPEN' | 'CLOSED',
  remarks?: string,
) {
  const snapshot = await getDailyClosing(tenantId, ledgerId, closingDate)
  await prisma.$transaction(async (tx) => {
    await tx.dailyClosing.upsert({
      where: {
        tenantId_ledgerId_closingDate: { tenantId, ledgerId, closingDate },
      },
      create: {
        tenantId,
        ledgerId,
        closingDate,
        openingBalance: snapshot.openingBalance,
        credits: snapshot.credits,
        debits: snapshot.debits,
        closingBalance: snapshot.closingBalance,
        pendingCashDeposit: snapshot.pendingCashDeposit,
        status,
        ...(status === 'CLOSED'
          ? { closedById: userId, closedAt: new Date() }
          : { reopenedById: userId, reopenedAt: new Date() }),
        remarks: remarks ?? null,
      },
      update: {
        openingBalance: snapshot.openingBalance,
        credits: snapshot.credits,
        debits: snapshot.debits,
        closingBalance: snapshot.closingBalance,
        pendingCashDeposit: snapshot.pendingCashDeposit,
        status,
        ...(status === 'CLOSED'
          ? { closedById: userId, closedAt: new Date() }
          : { reopenedById: userId, reopenedAt: new Date() }),
        remarks: remarks ?? null,
      },
    })
    await tx.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'DAILY_CLOSING',
        action: status === 'CLOSED' ? 'CLOSE' : 'REOPEN',
        referenceId: `${ledgerId}:${snapshot.date}`,
        newValues: { status, closingBalance: snapshot.closingBalance },
        remarks: remarks ?? null,
      },
    })
  })
  return getDailyClosing(tenantId, ledgerId, closingDate)
}

export async function getAudit(tenantId: string) {
  const [
    ledgers,
    deposits,
    transactions,
    resolutions,
    trail,
    driverCollections,
  ] = await Promise.all([
    prisma.managerLedger.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        manager: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    }),
    prisma.bookingCashDeposit.findMany({
      where: { tenantId, status: { not: 'VOID' } },
      include: {
        collection: {
          include: { booking: { select: { bookingNumber: true } } },
        },
      },
    }),
    prisma.accountTransaction.findMany({ where: { tenantId } }),
    prisma.accountAuditResolution.findMany({ where: { tenantId } }),
    prisma.tenantAuditLog.findMany({
      where: {
        tenantId,
        module: {
          in: [
            'ACCOUNT_TRANSACTION',
            'DAILY_CLOSING',
            'BOOKING_CASH_DEPOSIT',
            'BOOKING_COLLECTION',
            'MANAGER_LEDGER',
          ],
        },
      },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.bookingCollection.findMany({
      where: {
        tenantId,
        paymentHolder: 'DRIVER',
        status: { notIn: ['VOID', 'VERIFIED'] },
      },
      include: { booking: { select: { bookingNumber: true } } },
    }),
  ])
  const resolutionMap = new Map(
    resolutions.map((row) => [row.exceptionKey, row]),
  )
  const exceptions: Array<Record<string, unknown>> = []
  for (const collection of driverCollections) {
    const balance =
      Math.round(
        (Number(collection.amount) -
          Number(collection.fuelAmount) -
          Number(collection.returnedAmount)) *
          100,
      ) / 100
    exceptions.push({
      key: `DRIVER:${collection.id}`,
      type:
        balance > 0
          ? 'Driver Balance Pending'
          : 'Driver Settlement Not Verified',
      reference: `${collection.booking.bookingNumber} / ${collection.collectedByName}`,
      amount: balance,
      severity: 'MEDIUM',
      status: 'OPEN',
    })
  }
  for (const deposit of deposits) {
    if (!['VERIFIED'].includes(deposit.status)) {
      const key = `CASH:${deposit.id}`
      exceptions.push({
        key,
        type:
          deposit.status === 'MISMATCH'
            ? 'Cash Deposit Mismatch'
            : 'Cash Deposit Not Verified',
        reference: deposit.collection.booking.bookingNumber,
        amount:
          Number(deposit.amountCollected) -
          Number(deposit.verifiedAmount ?? deposit.depositedAmount),
        severity: deposit.status === 'MISMATCH' ? 'HIGH' : 'MEDIUM',
        status: resolutionMap.get(key)?.status ?? 'OPEN',
      })
    }
  }
  for (const ledger of ledgers) {
    if (Number(ledger.currentBalance) < 0) {
      const key = `LEDGER:${ledger.id}`
      exceptions.push({
        key,
        type: 'Negative Manager Balance',
        reference: ledger.manager.name,
        amount: Math.abs(Number(ledger.currentBalance)),
        severity: 'CRITICAL',
        status: resolutionMap.get(key)?.status ?? 'OPEN',
      })
    }
  }
  return {
    ledgers: ledgers.map((row) => ({
      id: row.id,
      manager: row.manager.name,
      location: row.location.name,
      openingBalance: Number(row.openingBalance),
      credits: Number(row.totalCredits),
      debits: Number(row.totalDebits),
      actualBalance: Number(row.currentBalance),
      expectedBalance:
        Number(row.openingBalance) +
        Number(row.totalCredits) -
        Number(row.totalDebits),
    })),
    deposits: deposits.map((row) => ({
      id: row.id,
      bookingNumber: row.collection.booking.bookingNumber,
      collected: Number(row.amountCollected),
      deposited: Number(row.depositedAmount),
      verified: Number(row.verifiedAmount ?? 0),
      status: row.status,
      reference: row.bankReference,
    })),
    exceptions,
    summary: {
      transactionCount: transactions.length,
      openExceptions: exceptions.filter((row) => row.status === 'OPEN').length,
    },
    trail: trail.map((row) => ({
      id: row.id,
      date: row.createdAt.toISOString(),
      user: row.actor?.name ?? 'System',
      action: row.action,
      module: row.module,
      reference: row.referenceId,
      remarks: row.remarks,
    })),
  }
}

export async function resolveAuditException(
  tenantId: string,
  userId: string,
  exceptionKey: string,
  resolution: string,
) {
  if (exceptionKey.startsWith('DRIVER:'))
    throw new AppError(
      'Receive the driver balance and verify the collection to resolve this exception',
      'DRIVER_SETTLEMENT_REQUIRED',
      409,
    )
  await prisma.accountAuditResolution.upsert({
    where: { tenantId_exceptionKey: { tenantId, exceptionKey } },
    create: {
      tenantId,
      exceptionKey,
      status: 'RESOLVED',
      resolution,
      resolvedById: userId,
      resolvedAt: new Date(),
    },
    update: {
      status: 'RESOLVED',
      resolution,
      resolvedById: userId,
      resolvedAt: new Date(),
    },
  })
  return getAudit(tenantId)
}
