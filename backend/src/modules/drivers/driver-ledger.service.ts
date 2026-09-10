import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/errors/app-error'
import { listDriverCollections } from '../accounts/accounts.repository'
import { mapCollection } from '../accounts/accounts.mapper'
import { mapDriver } from './driver.mapper'
import * as repository from './driver.repository'

export async function getDriverLedger(tenantId: string, driverId: string) {
  const driver = await repository.find(tenantId, driverId)
  if (!driver) throw new AppError('Driver was not found', 'NOT_FOUND', 404)
  const [records, transactions] = await Promise.all([
    listDriverCollections(tenantId, driverId),
    prisma.accountTransaction.findMany({
      where: { tenantId, driverId },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    }),
  ])
  const collections = records.map(mapCollection)
  const sumCollections = (
    field: 'amount' | 'fuelAmount' | 'returnedAmount' | 'driverBalance',
  ) =>
    Math.round(collections.reduce((sum, row) => sum + row[field], 0) * 100) /
    100
  const advances = transactions
    .filter((row) => row.transactionType === 'DRIVER_ADVANCE')
    .reduce((sum, row) => sum + Number(row.amount), 0)
  const recoveries = transactions
    .filter((row) => row.transactionType === 'DRIVER_RECOVERY')
    .reduce((sum, row) => sum + Number(row.amount), 0)
  return {
    driver: mapDriver(driver),
    summary: {
      customerPayments: sumCollections('amount'),
      fuelSpent: sumCollections('fuelAmount'),
      returnedToCompany: sumCollections('returnedAmount'),
      heldByDriver: sumCollections('driverBalance'),
      advances,
      recoveries,
      advanceBalance: Math.round((advances - recoveries) * 100) / 100,
    },
    collections,
    transactions: transactions.map((row) => ({
      id: row.id,
      date: row.transactionDate.toISOString().slice(0, 10),
      type: row.transactionType,
      category: row.category,
      amount: Number(row.amount),
      description: row.description,
      paymentMode: row.paymentMode,
      referenceNumber: row.referenceNumber,
    })),
  }
}
