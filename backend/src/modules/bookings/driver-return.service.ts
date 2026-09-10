import { prisma } from '../../config/prisma'
import { Prisma } from '../../generated/prisma/client'
import { AppError } from '../../shared/errors/app-error'
import { normalizeReferenceNumber } from '../accounts/accounts.service'
import { driverBalance } from './driver-funds'
import { tenantBusinessDate } from '../../shared/date/tenant-business-date'

export interface DriverReturnInput {
  amount: number
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER'
  returnDate: Date
  referenceNumber: string
  remarks?: string | null
}

// Accounts records actual receipt into company cash/bank, never another customer payment.
export async function receiveDriverReturn(
  tenantId: string,
  userId: string,
  collectionId: string,
  input: DriverReturnInput,
) {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { timeZone: true },
  })
  if (
    input.returnDate.toISOString().slice(0, 10) >
    tenantBusinessDate(tenant.timeZone)
  )
    throw new AppError(
      'Return date cannot be in the future',
      'INVALID_RETURN_DATE',
      400,
    )
  try {
    return await prisma.$transaction(async (tx) => {
      const locked = await tx.bookingCollection.updateMany({
        where: {
          tenantId,
          id: collectionId,
          paymentHolder: 'DRIVER',
          status: { notIn: ['VOID', 'VERIFIED'] },
        },
        data: { updatedAt: new Date() },
      })
      if (!locked.count)
        throw new AppError(
          'Driver collection is not available for settlement',
          'DRIVER_COLLECTION_UNAVAILABLE',
          409,
        )
      const collection = await tx.bookingCollection.findUniqueOrThrow({
        where: { tenantId_id: { tenantId, id: collectionId } },
      })
      const balance = driverBalance(
        Number(collection.amount),
        Number(collection.fuelAmount),
        Number(collection.returnedAmount),
      )
      if (input.amount > balance)
        throw new AppError(
          'Return amount exceeds the balance held by the driver',
          'RETURN_EXCEEDS_BALANCE',
          409,
        )
      if (input.returnDate < collection.collectionDate)
        throw new AppError(
          'Return date cannot be before the customer payment date',
          'INVALID_RETURN_DATE',
          400,
        )
      await tx.accountReference.create({
        data: {
          tenantId,
          referenceNumber: input.referenceNumber.trim(),
          normalizedReferenceNumber: normalizeReferenceNumber(
            input.referenceNumber,
          ),
          source: 'FUND_RETURN',
          sourceId: collectionId,
          createdById: userId,
          updatedById: userId,
        },
      })
      await tx.bookingCollection.update({
        where: { tenantId_id: { tenantId, id: collectionId } },
        data: { returnedAmount: { increment: input.amount } },
      })
      await tx.tenantAuditLog.create({
        data: {
          tenantId,
          actorUserId: userId,
          module: 'BOOKING_COLLECTION',
          action: 'DRIVER_RETURN',
          referenceId: collectionId,
          oldValues: {
            returnedAmount: Number(collection.returnedAmount),
            driverBalance: balance,
          },
          newValues: {
            amount: input.amount,
            paymentMode: input.paymentMode,
            returnDate: input.returnDate.toISOString().slice(0, 10),
            referenceNumber: input.referenceNumber.trim(),
            returnedAmount: Number(collection.returnedAmount) + input.amount,
            driverBalance: driverBalance(balance, 0, input.amount),
          },
          remarks: input.remarks ?? null,
        },
      })
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new AppError(
        'Return reference is already in use; check the receipt history before retrying',
        'DUPLICATE_REFERENCE',
        409,
      )
    throw error
  }
}
