import 'dotenv/config'
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../src/generated/prisma/client'
import {
  parseCustomerMappings,
  parseResourceMappings,
  prepareBookingMigration,
} from '../src/migrations/legacy/booking-import'
import { toCsv } from '../src/migrations/legacy/csv'
import {
  deterministicUuid,
  PRAYAGRAJ_TENANT_ID,
} from '../src/migrations/legacy/vendor-import'

const execFileAsync = promisify(execFile)
const scriptDirectory = dirname(fileURLToPath(import.meta.url))

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
    dailyPath: resolve(
      option('--daily-source') ??
        join(scriptDirectory, 'daily_booking.csv.zip'),
    ),
    detailPath: resolve(
      option('--detail-source') ??
        join(scriptDirectory, 'booking_details.csv.zip'),
    ),
    customerMapPath: resolve(
      option('--customer-map') ??
        join(
          scriptDirectory,
          'customer-migration-output-prayagraj-20260816',
          'legacy-id-map.csv',
        ),
    ),
    vendorMapPath: resolve(
      option('--vendor-map') ??
        join(
          scriptDirectory,
          'vendor-migration-output-prayagraj',
          'vendor-id-map.csv',
        ),
    ),
    vehicleMapPath: resolve(
      option('--vehicle-map') ??
        join(
          scriptDirectory,
          'vehicle-migration-output-prayagraj',
          'vehicle-id-map.csv',
        ),
    ),
    driverMapPath: resolve(
      option('--driver-map') ??
        join(
          scriptDirectory,
          'driver-migration-output-prayagraj',
          'driver-id-map.csv',
        ),
    ),
    outputPath: resolve(
      option('--output') ??
        join(scriptDirectory, 'booking-migration-output-prayagraj'),
    ),
  }
}

async function source(path: string) {
  if (!path.toLowerCase().endsWith('.zip')) return readFile(path, 'utf8')
  const { stdout } = await execFileAsync('unzip', ['-p', path], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  return stdout
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

async function databasePreflight(
  tenantId: string,
  prepared: ReturnType<typeof prepareBookingMigration>,
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
    throw new Error(
      `Tenant identity check failed for ${tenant.tradeName ?? tenant.legalName}`,
    )
  }
  const [
    actor,
    customers,
    vendors,
    vehicles,
    drivers,
    existingBookings,
    existingClosures,
  ] = await Promise.all([
    prisma.tenantUser.findFirst({
      where: { tenantId, isPrimaryOwner: true },
      select: { id: true },
    }),
    prisma.customer.findMany({
      where: {
        tenantId,
        id: {
          in: [...new Set(prepared.bookings.map((row) => row.customerId))],
        },
      },
      select: { id: true },
    }),
    prisma.vendor.findMany({
      where: {
        tenantId,
        id: {
          in: [
            ...new Set(
              prepared.bookings.flatMap((row) =>
                row.vendorId ? [row.vendorId] : [],
              ),
            ),
          ],
        },
      },
      select: { id: true },
    }),
    prisma.vehicle.findMany({
      where: {
        tenantId,
        id: {
          in: [
            ...new Set(
              prepared.bookings.flatMap((row) =>
                row.vehicleId ? [row.vehicleId] : [],
              ),
            ),
          ],
        },
      },
      select: { id: true },
    }),
    prisma.driver.findMany({
      where: {
        tenantId,
        id: {
          in: [
            ...new Set(
              prepared.bookings.flatMap((row) =>
                row.driverId ? [row.driverId] : [],
              ),
            ),
          ],
        },
      },
      select: { id: true },
    }),
    prisma.booking.findMany({
      where: {
        OR: [
          { id: { in: prepared.bookings.map((row) => row.id) } },
          {
            bookingNumber: {
              in: prepared.bookings.map((row) => row.bookingNumber),
            },
          },
        ],
      },
      select: { id: true, bookingNumber: true, tenantId: true },
    }),
    prisma.bookingClosure.findMany({
      where: { id: { in: prepared.closures.map((row) => row.id) } },
      select: { id: true, bookingId: true, tenantId: true },
    }),
  ])
  if (!actor) {
    await prisma.$disconnect()
    throw new Error('Primary-owner migration actor was not found')
  }
  const placeholderIds = new Set(prepared.placeholders.map((row) => row.id))
  const missingCustomerIds = [
    ...new Set(prepared.bookings.map((row) => row.customerId)),
  ].filter(
    (id) => !customers.some((row) => row.id === id) && !placeholderIds.has(id),
  )
  if (missingCustomerIds.length) {
    await prisma.$disconnect()
    throw new Error(
      `Mapped customers missing from database: ${missingCustomerIds.length}`,
    )
  }
  for (const [label, expected, actual] of [
    [
      'vendors',
      new Set(
        prepared.bookings.flatMap((row) =>
          row.vendorId ? [row.vendorId] : [],
        ),
      ),
      vendors,
    ],
    [
      'vehicles',
      new Set(
        prepared.bookings.flatMap((row) =>
          row.vehicleId ? [row.vehicleId] : [],
        ),
      ),
      vehicles,
    ],
    [
      'drivers',
      new Set(
        prepared.bookings.flatMap((row) =>
          row.driverId ? [row.driverId] : [],
        ),
      ),
      drivers,
    ],
  ] as const)
    if (expected.size !== actual.length) {
      await prisma.$disconnect()
      throw new Error(
        `Mapped ${label} missing from database: ${expected.size - actual.length}`,
      )
    }
  const bookingConflicts = existingBookings.filter(
    (existing) =>
      existing.tenantId !== tenantId ||
      !prepared.bookings.some(
        (row) =>
          row.id === existing.id &&
          row.bookingNumber === existing.bookingNumber,
      ),
  )
  const closureConflicts = existingClosures.filter(
    (existing) =>
      existing.tenantId !== tenantId ||
      !prepared.closures.some(
        (row) => row.id === existing.id && row.bookingId === existing.bookingId,
      ),
  )
  return {
    prisma,
    actorId: actor.id,
    existingBookingIds: new Set(existingBookings.map((row) => row.id)),
    existingClosureIds: new Set(existingClosures.map((row) => row.id)),
    bookingConflicts,
    closureConflicts,
  }
}

async function writeReports(
  outputPath: string,
  selected: ReturnType<typeof options>,
  prepared: ReturnType<typeof prepareBookingMigration>,
  preflight: Awaited<ReturnType<typeof databasePreflight>>,
) {
  await mkdir(outputPath, { recursive: true })
  const unresolved = prepared.bookings.filter(
    (row) => row.legacy.resourceWarnings.length,
  )
  const summary = {
    mode: selected.apply ? 'apply' : 'dry-run',
    tenantId: selected.tenantId,
    dailySource: selected.dailyPath,
    detailSource: selected.detailPath,
    dailySha256: prepared.dailySha256,
    detailSha256: prepared.detailSha256,
    dailySourceRows: prepared.dailySourceRows,
    detailSourceRows: prepared.detailSourceRows,
    bookingsPrepared: prepared.bookings.length,
    bookingsToCreate: prepared.bookings.filter(
      (row) => !preflight.existingBookingIds.has(row.id),
    ).length,
    existingBookings: prepared.bookings.filter((row) =>
      preflight.existingBookingIds.has(row.id),
    ).length,
    placeholderCustomers: prepared.placeholders.length,
    bookingsWithoutClosure: prepared.bookings.length - prepared.closures.length,
    closuresPrepared: prepared.closures.length,
    closuresToCreate: prepared.closures.filter(
      (row) => !preflight.existingClosureIds.has(row.id),
    ).length,
    bookingRejections: prepared.bookingRejections.length,
    detailRejections: prepared.detailRejections.length,
    blankDetailBookingIds: prepared.detailRejections.filter(
      (row) => row.reason === 'BLANK_BOOKING_ID',
    ).length,
    orphanDetails: prepared.detailRejections.filter(
      (row) => row.reason === 'ORPHAN_BOOKING_ID',
    ).length,
    duplicateDetails: prepared.detailRejections.filter(
      (row) => row.reason === 'DUPLICATE_BOOKING_DETAIL',
    ).length,
    dateSubstitutions: prepared.closures.filter((row) => row.dateSubstituted)
      .length,
    bookingDateCorrections: prepared.bookings.filter((row) => row.dateCorrected)
      .length,
    unresolvedResourceBookings: unresolved.length,
    bookingDatabaseConflicts: preflight.bookingConflicts.length,
    closureDatabaseConflicts: preflight.closureConflicts.length,
    createsBookingCollections: false,
    readyForApply:
      prepared.bookingRejections.length === 0 &&
      preflight.bookingConflicts.length === 0 &&
      preflight.closureConflicts.length === 0,
  }
  await Promise.all([
    writeFile(
      join(outputPath, 'summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    ),
    writeFile(
      join(outputPath, 'source-manifest.json'),
      `${JSON.stringify({ dailySource: selected.dailyPath, dailySha256: prepared.dailySha256, detailSource: selected.detailPath, detailSha256: prepared.detailSha256, customerMap: selected.customerMapPath, vendorMap: selected.vendorMapPath, vehicleMap: selected.vehicleMapPath, driverMap: selected.driverMapPath }, null, 2)}\n`,
    ),
    writeFile(
      join(outputPath, 'booking-id-map.csv'),
      toCsv([
        [
          'legacy_id',
          'booking_number',
          'new_booking_uuid',
          'customer_uuid',
          'traveller_uuid',
          'status',
          'has_closure',
        ],
        ...prepared.bookings.map((row) => [
          row.legacy.id,
          row.bookingNumber,
          row.id,
          row.customerId,
          row.travellerId,
          row.status,
          prepared.closures.some((closure) => closure.bookingId === row.id),
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'placeholder-customers.csv'),
      toCsv([
        ['legacy_customer_id', 'new_customer_uuid', 'customer_code', 'name'],
        ...prepared.placeholders.map((row) => [
          row.legacyCustomerId,
          row.id,
          row.customerCode,
          row.name,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'booking-rejections.csv'),
      toCsv([
        ['row_number', 'booking_number', 'reason'],
        ...prepared.bookingRejections.map((row) => [
          row.rowNumber,
          row.bookingNumber,
          row.reason,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'detail-rejections.csv'),
      toCsv([
        ['row_number', 'legacy_detail_id', 'booking_number', 'reason'],
        ...prepared.detailRejections.map((row) => [
          row.rowNumber,
          row.legacyId,
          row.bookingNumber,
          row.reason,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'date-substitutions.csv'),
      toCsv([
        [
          'legacy_detail_id',
          'booking_number',
          'source_start_date',
          'source_end_date',
          'resolved_start_date',
          'resolved_end_date',
        ],
        ...prepared.closures
          .filter((row) => row.dateSubstituted)
          .map((row) => [
            row.legacyDetailId,
            prepared.bookings.find((booking) => booking.id === row.bookingId)
              ?.bookingNumber,
            row.legacy.tripStartDate,
            row.legacy.tripEndDate,
            row.legacy.resolvedStartDate,
            row.legacy.resolvedEndDate,
          ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'booking-date-corrections.csv'),
      toCsv([
        [
          'legacy_id',
          'booking_number',
          'source_start_date',
          'source_end_date',
          'resolved_start_date',
          'resolved_end_date',
          'reason',
        ],
        ...prepared.bookings
          .filter((row) => row.dateCorrected)
          .map((row) => [
            row.legacy.id,
            row.bookingNumber,
            row.legacy.start_date,
            row.legacy.end_date,
            row.startDate.toISOString().slice(0, 10),
            row.endDate.toISOString().slice(0, 10),
            'END_BEFORE_START_REPLACED_WITH_START_DATE',
          ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'unresolved-resources.csv'),
      toCsv([
        [
          'booking_number',
          'legacy_vendor',
          'legacy_vehicle_no',
          'legacy_driver',
          'legacy_driver_no',
          'warnings',
        ],
        ...unresolved.map((row) => [
          row.bookingNumber,
          row.legacy.vendor,
          row.legacy.vehicle_no,
          row.legacy.driver,
          row.legacy.driver_no,
          row.legacy.resourceWarnings.join(' | '),
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'preserved-financial-fields.csv'),
      toCsv([
        [
          'legacy_detail_id',
          'booking_number',
          'payment_status',
          'payment_mode',
          'commission',
          'commission_status',
          'total_pending',
          'preservation',
        ],
        ...prepared.closures.map((row) => [
          row.legacyDetailId,
          prepared.bookings.find((booking) => booking.id === row.bookingId)
            ?.bookingNumber,
          row.legacy.paymentStatus,
          row.legacy.paymentMode,
          row.legacy.comission,
          row.legacy.comissionStatus,
          row.legacy.totalPending,
          'AUDIT_AND_REPORT_ONLY_NO_BOOKING_COLLECTION',
        ]),
      ]),
    ),
  ])
  return summary
}

async function applyMigration(
  preflight: Awaited<ReturnType<typeof databasePreflight>>,
  tenantId: string,
  prepared: ReturnType<typeof prepareBookingMigration>,
) {
  const newCustomers = prepared.placeholders
  const newBookings = prepared.bookings.filter(
    (row) => !preflight.existingBookingIds.has(row.id),
  )
  const newClosures = prepared.closures.filter(
    (row) => !preflight.existingClosureIds.has(row.id),
  )
  await preflight.prisma.$transaction(
    async (tx) => {
      if (newCustomers.length)
        await tx.customer.createMany({
          data: newCustomers.map(({ legacyCustomerId: _legacy, ...row }) => ({
            ...row,
            createdById: preflight.actorId,
            updatedById: preflight.actorId,
          })),
          skipDuplicates: true,
        })
      if (newBookings.length)
        await tx.booking.createMany({
          data: newBookings.map(
            ({ legacy: _legacy, dateCorrected: _dateCorrected, ...row }) => ({
              ...row,
              createdById: preflight.actorId,
              updatedById: preflight.actorId,
            }),
          ),
        })
      if (newClosures.length)
        await tx.bookingClosure.createMany({
          data: newClosures.map(
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
              closedById: preflight.actorId,
            }),
          ),
        })
      await tx.tenantAuditLog.createMany({
        data: [
          ...prepared.placeholders.map((row) => ({
            id: deterministicUuid(
              `old-booking-placeholder-audit:${tenantId}:${row.legacyCustomerId}`,
            ),
            tenantId,
            actorUserId: preflight.actorId,
            module: 'BOOKING_MIGRATION',
            action: 'CREATE_PLACEHOLDER_CUSTOMER',
            referenceId: row.id,
            newValues: {
              legacyCustomerId: row.legacyCustomerId,
            } as Prisma.InputJsonValue,
            remarks: 'Placeholder approved for missing legacy customer',
          })),
          ...prepared.bookings.map((row) => ({
            id: deterministicUuid(
              `old-booking-audit:${tenantId}:${row.bookingNumber}`,
            ),
            tenantId,
            actorUserId: preflight.actorId,
            module: 'BOOKING_MIGRATION',
            action: 'IMPORT',
            referenceId: row.id,
            newValues: row.legacy as unknown as Prisma.InputJsonValue,
            remarks: 'Imported from legacy daily_booking CSV',
          })),
          ...prepared.closures.map((row) => ({
            id: deterministicUuid(
              `old-booking-closure-audit:${tenantId}:${row.legacyDetailId}`,
            ),
            tenantId,
            actorUserId: preflight.actorId,
            module: 'BOOKING_MIGRATION',
            action: 'IMPORT_CLOSURE',
            referenceId: row.id,
            newValues: row.legacy as unknown as Prisma.InputJsonValue,
            remarks:
              'Imported from legacy booking_details CSV; payment statuses preserved without collection records',
          })),
        ],
        skipDuplicates: true,
      })
    },
    { timeout: 180_000 },
  )
  const [bookings, closures, collections] = await Promise.all([
    preflight.prisma.booking.count({
      where: { tenantId, id: { in: prepared.bookings.map((row) => row.id) } },
    }),
    preflight.prisma.bookingClosure.count({
      where: { tenantId, id: { in: prepared.closures.map((row) => row.id) } },
    }),
    preflight.prisma.bookingCollection.count({
      where: {
        tenantId,
        bookingId: { in: prepared.bookings.map((row) => row.id) },
      },
    }),
  ])
  if (
    bookings !== prepared.bookings.length ||
    closures !== prepared.closures.length ||
    collections !== 0
  )
    throw new Error(
      `Post-import reconciliation failed: bookings ${bookings}/${prepared.bookings.length}, closures ${closures}/${prepared.closures.length}, collections ${collections}/0`,
    )
  return {
    placeholderCustomersInserted: newCustomers.length,
    bookingsInserted: newBookings.length,
    closuresInserted: newClosures.length,
    verifiedBookings: bookings,
    verifiedClosures: closures,
    bookingCollectionsCreated: collections,
  }
}

async function main() {
  const selected = options()
  if (!selected.tenantId)
    throw new Error(`Pass --tenant-id ${PRAYAGRAJ_TENANT_ID}`)
  if (selected.tenantId !== PRAYAGRAJ_TENANT_ID)
    throw new Error(`This importer only permits tenant ${PRAYAGRAJ_TENANT_ID}`)
  if (selected.apply && selected.confirmedTenantId !== selected.tenantId)
    throw new Error(`Apply requires --confirm-tenant ${selected.tenantId}`)
  const [daily, details, customerMap, vendorMap, vehicleMap, driverMap] =
    await Promise.all([
      source(selected.dailyPath),
      source(selected.detailPath),
      readFile(selected.customerMapPath, 'utf8'),
      readFile(selected.vendorMapPath, 'utf8'),
      readFile(selected.vehicleMapPath, 'utf8'),
      readFile(selected.driverMapPath, 'utf8'),
    ])
  const resourceMappings = parseResourceMappings(
    vendorMap,
    vehicleMap,
    driverMap,
  )
  const prepared = prepareBookingMigration(daily, details, selected.tenantId, {
    customers: parseCustomerMappings(customerMap),
    ...resourceMappings,
  })
  const preflight = await databasePreflight(selected.tenantId, prepared)
  try {
    const summary = await writeReports(
      selected.outputPath,
      selected,
      prepared,
      preflight,
    )
    console.log(JSON.stringify(summary, null, 2))
    if (!selected.apply) return
    if (!summary.readyForApply)
      throw new Error(
        'Apply refused: dry-run contains booking or database conflicts',
      )
    if (selected.confirmedDailySha !== prepared.dailySha256)
      throw new Error(
        `Apply requires --confirm-daily-sha ${prepared.dailySha256}`,
      )
    if (selected.confirmedDetailSha !== prepared.detailSha256)
      throw new Error(
        `Apply requires --confirm-detail-sha ${prepared.detailSha256}`,
      )
    console.log(
      JSON.stringify(
        await applyMigration(preflight, selected.tenantId, prepared),
        null,
        2,
      ),
    )
  } finally {
    await preflight.prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
