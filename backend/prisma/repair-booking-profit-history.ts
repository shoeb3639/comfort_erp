import 'dotenv/config'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../src/generated/prisma/client'
import {
  BOOKING_DETAIL_HEADERS,
  DAILY_BOOKING_HEADERS,
} from '../src/migrations/legacy/booking-import'
import { clean, parseCsv, toCsv } from '../src/migrations/legacy/csv'
import {
  deterministicUuid,
  PRAYAGRAJ_TENANT_ID,
} from '../src/migrations/legacy/vendor-import'

const execFileAsync = promisify(execFile)
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const dailyPath = join(scriptDirectory, 'daily_booking.csv.zip')
const detailPath = join(scriptDirectory, 'booking_details.csv.zip')
const defaultOutput = join(
  scriptDirectory,
  'booking-profit-repair-output-prayagraj',
)

const SELECTED_DUPLICATES = new Map([
  ['CMF24-40403', '1493'],
  ['CMF24-120501', '2274'],
  ['CMF25-71702', '2943'],
])
const REPAIRED_ORPHANS = new Map([
  ['2385', 'CMF25-010301'],
  ['2384', 'CMF25-010303'],
])

type ProfitStatus = 'NOT_TRACKED' | 'AVAILABLE' | 'INCOMPLETE' | 'REGISTER_ONLY'

interface RepairRow {
  bookingNumber: string
  bookingId: string
  closureId: string
  legacyDetailId: string
  ownership: 'OWN' | 'VENDOR'
  profitDataStatus: ProfitStatus
  income: number
  expense: number
  balance: number
  commissionProfit: number
  vehicleRevenue: number
  dieselCost: number
  netVehicleProfit: number
  vendorPayableAmount: number
  vendorDeduction: number
  finalVendorPayable: number
  vendorBookingProfit: number
}

function options() {
  const args = process.argv.slice(2)
  const option = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  return {
    apply: args.includes('--apply'),
    tenantId: option('--tenant-id'),
    confirmedTenantId: option('--confirm-tenant'),
    confirmedDailySha: option('--confirm-daily-sha'),
    confirmedDetailSha: option('--confirm-detail-sha'),
    outputPath: resolve(option('--output') ?? defaultOutput),
  }
}

async function zipSource(path: string) {
  return (
    await execFileAsync('unzip', ['-p', path], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    })
  ).stdout
}

function records<T extends readonly string[]>(source: string, headers: T) {
  const parsed = parseCsv(source.replace(/^\uFEFF/, ''))
  const actual = parsed.shift()
  if (!actual || actual.join('|') !== headers.join('|'))
    throw new Error(`Unexpected CSV headers: ${headers.join(', ')}`)
  return parsed
    .filter((row) => row.some(clean))
    .map(
      (values) =>
        Object.fromEntries(
          headers.map((header, index) => [header, values[index] ?? '']),
        ) as Record<T[number], string>,
    )
}

function numeric(value: string) {
  const raw = clean(value).replaceAll(',', '')
  if (!raw) return null
  const match = raw.match(/^-?\d+(?:\.\d+)?$/)
  return match ? Number(match[0]) : null
}

function money(value: string) {
  const raw = clean(value).replaceAll(',', '')
  const match = raw.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : 0
}

function ownership(vendorCode: string, fallback: 'OWN' | 'VENDOR') {
  const code = clean(vendorCode).toUpperCase()
  if (code === 'CMFV-001') return 'OWN' as const
  if (code.startsWith('CMFV-')) return 'VENDOR' as const
  return fallback
}

function status(
  date: Date,
  income: number | null,
  expense: number | null,
  balance: number | null,
): ProfitStatus {
  const key = date.toISOString().slice(0, 10)
  if (key < '2024-07-01') return 'NOT_TRACKED'
  if (key >= '2026-01-01') return 'REGISTER_ONLY'
  return income !== null && expense !== null && balance !== null
    ? 'AVAILABLE'
    : 'INCOMPLETE'
}

function sourceDetails(dailySource: string, detailSource: string) {
  const daily = records(dailySource, DAILY_BOOKING_HEADERS)
  const details = records(detailSource, BOOKING_DETAIL_HEADERS)
  const dailyNumbers = new Set(daily.map((row) => clean(row.booking_id)))
  const counts = new Map<string, number>()
  for (const row of details) {
    const number = clean(row.booking_id)
    if (number) counts.set(number, (counts.get(number) ?? 0) + 1)
  }
  const selected = new Map<string, (typeof details)[number]>()
  for (const row of details) {
    const number = clean(row.booking_id)
    const id = clean(row.id)
    if (
      (counts.get(number) === 1 && dailyNumbers.has(number)) ||
      SELECTED_DUPLICATES.get(number) === id
    )
      selected.set(number, row)
    const repaired = REPAIRED_ORPHANS.get(id)
    if (repaired) selected.set(repaired, row)
  }
  return { daily, selected }
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

async function preflight(
  tenantId: string,
  dailySource: string,
  detailSource: string,
) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required for preflight')
  const config = new URL(databaseUrl)
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
      password: config.password,
    }),
  })
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { legalName: true, tradeName: true },
  })
  if (!tenant) {
    await prisma.$disconnect()
    throw new Error(`Tenant ${tenantId} does not exist`)
  }
  const tenantName = normalize(`${tenant.tradeName ?? ''} ${tenant.legalName}`)
  if (
    !tenantName.includes('COMFORT') ||
    !tenantName.includes('CAR') ||
    !tenantName.includes('PRAYAGRAJ')
  ) {
    await prisma.$disconnect()
    throw new Error('Tenant identity check failed')
  }
  const actor = await prisma.tenantUser.findFirst({
    where: { tenantId, isPrimaryOwner: true },
    select: { id: true },
  })
  if (!actor) {
    await prisma.$disconnect()
    throw new Error('Primary-owner migration actor was not found')
  }
  const { daily, selected } = sourceDetails(dailySource, detailSource)
  const bookings = await prisma.booking.findMany({
    where: { tenantId, bookingNumber: { in: [...selected.keys()] } },
    select: {
      id: true,
      bookingNumber: true,
      startDate: true,
      assignmentSource: true,
      closure: {
        select: {
          id: true,
          profitDataStatus: true,
          commissionProfit: true,
          vehicleRevenue: true,
          dieselCost: true,
          netVehicleProfit: true,
          vendorPayableAmount: true,
          vendorDeduction: true,
          finalVendorPayable: true,
          vendorBookingProfit: true,
        },
      },
    },
  })
  const dailyByNumber = new Map(
    daily.map((row) => [clean(row.booking_id), row]),
  )
  const rows: RepairRow[] = []
  const missing: string[] = []
  for (const booking of bookings) {
    const detail = selected.get(booking.bookingNumber)
    const dailyRow = dailyByNumber.get(booking.bookingNumber)
    if (!detail || !dailyRow || !booking.closure) {
      missing.push(booking.bookingNumber)
      continue
    }
    const income = numeric(detail.income)
    const expense = numeric(detail.expenses)
    const balance = numeric(detail.balance)
    const profitDataStatus = status(booking.startDate, income, expense, balance)
    const sourceOwnership = ownership(dailyRow.vendor, booking.assignmentSource)
    const available = profitDataStatus === 'AVAILABLE'
    const commissionProfit = money(detail.comission)
    rows.push({
      bookingNumber: booking.bookingNumber,
      bookingId: booking.id,
      closureId: booking.closure.id,
      legacyDetailId: clean(detail.id),
      ownership: sourceOwnership,
      profitDataStatus,
      income: income ?? 0,
      expense: expense ?? 0,
      balance: balance ?? 0,
      commissionProfit,
      vehicleRevenue: available && sourceOwnership === 'OWN' ? income! : 0,
      dieselCost: available && sourceOwnership === 'OWN' ? expense! : 0,
      netVehicleProfit: available && sourceOwnership === 'OWN' ? balance! : 0,
      vendorPayableAmount:
        available && sourceOwnership === 'VENDOR' ? income! : 0,
      vendorDeduction: available && sourceOwnership === 'VENDOR' ? expense! : 0,
      finalVendorPayable:
        available && sourceOwnership === 'VENDOR' ? balance! : 0,
      vendorBookingProfit:
        available && sourceOwnership === 'VENDOR' ? commissionProfit : 0,
    })
  }
  if (bookings.length !== selected.size || missing.length) {
    await prisma.$disconnect()
    throw new Error(
      `Closure/source coverage failed: bookings ${bookings.length}/${selected.size}, missing ${missing.join(', ')}`,
    )
  }
  const rowsByClosure = new Map(rows.map((row) => [row.closureId, row]))
  const databaseMismatches = bookings.filter((booking) => {
    if (!booking.closure) return true
    const row = rowsByClosure.get(booking.closure.id)
    return (
      !row ||
      booking.closure.profitDataStatus !== row.profitDataStatus ||
      Number(booking.closure.commissionProfit) !== row.commissionProfit ||
      Number(booking.closure.vehicleRevenue) !== row.vehicleRevenue ||
      Number(booking.closure.dieselCost) !== row.dieselCost ||
      Number(booking.closure.netVehicleProfit) !== row.netVehicleProfit ||
      Number(booking.closure.vendorPayableAmount) !== row.vendorPayableAmount ||
      Number(booking.closure.vendorDeduction) !== row.vendorDeduction ||
      Number(booking.closure.finalVendorPayable) !== row.finalVendorPayable ||
      Number(booking.closure.vendorBookingProfit) !== row.vendorBookingProfit
    )
  }).length
  return {
    prisma,
    actorId: actor.id,
    rows,
    dailySha: createHash('sha256').update(dailySource).digest('hex'),
    detailSha: createHash('sha256').update(detailSource).digest('hex'),
    databaseMismatches,
  }
}

async function reports(
  outputPath: string,
  apply: boolean,
  state: Awaited<ReturnType<typeof preflight>>,
) {
  await mkdir(outputPath, { recursive: true })
  const byStatus = Object.fromEntries(
    ['NOT_TRACKED', 'AVAILABLE', 'INCOMPLETE', 'REGISTER_ONLY'].map((value) => [
      value,
      state.rows.filter((row) => row.profitDataStatus === value).length,
    ]),
  )
  const byOwnership = Object.fromEntries(
    ['OWN', 'VENDOR'].map((value) => [
      value,
      state.rows.filter((row) => row.ownership === value).length,
    ]),
  )
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    tenantId: PRAYAGRAJ_TENANT_ID,
    dailySha256: state.dailySha,
    detailSha256: state.detailSha,
    closuresPrepared: state.rows.length,
    byStatus,
    byOwnership,
    availableOwnedProfit: state.rows
      .filter(
        (row) =>
          row.profitDataStatus === 'AVAILABLE' && row.ownership === 'OWN',
      )
      .reduce((sum, row) => sum + row.netVehicleProfit, 0),
    availableVendorCommission: state.rows
      .filter(
        (row) =>
          row.profitDataStatus === 'AVAILABLE' && row.ownership === 'VENDOR',
      )
      .reduce((sum, row) => sum + row.vendorBookingProfit, 0),
    commissionProfitAllPeriods: state.rows.reduce(
      (sum, row) => sum + row.commissionProfit,
      0,
    ),
    databaseMismatches: state.databaseMismatches,
    readyForApply: true,
  }
  await Promise.all([
    writeFile(
      join(outputPath, 'summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    ),
    writeFile(
      join(outputPath, 'profit-mapping.csv'),
      toCsv([
        [
          'booking_number',
          'legacy_detail_id',
          'ownership',
          'profit_data_status',
          'income',
          'expense',
          'balance',
          'commission_profit',
          'vehicle_revenue',
          'diesel_cost',
          'net_vehicle_profit',
          'vendor_gross_payable',
          'vendor_advance',
          'vendor_net_payable',
          'comfort_cars_vendor_profit',
        ],
        ...state.rows.map((row) => [
          row.bookingNumber,
          row.legacyDetailId,
          row.ownership,
          row.profitDataStatus,
          row.income,
          row.expense,
          row.balance,
          row.commissionProfit,
          row.vehicleRevenue,
          row.dieselCost,
          row.netVehicleProfit,
          row.vendorPayableAmount,
          row.vendorDeduction,
          row.finalVendorPayable,
          row.vendorBookingProfit,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'incomplete-profit-rows.csv'),
      toCsv([
        ['booking_number', 'legacy_detail_id', 'ownership', 'reason'],
        ...state.rows
          .filter((row) => row.profitDataStatus === 'INCOMPLETE')
          .map((row) => [
            row.bookingNumber,
            row.legacyDetailId,
            row.ownership,
            'INCOME_EXPENSE_OR_BALANCE_MISSING',
          ]),
      ]),
    ),
  ])
  return summary
}

async function applyRepair(
  tenantId: string,
  state: Awaited<ReturnType<typeof preflight>>,
) {
  await state.prisma.$transaction(
    async (tx) => {
      for (const row of state.rows) {
        await tx.bookingClosure.update({
          where: { tenantId_id: { tenantId, id: row.closureId } },
          data: {
            profitDataStatus: row.profitDataStatus,
            commissionProfit: row.commissionProfit,
            vehicleRevenue: row.vehicleRevenue,
            dieselCost: row.dieselCost,
            directVehicleExpense: 0,
            driverCost: 0,
            allocatedOfficeExpense: 0,
            netVehicleProfit: row.netVehicleProfit,
            vendorPayableAmount: row.vendorPayableAmount,
            vendorExtraCharges: 0,
            vendorDeduction: row.vendorDeduction,
            finalVendorPayable: row.finalVendorPayable,
            vendorBookingProfit: row.vendorBookingProfit,
          },
        })
      }
      await tx.tenantAuditLog.createMany({
        data: state.rows.map((row) => ({
          id: deterministicUuid(
            `old-booking-profit-repair-audit:${tenantId}:${row.legacyDetailId}`,
          ),
          tenantId,
          actorUserId: state.actorId,
          module: 'BOOKING_MIGRATION',
          action: 'REPAIR_HISTORICAL_PROFIT',
          referenceId: row.closureId,
          newValues: {
            ownership: row.ownership,
            profitDataStatus: row.profitDataStatus,
            income: row.income,
            expense: row.expense,
            balance: row.balance,
            commissionProfit: row.commissionProfit,
          } as Prisma.InputJsonValue,
          remarks:
            'Historical vehicle-ledger profit mapping approved on 2026-08-25',
        })),
        skipDuplicates: true,
      })
    },
    { timeout: 300_000 },
  )
  const verified = await state.prisma.bookingClosure.count({
    where: { tenantId, id: { in: state.rows.map((row) => row.closureId) } },
  })
  if (verified !== state.rows.length)
    throw new Error(
      `Post-repair verification failed: ${verified}/${state.rows.length}`,
    )
  return { updated: state.rows.length, verified }
}

async function main() {
  const selected = options()
  if (!selected.tenantId)
    throw new Error(`Pass --tenant-id ${PRAYAGRAJ_TENANT_ID}`)
  if (selected.tenantId !== PRAYAGRAJ_TENANT_ID)
    throw new Error(`This repair only permits tenant ${PRAYAGRAJ_TENANT_ID}`)
  if (selected.apply && selected.confirmedTenantId !== selected.tenantId)
    throw new Error(`Apply requires --confirm-tenant ${selected.tenantId}`)
  const [daily, details] = await Promise.all([
    zipSource(dailyPath),
    zipSource(detailPath),
  ])
  const state = await preflight(selected.tenantId, daily, details)
  try {
    const summary = await reports(selected.outputPath, selected.apply, state)
    console.log(JSON.stringify(summary, null, 2))
    if (!selected.apply) return
    if (selected.confirmedDailySha !== state.dailySha)
      throw new Error(`Apply requires --confirm-daily-sha ${state.dailySha}`)
    if (selected.confirmedDetailSha !== state.detailSha)
      throw new Error(`Apply requires --confirm-detail-sha ${state.detailSha}`)
    console.log(
      JSON.stringify(await applyRepair(selected.tenantId, state), null, 2),
    )
  } finally {
    await state.prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
