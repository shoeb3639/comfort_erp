import {
  AccountEntryDirection,
  AccountExpenseCategory,
  AccountPaymentMode,
  AccountReferenceSource,
  AccountTransactionType,
  Prisma,
} from '../../generated/prisma/client'
import type { CashDepositStatus } from '../../generated/prisma/client'
import { AppError } from '../../shared/errors/app-error'
import { titleCaseOptional, toTitleCase } from '../../shared/text/title-case'
import { ACCOUNT_NAVIGATION, ACCOUNT_PERMISSIONS } from './accounts.constants'
import {
  mapCashDeposit,
  mapCollection,
  mapFundRelease,
  mapManagerLedger,
} from './accounts.mapper'
import * as repository from './accounts.repository'
import type {
  CashDepositQuery,
  CollectionQuery,
  CreateFundReleaseInput,
  CreateManagerLedgerInput,
  DepositCashInput,
  FundReleaseQuery,
  ManagerLedgerQuery,
  VerifyCashDepositInput,
} from './accounts.types'

export function normalizeReferenceNumber(referenceNumber: string) {
  return referenceNumber.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function getFoundation(userPermissions: string[]) {
  const permissionSet = new Set(userPermissions)
  return {
    permissions: ACCOUNT_PERMISSIONS.filter((permission) =>
      permissionSet.has(permission),
    ),
    navigation: ACCOUNT_NAVIGATION.filter((item) =>
      item.permissions.some((permission) => permissionSet.has(permission)),
    ).map(({ permissions: _permissions, ...item }) => item),
    enums: {
      transactionTypes: Object.values(AccountTransactionType),
      paymentModes: Object.values(AccountPaymentMode),
      entryDirections: Object.values(AccountEntryDirection),
      expenseCategories: Object.values(AccountExpenseCategory),
      referenceSources: Object.values(AccountReferenceSource),
    },
    policies: {
      customerCollectionsSeparateFromManagerLedger: true,
      tenantIdFromAuthenticatedContext: true,
      referenceNumbersUniqueWithinTenant: true,
      financialRecordsUseSoftDelete: true,
      auditFieldsRequired: [
        'createdById',
        'createdAt',
        'updatedById',
        'updatedAt',
        'deletedById',
        'deletedAt',
      ],
    },
  }
}

export async function validateReference(
  tenantId: string,
  referenceNumber: string,
) {
  const normalizedReferenceNumber = normalizeReferenceNumber(referenceNumber)
  const usage = await repository.findReferenceUsage(
    tenantId,
    normalizedReferenceNumber,
  )
  return {
    referenceNumber: referenceNumber.trim(),
    normalizedReferenceNumber,
    available: !usage,
    usage,
  }
}

function paymentStatus(totalBillAmount: number, totalCollected: number) {
  if (totalCollected <= 0) return 'UNPAID'
  if (totalCollected < totalBillAmount) return 'PARTIALLY_PAID'
  return 'PAID'
}

export async function listCollections(
  tenantId: string,
  filters: CollectionQuery,
) {
  const [{ records, total }, bookings, options] = await Promise.all([
    repository.listCollections(tenantId, filters),
    repository.listBookingBalances(tenantId, filters),
    repository.collectionFilterOptions(tenantId),
  ])
  const bookingSummaries = bookings.map((booking) => {
    const totalBillAmount = Number(booking.closure?.totalBillAmount ?? 0)
    const totalCollected = booking.collections.reduce(
      (sum, collection) => sum + Number(collection.amount),
      0,
    )
    const balance = Math.max(0, totalBillAmount - totalCollected)
    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      customerName: booking.customer.billingName,
      invoiceId: booking.invoices[0]?.id ?? null,
      invoiceNumber: booking.invoices[0]?.invoiceNumber ?? null,
      totalBillAmount,
      totalCollected,
      balance,
      driverBalance: booking.collections
        .filter((row) => row.paymentHolder === 'DRIVER')
        .reduce(
          (sum, row) =>
            sum +
            Number(row.amount) -
            Number(row.fuelAmount) -
            Number(row.returnedAmount),
          0,
        ),
      fuelFromCollections: booking.collections.reduce(
        (sum, row) => sum + Number(row.fuelAmount),
        0,
      ),
      driverReturns: booking.collections.reduce(
        (sum, row) => sum + Number(row.returnedAmount),
        0,
      ),
      paymentStatus: paymentStatus(totalBillAmount, totalCollected),
      closedAt: booking.closure?.closedAt.toISOString() ?? null,
    }
  })
  const totalBilled = bookingSummaries.reduce(
    (sum, booking) => sum + booking.totalBillAmount,
    0,
  )
  const totalCollected = bookingSummaries.reduce(
    (sum, booking) => sum + booking.totalCollected,
    0,
  )
  const drivers = new Map<
    string,
    {
      id: string
      name: string
      collected: number
      fuel: number
      returned: number
      balance: number
    }
  >()
  for (const booking of bookings)
    for (const row of booking.collections) {
      if (row.paymentHolder !== 'DRIVER') continue
      const key = row.custodianDriverId ?? row.collectedByName.toLowerCase()
      const driver = drivers.get(key) ?? {
        id: key,
        name: row.collectedByName,
        collected: 0,
        fuel: 0,
        returned: 0,
        balance: 0,
      }
      driver.collected += Number(row.amount)
      driver.fuel += Number(row.fuelAmount)
      driver.returned += Number(row.returnedAmount)
      driver.balance =
        Math.round((driver.collected - driver.fuel - driver.returned) * 100) /
        100
      drivers.set(key, driver)
    }
  return {
    driverSummaries: [...drivers.values()],
    collections: records.map((record) => mapCollection(record)),
    bookingSummaries,
    summary: {
      totalBilled,
      totalCollected,
      outstandingBalance: Math.max(0, totalBilled - totalCollected),
      driverBalance: bookingSummaries.reduce(
        (sum, row) => sum + row.driverBalance,
        0,
      ),
      fuelFromCollections: bookingSummaries.reduce(
        (sum, row) => sum + row.fuelFromCollections,
        0,
      ),
      driverReturns: bookingSummaries.reduce(
        (sum, row) => sum + row.driverReturns,
        0,
      ),
      paidBookings: bookingSummaries.filter(
        (booking) => booking.paymentStatus === 'PAID',
      ).length,
      partiallyPaidBookings: bookingSummaries.filter(
        (booking) => booking.paymentStatus === 'PARTIALLY_PAID',
      ).length,
      unpaidBookings: bookingSummaries.filter(
        (booking) => booking.paymentStatus === 'UNPAID',
      ).length,
    },
    filters: {
      customers: options[0].map((customer) => ({
        id: customer.id,
        name: customer.billingName,
      })),
      bookings: options[1].map((booking) => ({
        id: booking.id,
        bookingId: booking.bookingNumber,
        customerName: booking.customer.billingName,
      })),
    },
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  }
}

export async function getCollection(tenantId: string, collectionId: string) {
  const [record, auditTrail] = await Promise.all([
    repository.findCollection(tenantId, collectionId),
    repository.collectionAuditTrail(tenantId, collectionId),
  ])
  if (!record) throw new AppError('Collection was not found', 'NOT_FOUND', 404)
  return {
    ...mapCollection(record),
    auditTrail: auditTrail.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actor: entry.actor
        ? {
            id: entry.actor.id,
            name: entry.actor.name,
            email: entry.actor.email,
          }
        : null,
      oldValues: entry.oldValues,
      newValues: entry.newValues,
      remarks: entry.remarks,
      createdAt: entry.createdAt.toISOString(),
    })),
  }
}

export async function listCashDeposits(
  tenantId: string,
  filters: CashDepositQuery,
) {
  const [{ records, total, aggregate, statusGroups }, options] =
    await Promise.all([
      repository.listCashDeposits(tenantId, filters),
      repository.cashDepositFilterOptions(tenantId),
    ])
  const group = (status: CashDepositStatus) =>
    statusGroups.find((row) => row.status === status)?._sum
  const totalCashCollected = Number(aggregate._sum.amountCollected ?? 0)
  const depositedAmount = Number(aggregate._sum.depositedAmount ?? 0)
  return {
    deposits: records.map((record) => mapCashDeposit(record)),
    summary: {
      totalCashCollected,
      cashWithManager: Number(group('WITH_MANAGER')?.amountCollected ?? 0),
      depositedAmount,
      verifiedAmount: Number(group('VERIFIED')?.verifiedAmount ?? 0),
      pendingDeposit: Math.max(0, totalCashCollected - depositedAmount),
      mismatchAmount: Number(aggregate._sum.mismatchAmount ?? 0),
    },
    filters: {
      managers: options[0].map((manager) => ({
        id: manager.id,
        name: manager.name,
        role: manager.role.name,
      })),
      customers: options[1].map((customer) => ({
        id: customer.id,
        name: customer.billingName,
      })),
    },
    policies: {
      customerCashAffectsManagerLedger: false,
      depositedAmountCannotExceedCollectedCash: true,
    },
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  }
}

export async function getCashDeposit(tenantId: string, depositId: string) {
  const [record, auditTrail] = await Promise.all([
    repository.findCashDeposit(tenantId, depositId),
    repository.cashDepositAuditTrail(tenantId, depositId),
  ])
  if (!record)
    throw new AppError('Cash deposit was not found', 'NOT_FOUND', 404)
  return {
    ...mapCashDeposit(record),
    auditTrail: auditTrail.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actor: entry.actor
        ? {
            id: entry.actor.id,
            name: entry.actor.name,
            email: entry.actor.email,
          }
        : null,
      oldValues: entry.oldValues,
      newValues: entry.newValues,
      remarks: entry.remarks,
      createdAt: entry.createdAt.toISOString(),
    })),
  }
}

export async function receiveCashDeposit(
  tenantId: string,
  userId: string,
  depositId: string,
  managerId: string,
  remarks?: string | null,
) {
  const manager = await repository.findTenantManager(tenantId, managerId)
  if (!manager)
    throw new AppError(
      'Receiver manager was not found in this tenant',
      'MANAGER_NOT_FOUND',
      404,
    )
  const updated = await repository.receiveCashDeposit(
    tenantId,
    depositId,
    manager,
    userId,
    titleCaseOptional(remarks) ?? null,
  )
  if (!updated)
    throw new AppError(
      'Only newly collected cash can be assigned to a manager',
      'INVALID_CASH_DEPOSIT_TRANSITION',
      409,
    )
  return getCashDeposit(tenantId, depositId)
}

export async function depositCash(
  tenantId: string,
  userId: string,
  depositId: string,
  input: DepositCashInput,
) {
  const current = await repository.findCashDeposit(tenantId, depositId)
  if (!current)
    throw new AppError('Cash deposit was not found', 'NOT_FOUND', 404)
  if (input.depositedAmount > Number(current.amountCollected))
    throw new AppError(
      'Deposited amount cannot exceed collected cash',
      'DEPOSIT_EXCEEDS_CASH',
      409,
    )
  const reference = await validateReference(tenantId, input.bankReference)
  if (!reference.available)
    throw new AppError(
      'Bank reference number is already in use',
      'DUPLICATE_REFERENCE',
      409,
    )
  try {
    const updated = await repository.depositCash(tenantId, depositId, userId, {
      depositedAmount: input.depositedAmount,
      depositDate: input.depositDate,
      depositMode: input.depositMode,
      bankReference: input.bankReference.trim(),
      normalizedBankReference: normalizeReferenceNumber(input.bankReference),
      attachmentName: input.attachmentName?.trim() || null,
      depositedByName: toTitleCase(input.depositedBy),
      remarks: titleCaseOptional(input.remarks) ?? null,
    })
    if (!updated)
      throw new AppError(
        'Cash is not available for deposit in its current status',
        'INVALID_CASH_DEPOSIT_TRANSITION',
        409,
      )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new AppError(
        'Bank reference number is already in use',
        'DUPLICATE_REFERENCE',
        409,
      )
    throw error
  }
  return getCashDeposit(tenantId, depositId)
}

export async function verifyCashDeposit(
  tenantId: string,
  userId: string,
  depositId: string,
  input: VerifyCashDepositInput,
) {
  const current = await repository.findCashDeposit(tenantId, depositId)
  if (!current)
    throw new AppError('Cash deposit was not found', 'NOT_FOUND', 404)
  if (input.verifiedAmount > Number(current.depositedAmount))
    throw new AppError(
      'Verified bank amount cannot exceed the deposited amount',
      'VERIFICATION_EXCEEDS_DEPOSIT',
      409,
    )
  const mismatch = input.verifiedAmount !== Number(current.amountCollected)
  if (mismatch && !input.mismatchReason?.trim())
    throw new AppError(
      'Mismatch reason is required when bank amount differs from collected cash',
      'MISMATCH_REASON_REQUIRED',
      400,
    )
  const updated = await repository.verifyCashDeposit(
    tenantId,
    depositId,
    userId,
    {
      verifiedAmount: input.verifiedAmount,
      verifiedByName: toTitleCase(input.verifiedBy),
      mismatchReason: titleCaseOptional(input.mismatchReason) ?? null,
      remarks: titleCaseOptional(input.remarks) ?? null,
    },
  )
  if (!updated)
    throw new AppError(
      'Only deposited cash can be verified',
      'INVALID_CASH_DEPOSIT_TRANSITION',
      409,
    )
  return getCashDeposit(tenantId, depositId)
}

export async function listManagerLedgers(
  tenantId: string,
  filters: ManagerLedgerQuery,
) {
  const [records, options] = await Promise.all([
    repository.listManagerLedgers(tenantId, filters),
    repository.managerLedgerOptions(tenantId),
  ])
  const ledgers = records.map(mapManagerLedger)
  return {
    ledgers,
    summary: {
      totalLedgers: ledgers.length,
      activeLedgers: ledgers.filter((ledger) => ledger.status === 'ACTIVE')
        .length,
      openingBalance: ledgers.reduce(
        (sum, ledger) => sum + ledger.openingBalance,
        0,
      ),
      totalCredits: ledgers.reduce(
        (sum, ledger) => sum + ledger.totalCredits,
        0,
      ),
      totalDebits: ledgers.reduce((sum, ledger) => sum + ledger.totalDebits, 0),
      currentBalance: ledgers.reduce(
        (sum, ledger) => sum + ledger.currentBalance,
        0,
      ),
    },
    filters: {
      managers: options[0].map((manager) => ({
        id: manager.id,
        name: manager.name,
        email: manager.email,
        role: manager.role.name,
        roleCode: manager.role.code,
      })),
      locations: options[1],
    },
    formula: 'Opening Balance + Credits - Debits = Current Balance',
  }
}

export async function getManagerLedger(tenantId: string, ledgerId: string) {
  const [record, auditTrail] = await Promise.all([
    repository.findManagerLedger(tenantId, ledgerId),
    repository.managerLedgerAuditTrail(tenantId, ledgerId),
  ])
  if (!record)
    throw new AppError('Manager ledger was not found', 'NOT_FOUND', 404)
  return {
    ...mapManagerLedger(record),
    formula: 'Opening Balance + Credits - Debits = Current Balance',
    entries: record.entries.map((entry) => ({
      id: entry.id,
      entryNumber: entry.entryNumber,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      entryType: entry.entryType,
      entryTypeLabel: entry.entryType.split('_').map(toTitleCase).join(' '),
      description: entry.description,
      credit: Number(entry.credit),
      debit: Number(entry.debit),
      balanceBefore: Number(entry.balanceBefore),
      runningBalance: Number(entry.runningBalance),
      referenceNumber: entry.referenceNumber,
      sourceId: entry.sourceId,
      remarks: entry.remarks,
      createdAt: entry.createdAt.toISOString(),
    })),
    auditTrail: auditTrail.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actor: entry.actor
        ? {
            id: entry.actor.id,
            name: entry.actor.name,
            email: entry.actor.email,
          }
        : null,
      oldValues: entry.oldValues,
      newValues: entry.newValues,
      remarks: entry.remarks,
      createdAt: entry.createdAt.toISOString(),
    })),
  }
}

export async function createManagerLedger(
  tenantId: string,
  userId: string,
  input: CreateManagerLedgerInput,
) {
  const [manager, location] = await Promise.all([
    repository.findTenantManager(tenantId, input.managerId),
    repository.findActiveLocation(tenantId, input.locationId),
  ])
  if (!manager)
    throw new AppError(
      'Active manager was not found in this tenant',
      'MANAGER_NOT_FOUND',
      404,
    )
  if (!location)
    throw new AppError(
      'Active location was not found in this tenant',
      'LOCATION_NOT_FOUND',
      404,
    )
  try {
    const ledger = await repository.createManagerLedger(tenantId, userId, {
      managerId: manager.id,
      locationId: location.id,
      openingBalance: input.openingBalance,
      remarks: titleCaseOptional(input.remarks) ?? null,
    })
    return getManagerLedger(tenantId, ledger.id)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new AppError(
        'A ledger already exists for this manager and location',
        'MANAGER_LEDGER_EXISTS',
        409,
      )
    throw error
  }
}

export async function updateManagerLedgerStatus(
  tenantId: string,
  userId: string,
  ledgerId: string,
  status: 'ACTIVE' | 'INACTIVE',
  reason: string,
) {
  const updated = await repository.updateManagerLedgerStatus(
    tenantId,
    ledgerId,
    userId,
    status,
    toTitleCase(reason),
  )
  if (!updated)
    throw new AppError('Manager ledger was not found', 'NOT_FOUND', 404)
  return getManagerLedger(tenantId, ledgerId)
}

export async function listFundReleases(
  tenantId: string,
  filters: FundReleaseQuery,
) {
  const [records, ledgers] = await Promise.all([
    repository.listFundReleases(tenantId, filters),
    repository.listManagerLedgers(tenantId, { status: 'ACTIVE' }),
  ])
  const releases = records.map(mapFundRelease)
  return {
    releases,
    summary: {
      totalReleases: releases.length,
      totalAmount: releases.reduce((sum, release) => sum + release.amount, 0),
      verifiedAmount: releases
        .filter((release) => release.status === 'VERIFIED')
        .reduce((sum, release) => sum + release.amount, 0),
      pendingCount: releases.filter((release) =>
        ['PENDING', 'APPROVED'].includes(release.status),
      ).length,
    },
    ledgers: ledgers.map(mapManagerLedger),
  }
}

export async function getFundRelease(tenantId: string, releaseId: string) {
  const [release, auditTrail] = await Promise.all([
    repository.findFundRelease(tenantId, releaseId),
    repository.fundReleaseAuditTrail(tenantId, releaseId),
  ])
  if (!release)
    throw new AppError('Fund release was not found', 'NOT_FOUND', 404)
  return {
    ...mapFundRelease(release),
    auditTrail: auditTrail.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actor: entry.actor,
      newValues: entry.newValues,
      remarks: entry.remarks,
      createdAt: entry.createdAt.toISOString(),
    })),
  }
}

export async function createFundRelease(
  tenantId: string,
  userId: string,
  input: CreateFundReleaseInput,
) {
  const referenceNumber = normalizeReferenceNumber(input.referenceNumber)
  if (await repository.findReferenceUsage(tenantId, referenceNumber))
    throw new AppError(
      'Transaction reference is already in use',
      'DUPLICATE_REFERENCE',
      409,
    )
  const normalized = {
    ...input,
    referenceNumber,
    description: toTitleCase(input.description),
    attachmentName: input.attachmentName?.trim() || null,
    remarks: titleCaseOptional(input.remarks) ?? null,
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const releaseId = await repository.createAndPostFundRelease(
        tenantId,
        userId,
        normalized,
      )
      if (!releaseId)
        throw new AppError(
          'Active manager ledger was not found',
          'MANAGER_LEDGER_NOT_FOUND',
          404,
        )
      return getFundRelease(tenantId, releaseId)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new AppError(
          'Transaction reference is already in use',
          'DUPLICATE_REFERENCE',
          409,
        )
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      )
        continue
      throw error
    }
  }
  throw new AppError('Fund release could not be posted', 'POSTING_FAILED', 409)
}
