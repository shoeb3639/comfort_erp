import { Router } from 'express'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import {
  authorizeAnyPermission,
  authorizePermission,
} from '../../middlewares/authorize-permission.middleware'
import { checkSubscription } from '../../middlewares/check-subscription.middleware'
import { checkTenantStatus } from '../../middlewares/check-tenant-status.middleware'
import { resolveTenant } from '../../middlewares/resolve-tenant.middleware'
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validate-request.middleware'
import { ACCOUNT_PERMISSIONS } from './accounts.constants'
import * as controller from './accounts.controller'
import {
  cashDepositListQuerySchema,
  cashDepositParamsSchema,
  collectionListQuerySchema,
  collectionParamsSchema,
  depositCashSchema,
  createManagerLedgerSchema,
  createFundReleaseSchema,
  fundReleaseListQuerySchema,
  fundReleaseParamsSchema,
  managerLedgerListQuerySchema,
  managerLedgerParamsSchema,
  managerLedgerStatusSchema,
  receiveCashSchema,
  referenceValidationSchema,
  verifyCashSchema,
  transactionListQuerySchema,
  createTransactionSchema,
  dailyClosingQuerySchema,
  dailyClosingStatusSchema,
  auditResolutionSchema,
} from './accounts.schema'

export const accountsRouter = Router()

accountsRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription(),
  authorizeAnyPermission(ACCOUNT_PERMISSIONS),
)

accountsRouter.get('/foundation', controller.foundation)
accountsRouter.get(
  '/transactions',
  authorizePermission('accounts.expense.manage'),
  validateQuery(transactionListQuerySchema),
  controller.listTransactions,
)
accountsRouter.post(
  '/transactions',
  authorizePermission('accounts.expense.manage'),
  validateBody(createTransactionSchema),
  controller.createTransaction,
)
accountsRouter.get(
  '/daily-closing',
  authorizePermission('accounts.daily_closing.manage'),
  validateQuery(dailyClosingQuerySchema),
  controller.getDailyClosing,
)
accountsRouter.put(
  '/daily-closing',
  authorizePermission('accounts.daily_closing.manage'),
  validateBody(dailyClosingStatusSchema),
  controller.setDailyClosingStatus,
)
accountsRouter.get(
  '/audit',
  authorizePermission('accounts.audit.verify'),
  controller.getAudit,
)
accountsRouter.patch(
  '/audit/resolve',
  authorizePermission('accounts.audit.verify'),
  validateBody(auditResolutionSchema),
  controller.resolveAuditException,
)
accountsRouter.get(
  '/fund-releases',
  authorizePermission('accounts.fund.release'),
  validateQuery(fundReleaseListQuerySchema),
  controller.listFundReleases,
)
accountsRouter.post(
  '/fund-releases',
  authorizePermission('accounts.fund.release'),
  validateBody(createFundReleaseSchema),
  controller.createFundRelease,
)
accountsRouter.get(
  '/fund-releases/:releaseId',
  authorizePermission('accounts.fund.release'),
  validateParams(fundReleaseParamsSchema),
  controller.getFundRelease,
)
accountsRouter.get(
  '/manager-ledgers',
  authorizePermission('accounts.ledger.view'),
  validateQuery(managerLedgerListQuerySchema),
  controller.listManagerLedgers,
)
accountsRouter.post(
  '/manager-ledgers',
  authorizePermission('accounts.fund.release'),
  validateBody(createManagerLedgerSchema),
  controller.createManagerLedger,
)
accountsRouter.get(
  '/manager-ledgers/:ledgerId',
  authorizePermission('accounts.ledger.view'),
  validateParams(managerLedgerParamsSchema),
  controller.getManagerLedger,
)
accountsRouter.patch(
  '/manager-ledgers/:ledgerId/status',
  authorizePermission('accounts.fund.release'),
  validateParams(managerLedgerParamsSchema),
  validateBody(managerLedgerStatusSchema),
  controller.updateManagerLedgerStatus,
)
accountsRouter.get(
  '/cash-deposits',
  authorizePermission('accounts.deposit.manage'),
  validateQuery(cashDepositListQuerySchema),
  controller.listCashDeposits,
)
accountsRouter.get(
  '/cash-deposits/:depositId',
  authorizePermission('accounts.deposit.manage'),
  validateParams(cashDepositParamsSchema),
  controller.getCashDeposit,
)
accountsRouter.patch(
  '/cash-deposits/:depositId/receive',
  authorizePermission('accounts.deposit.manage'),
  validateParams(cashDepositParamsSchema),
  validateBody(receiveCashSchema),
  controller.receiveCashDeposit,
)
accountsRouter.patch(
  '/cash-deposits/:depositId/deposit',
  authorizePermission('accounts.deposit.manage'),
  validateParams(cashDepositParamsSchema),
  validateBody(depositCashSchema),
  controller.depositCash,
)
accountsRouter.patch(
  '/cash-deposits/:depositId/verify',
  authorizePermission('accounts.deposit.manage'),
  validateParams(cashDepositParamsSchema),
  validateBody(verifyCashSchema),
  controller.verifyCashDeposit,
)
accountsRouter.get(
  '/collections',
  authorizePermission('accounts.collection.view'),
  validateQuery(collectionListQuerySchema),
  controller.listCollections,
)
accountsRouter.get(
  '/collections/:collectionId',
  authorizePermission('accounts.collection.view'),
  validateParams(collectionParamsSchema),
  controller.getCollection,
)
accountsRouter.post(
  '/references/validate',
  validateBody(referenceValidationSchema),
  controller.validateReference,
)
