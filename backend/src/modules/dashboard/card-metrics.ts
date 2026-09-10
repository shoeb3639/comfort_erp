import { prisma } from '../../config/prisma'
import { Prisma } from '../../generated/prisma/client'
import { AppError } from '../../shared/errors/app-error'

export const metricKeys = [
  'bookings',
  'revenue',
  'collections',
  'expenses',
  'profit',
  'pending',
  'cash',
  'manager',
] as const
export type MetricKey = (typeof metricKeys)[number]

export function cardRange(start: string, end: string) {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value &&
    value >= '1900-01-01' &&
    value <= '2100-12-31'
  if (!valid(start) || !valid(end) || start > end)
    throw new AppError(
      'Select a valid start and end date',
      'VALIDATION_ERROR',
      400,
    )
  return {
    start,
    end,
    until: new Date(Date.parse(end) + 86400000).toISOString().slice(0, 10),
  }
}

export async function cardMetric(
  tenantId: string,
  metric: MetricKey,
  start: string,
  end: string,
) {
  const { until } = cardRange(start, end)
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { timeZone: true },
  })
  const cutoff = Prisma.sql`(${until}::date::timestamp AT TIME ZONE ${tenant.timeZone})`
  let query: Prisma.Sql
  switch (metric) {
    case 'bookings':
      query = Prisma.sql`SELECT COUNT(*) AS value FROM bookings WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL AND status <> 'CANCELLED' AND start_date >= ${start}::date AND start_date < ${until}::date`
      break
    case 'revenue':
      query = Prisma.sql`SELECT SUM(net_payable) AS value FROM invoices WHERE tenant_id = ${tenantId}::uuid AND status <> 'CANCELLED' AND invoice_date >= ${start}::date AND invoice_date < ${until}::date`
      break
    case 'collections':
      query = Prisma.sql`SELECT SUM(amount) AS value FROM booking_collections WHERE tenant_id = ${tenantId}::uuid AND status <> 'VOID' AND collection_date >= ${start}::date AND collection_date < ${until}::date`
      break
    case 'expenses':
      query = Prisma.sql`SELECT (SELECT COALESCE(SUM(amount),0) FROM account_transactions WHERE tenant_id = ${tenantId}::uuid AND transaction_type = 'EXPENSE' AND direction = 'DEBIT' AND transaction_date >= ${start}::date AND transaction_date < ${until}::date) + (SELECT COALESCE(SUM(fuel_amount),0) FROM booking_collections WHERE tenant_id = ${tenantId}::uuid AND status <> 'VOID' AND collection_date >= ${start}::date AND collection_date < ${until}::date) AS value`
      break
    case 'profit':
      query = Prisma.sql`SELECT
        COALESCE(SUM(c.net_vehicle_profit) FILTER (WHERE b.assignment_source = 'OWN'), 0) AS "ownProfit",
        COALESCE(SUM(c.vendor_booking_profit) FILTER (WHERE b.assignment_source = 'VENDOR'), 0) AS "vendorProfit"
        FROM booking_closures c JOIN bookings b ON b.id = c.booking_id AND b.tenant_id = c.tenant_id
        WHERE c.tenant_id = ${tenantId}::uuid AND b.deleted_at IS NULL AND b.status = 'CLOSED'
          AND c.profit_data_status = 'AVAILABLE' AND b.start_date >= ${start}::date AND b.start_date < ${until}::date`
      break
    case 'pending':
      query = Prisma.sql`SELECT SUM(GREATEST(0, i.net_payable - COALESCE(p.amount, 0))) AS value FROM invoices i LEFT JOIN LATERAL (SELECT SUM(c.amount) AS amount FROM booking_collections c WHERE c.tenant_id = i.tenant_id AND (c.invoice_id = i.id OR (c.invoice_id IS NULL AND c.booking_id = i.booking_id)) AND c.collection_date < ${until}::date AND (c.status <> 'VOID' OR c.voided_at >= ${cutoff})) p ON true WHERE i.tenant_id = ${tenantId}::uuid AND i.invoice_date < ${until}::date AND (i.status <> 'CANCELLED' OR i.cancelled_at >= ${cutoff})`
      break
    case 'cash':
      query = Prisma.sql`SELECT SUM(GREATEST(0, c.amount - c.fuel_amount - c.returned_amount)) AS value FROM booking_collections c WHERE c.tenant_id = ${tenantId}::uuid AND c.payment_mode = 'CASH' AND c.status NOT IN ('VOID', 'VERIFIED', 'DIRECTLY_RECEIVED') AND c.collection_date >= ${start}::date AND c.collection_date < ${until}::date`
      break
    case 'manager':
      query = Prisma.sql`SELECT SUM(l.opening_balance + COALESCE(e.movement,0)) AS value FROM manager_ledgers l LEFT JOIN LATERAL (SELECT SUM(credit-debit) AS movement FROM manager_ledger_entries WHERE tenant_id = l.tenant_id AND ledger_id = l.id AND entry_date < ${until}::date AND entry_type <> 'OPENING_BALANCE') e ON true WHERE l.tenant_id = ${tenantId}::uuid AND l.created_at < ${cutoff} AND (l.deleted_at IS NULL OR l.deleted_at >= ${cutoff})`
      break
  }
  const rows =
    await prisma.$queryRaw<
      Array<{ value?: unknown; ownProfit?: unknown; vendorProfit?: unknown }>
    >(query)
  if (metric === 'profit') {
    const ownProfit = Number(rows[0]?.ownProfit ?? 0)
    const vendorProfit = Number(rows[0]?.vendorProfit ?? 0)
    return {
      metric,
      start,
      end,
      value: ownProfit + vendorProfit,
      ownProfit,
      vendorProfit,
    }
  }
  return { metric, start, end, value: Number(rows[0]?.value ?? 0) }
}
