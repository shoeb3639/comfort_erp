import { prisma } from '../../config/prisma'
import { tenantBusinessDate } from '../../shared/date/tenant-business-date'
import { cardRange } from './card-metrics'

type CustomerRow = {
  id: string
  name: string
  type: string
  amount: unknown
  total: unknown
}
export async function outstandingCustomers(tenantId: string, date?: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { timeZone: true },
  })
  const asOf = date ?? tenantBusinessDate(tenant.timeZone)
  const { until } = cardRange(asOf, asOf)
  const rows = await prisma.$queryRaw<CustomerRow[]>`
    WITH balances AS (
      SELECT c.id, c.name, c.type, SUM(GREATEST(0, i.net_payable - COALESCE(p.amount, 0))) AS amount
      FROM invoices i JOIN customers c ON c.id = i.customer_id AND c.tenant_id = i.tenant_id
      LEFT JOIN LATERAL (
        SELECT SUM(bc.amount) AS amount FROM booking_collections bc
        WHERE bc.tenant_id = i.tenant_id AND (bc.invoice_id = i.id OR (bc.invoice_id IS NULL AND bc.booking_id = i.booking_id))
        AND bc.collection_date < ${until}::date
        AND (bc.status <> 'VOID' OR bc.voided_at >= (${until}::date::timestamp AT TIME ZONE ${tenant.timeZone}))
      ) p ON true
      WHERE i.tenant_id = ${tenantId}::uuid AND i.invoice_date < ${until}::date
        AND (i.status <> 'CANCELLED' OR i.cancelled_at >= (${until}::date::timestamp AT TIME ZONE ${tenant.timeZone}))
      GROUP BY c.id, c.name, c.type
      HAVING SUM(GREATEST(0, i.net_payable - COALESCE(p.amount, 0))) > 0
    ), ranked AS (
      SELECT *, SUM(amount) OVER (PARTITION BY type) AS total,
        ROW_NUMBER() OVER (PARTITION BY type ORDER BY amount DESC, name, id) AS rank
      FROM balances
    ) SELECT id, name, type, amount, total FROM ranked WHERE rank <= 5 ORDER BY type, rank
  `
  return {
    asOf,
    groups: ['CORPORATE', 'RETAIL', 'TRAVEL_AGENT'].map((type) => {
      const customers = rows.filter((row) => row.type === type)
      return {
        type,
        total: Number(customers[0]?.total ?? 0),
        customers: customers.map((row) => ({
          id: row.id,
          name: row.name,
          amount: Number(row.amount),
        })),
      }
    }),
  }
}
