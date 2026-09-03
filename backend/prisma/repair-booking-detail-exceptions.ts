import 'dotenv/config'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../src/generated/prisma/client'
import {
  BOOKING_DETAIL_HEADERS,
  prepareBookingMigration,
} from '../src/migrations/legacy/booking-import'
import { parseCsv, toCsv } from '../src/migrations/legacy/csv'
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
  'booking-detail-repair-output-prayagraj',
)

const APPROVED_REPAIRS = new Map([
  ['2385', 'CMF25-010301'],
  ['2384', 'CMF25-010303'],
  ['2274', 'CMF24-120501'],
  ['2943', 'CMF25-71702'],
  ['1493', 'CMF24-40403'],
])

const DISCARDED_DUPLICATES = [
  ['1492', 'CMF24-40403', 'USER_SELECTED_DETAIL_1493'],
  ['2273', 'CMF24-120501', 'DUPLICATE_OF_SELECTED_DETAIL_2274'],
  ['2942', 'CMF25-71702', 'EMPTY_DUPLICATE_OF_SELECTED_DETAIL_2943'],
] as const

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

function selectedDetailSource(source: string) {
  const records = parseCsv(source.replace(/^\uFEFF/, ''))
  const headers = records.shift()
  if (!headers || headers.join('|') !== BOOKING_DETAIL_HEADERS.join('|'))
    throw new Error('Unexpected booking-details headers')
  const idIndex = headers.indexOf('id')
  const bookingIndex = headers.indexOf('booking_id')
  const selected = records
    .filter((row) => APPROVED_REPAIRS.has(row[idIndex] ?? ''))
    .map((row) => {
      const copy = [...row]
      copy[bookingIndex] = APPROVED_REPAIRS.get(row[idIndex] ?? '')!
      return copy
    })
  if (selected.length !== APPROVED_REPAIRS.size)
    throw new Error(
      `Approved detail rows missing: ${selected.length}/${APPROVED_REPAIRS.size}`,
    )
  return toCsv([headers, ...selected])
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

async function preflight(tenantId: string, daily: string, details: string) {
  const prepared = prepareBookingMigration(daily, details, tenantId, {
    customers: new Map(),
    vendors: new Map(),
    vehicles: new Map(),
    driversByPhone: new Map(),
    driversByName: new Map(),
  })
  if (prepared.closures.length !== APPROVED_REPAIRS.size)
    throw new Error(
      `Closure preparation failed: ${prepared.closures.length}/${APPROVED_REPAIRS.size}`,
    )
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
  const name = normalize(`${tenant.tradeName ?? ''} ${tenant.legalName}`)
  if (
    !name.includes('COMFORT') ||
    !name.includes('CAR') ||
    !name.includes('PRAYAGRAJ')
  ) {
    await prisma.$disconnect()
    throw new Error('Tenant identity check failed')
  }
  const [actor, bookings, existingClosures] = await Promise.all([
    prisma.tenantUser.findFirst({
      where: { tenantId, isPrimaryOwner: true },
      select: { id: true },
    }),
    prisma.booking.findMany({
      where: {
        tenantId,
        id: { in: prepared.closures.map((row) => row.bookingId) },
      },
      select: { id: true, bookingNumber: true },
    }),
    prisma.bookingClosure.findMany({
      where: {
        tenantId,
        OR: [
          { id: { in: prepared.closures.map((row) => row.id) } },
          { bookingId: { in: prepared.closures.map((row) => row.bookingId) } },
        ],
      },
      select: { id: true, bookingId: true },
    }),
  ])
  if (!actor) {
    await prisma.$disconnect()
    throw new Error('Primary-owner migration actor was not found')
  }
  if (bookings.length !== prepared.closures.length) {
    await prisma.$disconnect()
    throw new Error(
      `Target booking verification failed: ${bookings.length}/${prepared.closures.length}`,
    )
  }
  const conflicts = existingClosures.filter((existing) =>
    prepared.closures.some(
      (row) => row.bookingId === existing.bookingId && row.id !== existing.id,
    ),
  )
  return { prisma, actorId: actor.id, prepared, existingClosures, conflicts }
}

async function reports(
  outputPath: string,
  apply: boolean,
  state: Awaited<ReturnType<typeof preflight>>,
) {
  await mkdir(outputPath, { recursive: true })
  const existingIds = new Set(state.existingClosures.map((row) => row.id))
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    tenantId: PRAYAGRAJ_TENANT_ID,
    dailySha256: state.prepared.dailySha256,
    detailSha256: state.prepared.detailSha256,
    approvedRepairs: state.prepared.closures.length,
    closuresToCreate: state.prepared.closures.filter(
      (row) => !existingIds.has(row.id),
    ).length,
    existingExactClosures: state.prepared.closures.filter((row) =>
      existingIds.has(row.id),
    ).length,
    discardedDuplicateRows: DISCARDED_DUPLICATES.length,
    databaseConflicts: state.conflicts.length,
    readyForApply: state.conflicts.length === 0,
  }
  await Promise.all([
    writeFile(
      join(outputPath, 'summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    ),
    writeFile(
      join(outputPath, 'approved-repairs.csv'),
      toCsv([
        ['legacy_detail_id', 'resolved_booking_number', 'new_closure_uuid'],
        ...state.prepared.closures.map((row) => [
          row.legacyDetailId,
          APPROVED_REPAIRS.get(row.legacyDetailId),
          row.id,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'discarded-duplicates.csv'),
      toCsv([
        ['legacy_detail_id', 'booking_number', 'reason'],
        ...DISCARDED_DUPLICATES,
      ]),
    ),
  ])
  return summary
}

async function applyRepair(
  tenantId: string,
  state: Awaited<ReturnType<typeof preflight>>,
) {
  const existingIds = new Set(state.existingClosures.map((row) => row.id))
  const closures = state.prepared.closures.filter(
    (row) => !existingIds.has(row.id),
  )
  await state.prisma.$transaction(
    async (tx) => {
      if (closures.length)
        await tx.bookingClosure.createMany({
          data: closures.map(
            ({
              legacy: _legacy,
              legacyDetailId: _detail,
              dateSubstituted: _substituted,
              ...row
            }) => ({
              ...row,
              otherRecoverableCharges: 0,
              gstAmount: 0,
              allocatedOfficeExpense: 0,
              netVehicleProfit: 0,
              vendorExtraCharges: 0,
              vendorDeduction: 0,
              vendorBookingProfit: 0,
              closedById: state.actorId,
            }),
          ),
        })
      await tx.tenantAuditLog.createMany({
        data: state.prepared.closures.map((row) => ({
          id: deterministicUuid(
            `old-booking-detail-repair-audit:${tenantId}:${row.legacyDetailId}`,
          ),
          tenantId,
          actorUserId: state.actorId,
          module: 'BOOKING_MIGRATION',
          action: 'REPAIR_CLOSURE',
          referenceId: row.id,
          newValues: {
            ...row.legacy,
            resolvedBookingNumber: APPROVED_REPAIRS.get(row.legacyDetailId),
          } as unknown as Prisma.InputJsonValue,
          remarks: 'Approved legacy booking-detail exception repair',
        })),
        skipDuplicates: true,
      })
    },
    { timeout: 120_000 },
  )
  const verified = await state.prisma.bookingClosure.count({
    where: {
      tenantId,
      id: { in: state.prepared.closures.map((row) => row.id) },
    },
  })
  if (verified !== state.prepared.closures.length)
    throw new Error(
      `Post-repair verification failed: ${verified}/${state.prepared.closures.length}`,
    )
  return { inserted: closures.length, verified }
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
  const state = await preflight(
    selected.tenantId,
    daily,
    selectedDetailSource(details),
  )
  try {
    const summary = await reports(selected.outputPath, selected.apply, state)
    console.log(JSON.stringify(summary, null, 2))
    if (!selected.apply) return
    if (!summary.readyForApply)
      throw new Error('Apply refused: repair contains database conflicts')
    if (selected.confirmedDailySha !== state.prepared.dailySha256)
      throw new Error(
        `Apply requires --confirm-daily-sha ${state.prepared.dailySha256}`,
      )
    if (selected.confirmedDetailSha !== state.prepared.detailSha256)
      throw new Error(
        `Apply requires --confirm-detail-sha ${state.prepared.detailSha256}`,
      )
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
