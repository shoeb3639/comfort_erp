import { cardRange } from './card-metrics'
import { tenantBusinessDate } from '../../shared/date/tenant-business-date'
import { prisma } from '../../config/prisma'

type Row = {
  id: string
  vehicle: string
  revenue: unknown
  fuelCost: unknown
  maintenance: unknown
  driverCost: unknown
  otherCost: unknown
  vendorCost: unknown
  extraCost: unknown
  netProfit: unknown
  profitPercent: unknown
  excluded: number
}
export async function vehiclePerformance(
  tenantId: string,
  ownership: 'OWN' | 'VENDOR' = 'OWN',
  start?: string,
  end?: string,
) {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { timeZone: true },
  })
  const today = tenantBusinessDate(tenant.timeZone)
  const range = cardRange(start ?? `${today.slice(0, 7)}-01`, end ?? today)
  const rows = await prisma.$queryRaw<Row[]>`
    WITH bookings_by_vehicle AS (
      SELECT b.vehicle_id, COUNT(*) FILTER (WHERE c.profit_data_status <> 'AVAILABLE')::int AS excluded,
        COUNT(*) FILTER (WHERE c.profit_data_status = 'AVAILABLE')::int AS recorded,
        SUM(c.total_bill_amount - c.toll_tax - c.parking - c.driver_allowance) FILTER (WHERE c.profit_data_status = 'AVAILABLE') AS revenue,
        SUM(c.diesel_cost) FILTER (WHERE c.profit_data_status = 'AVAILABLE') AS fuel,
        SUM(c.direct_vehicle_expense) FILTER (WHERE c.profit_data_status = 'AVAILABLE') AS maintenance,
        SUM(c.driver_cost) FILTER (WHERE c.profit_data_status = 'AVAILABLE') AS driver,
        SUM(c.allocated_office_expense) FILTER (WHERE c.profit_data_status = 'AVAILABLE') AS other,
        SUM(CASE WHEN b.assignment_source = 'VENDOR' THEN c.final_vendor_payable - c.toll_tax - c.parking - c.driver_allowance ELSE 0 END) FILTER (WHERE c.profit_data_status = 'AVAILABLE') AS vendor_cost
      FROM bookings b JOIN booking_closures c ON c.booking_id = b.id AND c.tenant_id = b.tenant_id
      WHERE b.tenant_id = ${tenantId}::uuid AND b.deleted_at IS NULL AND b.status = 'CLOSED' AND b.vehicle_id IS NOT NULL
        AND b.start_date >= ${range.start}::date AND b.start_date < ${range.until}::date
      GROUP BY b.vehicle_id
    ), expenses_by_vehicle AS (
      SELECT vehicle_id, COUNT(*)::int AS records,
        SUM(amount) FILTER (WHERE category = 'FUEL') AS fuel,
        SUM(amount) FILTER (WHERE category = 'VEHICLE_MAINTENANCE') AS maintenance,
        SUM(amount) FILTER (WHERE category = 'DRIVER_PAYMENT') AS driver,
        SUM(amount) FILTER (WHERE category IN ('OFFICE_EXPENSE', 'OTHER') OR category IS NULL) AS other
      FROM account_transactions WHERE tenant_id = ${tenantId}::uuid AND booking_id IS NULL AND vehicle_id IS NOT NULL
        AND transaction_date >= ${range.start}::date AND transaction_date < ${range.until}::date
        AND transaction_type = 'EXPENSE' AND direction = 'DEBIT'
        AND (category IN ('FUEL', 'VEHICLE_MAINTENANCE', 'DRIVER_PAYMENT', 'OFFICE_EXPENSE', 'OTHER') OR category IS NULL)
      GROUP BY vehicle_id
    ), totals AS (
      SELECT v.id, v.registration_number AS vehicle, COALESCE(b.revenue,0) AS revenue,
        COALESCE(b.fuel,0) + COALESCE(e.fuel,0) AS fuel,
        COALESCE(b.maintenance,0) + COALESCE(e.maintenance,0) AS maintenance,
        COALESCE(b.driver,0) + COALESCE(e.driver,0) AS driver,
        COALESCE(b.other,0) + COALESCE(e.other,0) AS other,
        COALESCE(b.vendor_cost,0) AS vendor_cost,
        COALESCE(b.excluded,0) AS excluded
      FROM vehicles v LEFT JOIN bookings_by_vehicle b ON b.vehicle_id = v.id LEFT JOIN expenses_by_vehicle e ON e.vehicle_id = v.id
      WHERE v.tenant_id = ${tenantId}::uuid AND v.deleted_at IS NULL AND v.ownership_type::text = ${ownership} AND (COALESCE(b.recorded,0) > 0 OR COALESCE(e.records,0) > 0)
    )
    SELECT id, vehicle, revenue, fuel AS "fuelCost", maintenance, driver AS "driverCost", other AS "otherCost", vendor_cost AS "vendorCost", maintenance + driver + other AS "extraCost",
      revenue - fuel - maintenance - driver - other - vendor_cost AS "netProfit",
      CASE WHEN revenue > 0 THEN ROUND((revenue - fuel - maintenance - driver - other - vendor_cost) / revenue * 100, 2) ELSE NULL END AS "profitPercent", excluded
    FROM totals ORDER BY "netProfit" DESC, vehicle, id LIMIT 10
  `
  return {
    ownership,
    start: range.start,
    end: range.end,
    items: rows.map((row) => ({
      ...row,
      revenue: Number(row.revenue),
      fuelCost: Number(row.fuelCost),
      maintenance: Number(row.maintenance),
      driverCost: Number(row.driverCost),
      otherCost: Number(row.otherCost),
      vendorCost: Number(row.vendorCost),
      extraCost: Number(row.extraCost),
      netProfit: Number(row.netProfit),
      profitPercent:
        row.profitPercent === null ? null : Number(row.profitPercent),
    })),
  }
}
