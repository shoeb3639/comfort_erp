import Joi from 'joi'
import { paginationQueryFields } from '../../shared/pagination'

export const referenceValidationSchema = Joi.object({
  referenceNumber: Joi.string()
    .trim()
    .min(3)
    .max(150)
    .pattern(/^[A-Za-z0-9][A-Za-z0-9 /_.:-]*$/)
    .required()
    .messages({
      'string.pattern.base':
        'Reference number may contain letters, numbers, spaces, slash, underscore, period, colon, and hyphen',
    }),
})

export const collectionListQuerySchema = Joi.object({
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
  paymentMode: Joi.string().valid(
    'CASH',
    'UPI',
    'BANK_TRANSFER',
    'CARD',
    'CHEQUE',
  ),
  status: Joi.string().valid(
    'PENDING',
    'WITH_MANAGER',
    'DEPOSITED',
    'VERIFIED',
    'DIRECTLY_RECEIVED',
    'VOID',
  ),
  booking: Joi.string().trim().max(100),
  customerId: Joi.string().uuid(),
  search: Joi.string().trim().max(200),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
})

export const collectionParamsSchema = Joi.object({
  collectionId: Joi.string().uuid().required(),
})

export const cashDepositListQuerySchema = Joi.object({
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
  status: Joi.string().valid(
    'COLLECTED',
    'WITH_MANAGER',
    'DEPOSITED',
    'VERIFIED',
    'MISMATCH',
    'VOID',
  ),
  managerId: Joi.string().uuid(),
  booking: Joi.string().trim().max(100),
  customerId: Joi.string().uuid(),
  search: Joi.string().trim().max(200),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
})

export const cashDepositParamsSchema = Joi.object({
  depositId: Joi.string().uuid().required(),
})

export const receiveCashSchema = Joi.object({
  managerId: Joi.string().uuid().required(),
  remarks: Joi.string().trim().max(2000).allow('', null),
})

export const depositCashSchema = Joi.object({
  depositedAmount: Joi.number().precision(2).greater(0).required(),
  depositDate: Joi.date().iso().required(),
  depositMode: Joi.string()
    .valid('CASH_DEPOSIT', 'UPI', 'BANK_TRANSFER')
    .required(),
  bankReference: Joi.string()
    .trim()
    .min(3)
    .max(150)
    .pattern(/^[A-Za-z0-9][A-Za-z0-9 /_.:-]*$/)
    .required(),
  attachmentName: Joi.string().trim().max(255).allow('', null),
  depositedBy: Joi.string().trim().min(2).max(150).required(),
  remarks: Joi.string().trim().max(2000).allow('', null),
})

export const verifyCashSchema = Joi.object({
  verifiedAmount: Joi.number().precision(2).min(0).required(),
  verifiedBy: Joi.string().trim().min(2).max(150).required(),
  mismatchReason: Joi.string().trim().max(2000).allow('', null),
  remarks: Joi.string().trim().max(2000).allow('', null),
})

export const managerLedgerListQuerySchema = Joi.object({
  ...paginationQueryFields,
  search: Joi.string().trim().max(200),
  status: Joi.string().valid('ACTIVE', 'INACTIVE'),
  managerId: Joi.string().uuid(),
  locationId: Joi.string().uuid(),
})

export const managerLedgerParamsSchema = Joi.object({
  ledgerId: Joi.string().uuid().required(),
})

export const createManagerLedgerSchema = Joi.object({
  managerId: Joi.string().uuid().required(),
  locationId: Joi.string().uuid().required(),
  openingBalance: Joi.number().precision(2).min(0).required(),
  remarks: Joi.string().trim().max(2000).allow('', null),
})

export const managerLedgerStatusSchema = Joi.object({
  status: Joi.string().valid('ACTIVE', 'INACTIVE').required(),
  reason: Joi.string().trim().min(3).max(1000).required(),
})

export const fundReleaseListQuerySchema = Joi.object({
  ...paginationQueryFields,
  ledgerId: Joi.string().uuid(),
  status: Joi.string().valid('PENDING', 'APPROVED', 'VERIFIED', 'REJECTED'),
  paymentMode: Joi.string().valid(
    'CASH',
    'UPI',
    'BANK_TRANSFER',
    'CARD',
    'CHEQUE',
  ),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
  search: Joi.string().trim().max(200),
})

export const fundReleaseParamsSchema = Joi.object({
  releaseId: Joi.string().uuid().required(),
})

export const createFundReleaseSchema = Joi.object({
  ledgerId: Joi.string().uuid().required(),
  releaseDate: Joi.date().iso().required(),
  amount: Joi.number().precision(2).greater(0).required(),
  paymentMode: Joi.string()
    .valid('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE')
    .required(),
  referenceNumber: Joi.string()
    .trim()
    .min(3)
    .max(150)
    .pattern(/^[A-Za-z0-9][A-Za-z0-9 /_.:-]*$/)
    .required(),
  description: Joi.string().trim().min(3).max(500).required(),
  attachmentName: Joi.string().trim().max(255).allow('', null),
  remarks: Joi.string().trim().max(2000).allow('', null),
})

export const transactionListQuerySchema = Joi.object({
  ...paginationQueryFields,
  ledgerId: Joi.string().uuid(),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
  search: Joi.string().trim().max(200),
})

export const createTransactionSchema = Joi.object({
  ledgerId: Joi.string().uuid().required(),
  transactionDate: Joi.date().iso().required(),
  transactionType: Joi.string()
    .valid(
      'EXPENSE',
      'ADJUSTMENT',
      'FUND_RETURN',
      'DRIVER_ADVANCE',
      'DRIVER_RECOVERY',
      'PARTNER_WITHDRAWAL',
      'OWNER_WITHDRAWAL',
      'EMPLOYEE_ADVANCE',
    )
    .required(),
  direction: Joi.string().valid('CREDIT', 'DEBIT'),
  category: Joi.string()
    .valid(
      'FUEL',
      'VEHICLE_MAINTENANCE',
      'DRIVER_PAYMENT',
      'OFFICE_EXPENSE',
      'EMPLOYEE_ADVANCE',
      'PARTNER_OWNER_WITHDRAWAL',
      'RECOVERABLE_TRIP_CHARGE',
      'OTHER',
    )
    .allow(null),
  paymentMode: Joi.string()
    .valid('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE')
    .required(),
  amount: Joi.number().precision(2).greater(0).required(),
  description: Joi.string().trim().min(3).max(500).required(),
  referenceNumber: Joi.string().trim().min(3).max(150).required(),
  vehicleId: Joi.string().uuid().allow(null),
  bookingId: Joi.string().uuid().allow(null),
  driverId: Joi.string().uuid().allow(null),
  employeeId: Joi.string().uuid().allow(null),
  partnerId: Joi.string().uuid().allow(null),
  details: Joi.object().unknown(true),
  attachmentName: Joi.string().trim().max(255).allow('', null),
  remarks: Joi.string().trim().max(2000).allow('', null),
})

export const dailyClosingQuerySchema = Joi.object({
  ledgerId: Joi.string().uuid().required(),
  date: Joi.date().iso().required(),
})

export const dailyClosingStatusSchema = Joi.object({
  ledgerId: Joi.string().uuid().required(),
  date: Joi.date().iso().required(),
  status: Joi.string().valid('OPEN', 'CLOSED').required(),
  remarks: Joi.string().trim().max(2000).allow('', null),
})

export const auditResolutionSchema = Joi.object({
  exceptionKey: Joi.string().trim().min(3).max(255).required(),
  resolution: Joi.string().trim().min(3).max(2000).required(),
})
