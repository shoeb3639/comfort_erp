import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
import { pageRequest } from '../../shared/pagination'
import * as service from './accounts.service'
import * as operations from './accounts.operations'
import {
  receiveDriverReturn,
  type DriverReturnInput,
} from '../bookings/driver-return.service'

export const recordDriverReturn: RequestHandler = async (request, response) => {
  const { tenantId, userId } = context(request)
  await receiveDriverReturn(
    tenantId,
    userId,
    String(request.params.collectionId),
    request.body as DriverReturnInput,
  )
  response.json({
    success: true,
    message: 'Driver return received',
    data: await service.getCollection(
      tenantId,
      String(request.params.collectionId),
    ),
  })
}
import type {
  CreateFundReleaseInput,
  CreateManagerLedgerInput,
} from './accounts.types'
import type {
  AccountPaymentMode,
  CashDepositMode,
  CashDepositStatus,
  CollectionPaymentMode,
  CollectionStatus,
} from '../../generated/prisma/client'

function context(request: Parameters<RequestHandler>[0]) {
  if (!request.auth?.tenantId || !request.tenant)
    throw new AppError('Tenant context is required', 'UNAUTHORIZED', 401)
  return {
    tenantId: request.auth.tenantId,
    userId: request.auth.userId,
    permissions: request.auth.permissions,
  }
}

export const foundation: RequestHandler = (request, response) => {
  const { permissions } = context(request)
  response.status(200).json({
    success: true,
    data: service.getFoundation(permissions),
    message: 'Accounts foundation retrieved',
  })
}

export const validateReference: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  response.status(200).json({
    success: true,
    data: await service.validateReference(
      tenantId,
      (request.body as { referenceNumber: string }).referenceNumber,
    ),
    message: 'Reference number validated',
  })
}

export const listTransactions: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  const ledgerId = queryValue(request, 'ledgerId')
  const dateFrom = queryValue(request, 'dateFrom')
  const dateTo = queryValue(request, 'dateTo')
  const search = queryValue(request, 'search')
  response.status(200).json({
    success: true,
    data: await operations.listTransactions(tenantId, {
      ...pageRequest(request.query),
      ...(ledgerId ? { ledgerId } : {}),
      ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
      ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
      ...(search ? { search } : {}),
    }),
    message: 'Account transactions retrieved',
  })
}

export const createTransaction: RequestHandler = async (request, response) => {
  const { tenantId, userId } = context(request)
  response.status(201).json({
    success: true,
    data: await operations.createTransaction(
      tenantId,
      userId,
      request.body as operations.TransactionInput,
    ),
    message: 'Account transaction posted',
  })
}

export const getDailyClosing: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  const ledgerId = queryValue(request, 'ledgerId')
  const date = queryValue(request, 'date')
  if (!ledgerId || !date)
    throw new AppError(
      'Ledger and closing date are required',
      'VALIDATION_ERROR',
      400,
    )
  response.status(200).json({
    success: true,
    data: await operations.getDailyClosing(tenantId, ledgerId, new Date(date)),
    message: 'Daily closing retrieved',
  })
}

export const setDailyClosingStatus: RequestHandler = async (
  request,
  response,
) => {
  const { tenantId, userId } = context(request)
  const body = request.body as {
    ledgerId: string
    date: Date
    status: 'OPEN' | 'CLOSED'
    remarks?: string
  }
  response.status(200).json({
    success: true,
    data: await operations.setDailyClosingStatus(
      tenantId,
      userId,
      body.ledgerId,
      new Date(body.date),
      body.status,
      body.remarks,
    ),
    message: `Day ${body.status === 'CLOSED' ? 'closed' : 'reopened'}`,
  })
}

export const getAudit: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  response.status(200).json({
    success: true,
    data: await operations.getAudit(tenantId),
    message: 'Accounts audit retrieved',
  })
}

export const resolveAuditException: RequestHandler = async (
  request,
  response,
) => {
  const { tenantId, userId } = context(request)
  const body = request.body as { exceptionKey: string; resolution: string }
  response.status(200).json({
    success: true,
    data: await operations.resolveAuditException(
      tenantId,
      userId,
      body.exceptionKey,
      body.resolution,
    ),
    message: 'Audit exception resolved',
  })
}

export const listCollections: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  const query = (name: string) => {
    const value = request.query[name]
    return typeof value === 'string' ? value : undefined
  }
  const dateFrom = query('dateFrom')
  const dateTo = query('dateTo')
  const paymentMode = query('paymentMode')
  const status = query('status')
  const booking = query('booking')
  const customerId = query('customerId')
  const search = query('search')
  response.status(200).json({
    success: true,
    data: await service.listCollections(tenantId, {
      ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
      ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
      ...(paymentMode
        ? { paymentMode: paymentMode as CollectionPaymentMode }
        : {}),
      ...(status ? { status: status as CollectionStatus } : {}),
      ...(booking ? { booking } : {}),
      ...(customerId ? { customerId } : {}),
      ...(search ? { search } : {}),
      page: Number(query('page') ?? 1),
      limit: Number(query('limit') ?? 50),
    }),
    message: 'Booking collections retrieved',
  })
}

export const getCollection: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  response.status(200).json({
    success: true,
    data: await service.getCollection(
      tenantId,
      String(request.params.collectionId),
    ),
    message: 'Booking collection retrieved',
  })
}

function queryValue(request: Parameters<RequestHandler>[0], name: string) {
  const value = request.query[name]
  return typeof value === 'string' ? value : undefined
}

export const listCashDeposits: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  const dateFrom = queryValue(request, 'dateFrom')
  const dateTo = queryValue(request, 'dateTo')
  const status = queryValue(request, 'status')
  const managerId = queryValue(request, 'managerId')
  const booking = queryValue(request, 'booking')
  const customerId = queryValue(request, 'customerId')
  const search = queryValue(request, 'search')
  response.status(200).json({
    success: true,
    data: await service.listCashDeposits(tenantId, {
      ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
      ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
      ...(status ? { status: status as CashDepositStatus } : {}),
      ...(managerId ? { managerId } : {}),
      ...(booking ? { booking } : {}),
      ...(customerId ? { customerId } : {}),
      ...(search ? { search } : {}),
      page: Number(queryValue(request, 'page') ?? 1),
      limit: Number(queryValue(request, 'limit') ?? 50),
    }),
    message: 'Booking cash deposits retrieved',
  })
}

export const getCashDeposit: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  response.status(200).json({
    success: true,
    data: await service.getCashDeposit(
      tenantId,
      String(request.params.depositId),
    ),
    message: 'Booking cash deposit retrieved',
  })
}

export const receiveCashDeposit: RequestHandler = async (request, response) => {
  const { tenantId, userId } = context(request)
  const body = request.body as {
    managerId: string
    remarks?: string | null
  }
  response.status(200).json({
    success: true,
    data: await service.receiveCashDeposit(
      tenantId,
      userId,
      String(request.params.depositId),
      body.managerId,
      body.remarks,
    ),
    message: 'Cash assigned to receiver manager',
  })
}

export const depositCash: RequestHandler = async (request, response) => {
  const { tenantId, userId } = context(request)
  const body = request.body as {
    depositedAmount: number
    depositDate: Date
    depositMode: CashDepositMode
    bankReference: string
    attachmentName?: string | null
    depositedBy: string
    remarks?: string | null
  }
  response.status(200).json({
    success: true,
    data: await service.depositCash(
      tenantId,
      userId,
      String(request.params.depositId),
      body,
    ),
    message: 'Customer cash deposit recorded',
  })
}

export const verifyCashDeposit: RequestHandler = async (request, response) => {
  const { tenantId, userId } = context(request)
  const body = request.body as {
    verifiedAmount: number
    verifiedBy: string
    mismatchReason?: string | null
    remarks?: string | null
  }
  response.status(200).json({
    success: true,
    data: await service.verifyCashDeposit(
      tenantId,
      userId,
      String(request.params.depositId),
      body,
    ),
    message: body.mismatchReason?.trim()
      ? 'Cash deposit mismatch recorded'
      : 'Cash deposit verified',
  })
}

export const listManagerLedgers: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  const search = queryValue(request, 'search')
  const status = queryValue(request, 'status')
  const managerId = queryValue(request, 'managerId')
  const locationId = queryValue(request, 'locationId')
  response.status(200).json({
    success: true,
    data: await service.listManagerLedgers(tenantId, {
      ...(search ? { search } : {}),
      ...(status ? { status: status as 'ACTIVE' | 'INACTIVE' } : {}),
      ...(managerId ? { managerId } : {}),
      ...(locationId ? { locationId } : {}),
    }),
    message: 'Manager ledgers retrieved',
  })
}

export const getManagerLedger: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  response.status(200).json({
    success: true,
    data: await service.getManagerLedger(
      tenantId,
      String(request.params.ledgerId),
    ),
    message: 'Manager ledger retrieved',
  })
}

export const createManagerLedger: RequestHandler = async (
  request,
  response,
) => {
  const { tenantId, userId } = context(request)
  const body = request.body as CreateManagerLedgerInput
  response.status(201).json({
    success: true,
    data: await service.createManagerLedger(tenantId, userId, body),
    message: 'Manager ledger created',
  })
}

export const updateManagerLedgerStatus: RequestHandler = async (
  request,
  response,
) => {
  const { tenantId, userId } = context(request)
  const body = request.body as {
    status: 'ACTIVE' | 'INACTIVE'
    reason: string
  }
  response.status(200).json({
    success: true,
    data: await service.updateManagerLedgerStatus(
      tenantId,
      userId,
      String(request.params.ledgerId),
      body.status,
      body.reason,
    ),
    message: `Manager ledger ${body.status.toLowerCase()}`,
  })
}

export const listFundReleases: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  const status = queryValue(request, 'status')
  const paymentMode = queryValue(request, 'paymentMode')
  const dateFrom = queryValue(request, 'dateFrom')
  const dateTo = queryValue(request, 'dateTo')
  const ledgerId = queryValue(request, 'ledgerId')
  const search = queryValue(request, 'search')
  response.status(200).json({
    success: true,
    data: await service.listFundReleases(tenantId, {
      ...(ledgerId ? { ledgerId } : {}),
      ...(status
        ? {
            status: status as 'PENDING' | 'APPROVED' | 'VERIFIED' | 'REJECTED',
          }
        : {}),
      ...(paymentMode
        ? { paymentMode: paymentMode as AccountPaymentMode }
        : {}),
      ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
      ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
      ...(search ? { search } : {}),
    }),
    message: 'Company fund releases retrieved',
  })
}

export const getFundRelease: RequestHandler = async (request, response) => {
  const { tenantId } = context(request)
  response.status(200).json({
    success: true,
    data: await service.getFundRelease(
      tenantId,
      String(request.params.releaseId),
    ),
    message: 'Company fund release retrieved',
  })
}

export const createFundRelease: RequestHandler = async (request, response) => {
  const { tenantId, userId } = context(request)
  const body = request.body as CreateFundReleaseInput
  response.status(201).json({
    success: true,
    data: await service.createFundRelease(tenantId, userId, body),
    message: 'Company fund released and manager ledger credited',
  })
}
