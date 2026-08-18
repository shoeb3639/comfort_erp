import type {
  CollectionPaymentMode,
  CollectionStatus,
} from '../../generated/prisma/client'
import { toTitleCase } from '../../shared/text/title-case'
import type * as repository from './accounts.repository'

function collectionStatusLabel(status: CollectionStatus) {
  return status.split('_').map(toTitleCase).join(' ')
}

function paymentModeLabel(mode: CollectionPaymentMode) {
  return mode.split('_').map(toTitleCase).join(' ')
}

export function mapCollection(
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

export function mapCashDeposit(
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

export function mapManagerLedger(
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

export function mapFundRelease(
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
