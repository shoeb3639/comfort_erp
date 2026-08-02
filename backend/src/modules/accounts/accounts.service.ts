import {
  AccountEntryDirection,
  AccountExpenseCategory,
  AccountPaymentMode,
  AccountReferenceSource,
  AccountTransactionType,
  Prisma,
} from '../../generated/prisma/client'
import type {
  CashDepositMode,
  CashDepositStatus,
  CollectionPaymentMode,
  CollectionStatus,
} from '../../generated/prisma/client'
import { AppError } from '../../shared/errors/app-error'
import { titleCaseOptional, toTitleCase } from '../../shared/text/title-case'
import { ACCOUNT_NAVIGATION, ACCOUNT_PERMISSIONS } from './accounts.constants'
import * as repository from './accounts.repository'

export interface CollectionQuery {
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

export interface CashDepositQuery {
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

export interface DepositCashInput {
  depositedAmount: number
  depositDate: Date
  depositMode: CashDepositMode
  bankReference: string
  attachmentName?: string | null
  depositedBy: string
  remarks?: string | null
}

export interface VerifyCashDepositInput {
  verifiedAmount: number
  verifiedBy: string
  mismatchReason?: string | null
  remarks?: string | null
}

export interface ManagerLedgerQuery {
  search?: string
  status?: 'ACTIVE' | 'INACTIVE'
  managerId?: string
  locationId?: string
}

export interface CreateManagerLedgerInput {
  managerId: string
  locationId: string
  openingBalance: number
  remarks?: string | null
}

export interface FundReleaseQuery {
  ledgerId?: string
  status?: 'PENDING' | 'APPROVED' | 'VERIFIED' | 'REJECTED'
  paymentMode?: AccountPaymentMode
  dateFrom?: Date
  dateTo?: Date
  search?: string
}

export interface CreateFundReleaseInput {
  ledgerId: string
  releaseDate: Date
  amount: number
  paymentMode: AccountPaymentMode
  referenceNumber: string
  description: string
  attachmentName?: string | null
  remarks?: string | null
}

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

function collectionStatusLabel(status: CollectionStatus) {
  return status.split('_').map(toTitleCase).join(' ')
}

function paymentModeLabel(mode: CollectionPaymentMode) {
  return mode.split('_').map(toTitleCase).join(' ')
}

function mapCollection(
  record: NonNullable<Awaited<ReturnType<typeof repository.findCollection>>>,
) {
  const invoice = record.invoice ?? record.booking.invoices[0] ?? null
  const billedAmount = Number(
    record.booking.closure?.totalBillAmount ?? invoice?.netPayable ?? 0,
  )
  return {
    id: record.id,
    receiptNumber: `COL-${record.createdAt.getUTCFullYear()}-${record.id.slice(0, 8).toUpperCase()}`,
    collectionDate: record.collectionDate.toISOString().slice(0, 10),
    amount: Number(record.amount),
    paymentMode: record.paymentMode,
    paymentModeLabel: paymentModeLabel(record.paymentMode),
    status: record.status,
    statusLabel: collectionStatusLabel(record.status),
    collectedBy: record.collectedByName,
    receiverName: record.receiverName,
    referenceNumber: record.referenceNumber,
    remarks: record.remarks,
    depositDate: record.depositDate?.toISOString().slice(0, 10) ?? null,
    depositMode: record.depositMode,
    depositReferenceNumber: record.depositReferenceNumber,
    depositedBy: record.depositedByName,
    verifiedBy: record.verifiedByName,
    verifiedAt: record.verifiedAt?.toISOString() ?? null,
    voidedAt: record.voidedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    booking: {
      id: record.booking.id,
      bookingId: record.booking.bookingNumber,
      totalBillAmount: billedAmount,
    },
    customer: {
      id: record.booking.customer.id,
      name: record.booking.customer.billingName,
      phone: record.booking.customer.phone,
      email: record.booking.customer.email,
      billingAddress: record.booking.customer.billingAddress,
    },
    invoice: invoice
      ? {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          netPayable: Number(invoice.netPayable),
        }
      : null,
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
  return {
    collections: records.map((record) => mapCollection(record)),
    bookingSummaries,
    summary: {
      totalBilled,
      totalCollected,
      outstandingBalance: Math.max(0, totalBilled - totalCollected),
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

function mapCashDeposit(
  record: NonNullable<Awaited<ReturnType<typeof repository.findCashDeposit>>>,
) {
  const booking = record.collection.booking
  return {
    id: record.id,
    trackingNumber: `DEP-${record.createdAt.getUTCFullYear()}-${record.id.slice(0, 8).toUpperCase()}`,
    status: record.status,
    statusLabel: record.status.split('_').map(toTitleCase).join(' '),
    amountCollected: Number(record.amountCollected),
    depositedAmount: Number(record.depositedAmount),
    verifiedAmount:
      record.verifiedAmount === null ? null : Number(record.verifiedAmount),
    pendingAmount: Math.max(
      0,
      Number(record.amountCollected) - Number(record.depositedAmount),
    ),
    mismatchAmount: Number(record.mismatchAmount),
    receiverManager: record.receiverManagerId
      ? {
          id: record.receiverManagerId,
          name: record.receiverManagerName,
        }
      : null,
    receivedAt: record.receivedAt?.toISOString() ?? null,
    depositDate: record.depositDate?.toISOString().slice(0, 10) ?? null,
    depositMode: record.depositMode,
    depositModeLabel: record.depositMode
      ? record.depositMode.split('_').map(toTitleCase).join(' ')
      : null,
    bankReference: record.bankReference,
    attachmentName: record.attachmentName,
    depositedBy: record.depositedByName,
    verifiedBy: record.verifiedByName,
    verifiedAt: record.verifiedAt?.toISOString() ?? null,
    mismatchReason: record.mismatchReason,
    remarks: record.remarks,
    collection: {
      id: record.collection.id,
      receiptNumber: `COL-${record.collection.createdAt.getUTCFullYear()}-${record.collection.id.slice(0, 8).toUpperCase()}`,
      collectionDate: record.collection.collectionDate
        .toISOString()
        .slice(0, 10),
      amount: Number(record.collection.amount),
      collectedBy: record.collection.collectedByName,
    },
    booking: {
      id: booking.id,
      bookingId: booking.bookingNumber,
    },
    customer: {
      id: booking.customer.id,
      name: booking.customer.billingName,
    },
    invoice: booking.invoices[0]
      ? {
          id: booking.invoices[0].id,
          invoiceNumber: booking.invoices[0].invoiceNumber,
        }
      : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
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

function mapManagerLedger(
  ledger: Awaited<ReturnType<typeof repository.listManagerLedgers>>[number],
) {
  return {
    id: ledger.id,
    manager: {
      id: ledger.manager.id,
      name: ledger.manager.name,
      email: ledger.manager.email,
      mobile: ledger.manager.mobile,
      role: ledger.manager.role.name,
      roleCode: ledger.manager.role.code,
    },
    location: {
      id: ledger.location.id,
      name: ledger.location.name,
      code: ledger.location.code,
      city: ledger.location.city,
      state: ledger.location.state,
    },
    openingBalance: Number(ledger.openingBalance),
    totalCredits: Number(ledger.totalCredits),
    totalDebits: Number(ledger.totalDebits),
    currentBalance: Number(ledger.currentBalance),
    status: ledger.status,
    remarks: ledger.remarks,
    entryCount: ledger._count.entries,
    createdAt: ledger.createdAt.toISOString(),
    updatedAt: ledger.updatedAt.toISOString(),
  }
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

function mapFundRelease(
  release: Awaited<ReturnType<typeof repository.listFundReleases>>[number],
) {
  return {
    id: release.id,
    releaseDate: release.releaseDate.toISOString().slice(0, 10),
    amount: Number(release.amount),
    paymentMode: release.paymentMode,
    referenceNumber: release.referenceNumber,
    description: release.description,
    attachmentName: release.attachmentName,
    status: release.status,
    remarks: release.remarks,
    ledgerEntryId: release.ledgerEntryId,
    ledger: {
      id: release.ledger.id,
      manager: release.ledger.manager,
      location: release.ledger.location,
      currentBalance: Number(release.ledger.currentBalance),
    },
    releasedBy: release.releasedBy,
    approvedBy: release.approvedBy,
    approvedAt: release.approvedAt?.toISOString() ?? null,
    verifiedBy: release.verifiedBy,
    verifiedAt: release.verifiedAt?.toISOString() ?? null,
    createdAt: release.createdAt.toISOString(),
  }
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
