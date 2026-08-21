import 'dotenv/config'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../src/generated/prisma/client'
import { toCsv } from '../src/migrations/legacy/csv'
import {
  type DriverDatabaseResolution,
  type PreparedLegacyDriver,
  prepareDriverMigration,
  resolveDriverMigration,
} from '../src/migrations/legacy/driver-import'
import { parseVendorMappings } from '../src/migrations/legacy/vehicle-import'
import {
  deterministicUuid,
  PRAYAGRAJ_TENANT_ID,
} from '../src/migrations/legacy/vendor-import'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const defaultSource = join(
  scriptDirectory,
  'legacy-migration-input-prayagraj',
  'drivers.csv',
)
const defaultVendorMap = join(
  scriptDirectory,
  'vendor-migration-output-prayagraj',
  'vendor-id-map.csv',
)
const defaultOutput = join(scriptDirectory, 'driver-migration-output-prayagraj')

function options() {
  const args = process.argv.slice(2)
  const option = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  return {
    apply: args.includes('--apply'),
    sourcePath: resolve(option('--source') ?? defaultSource),
    vendorMapPath: resolve(option('--vendor-map') ?? defaultVendorMap),
    outputPath: resolve(option('--output') ?? defaultOutput),
    tenantId: option('--tenant-id'),
    confirmedTenantId: option('--confirm-tenant'),
    confirmedSourceSha: option('--confirm-source-sha'),
  }
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

async function databasePreflight(
  tenantId: string,
  prepared: ReturnType<typeof prepareDriverMigration>,
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
  const mappedVendorIds = [
    ...new Set(
      prepared.accepted
        .map((row) => row.vendorId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const [mappedVendors, existingDrivers, actor] = await Promise.all([
    prisma.vendor.findMany({
      where: { tenantId, id: { in: mappedVendorIds }, deletedAt: null },
      select: { id: true },
    }),
    prisma.driver.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        driverCode: true,
        engagementType: true,
        vendorId: true,
        name: true,
        mobile: true,
        status: true,
      },
    }),
    prisma.tenantUser.findFirst({
      where: { tenantId, isPrimaryOwner: true },
      select: { id: true },
    }),
  ])
  if (mappedVendors.length !== mappedVendorIds.length) {
    const foundIds = new Set(mappedVendors.map((row) => row.id))
    const missingMappings = [
      ...new Map(
        prepared.accepted
          .filter((row) => row.vendorId && !foundIds.has(row.vendorId))
          .map((row) => [
            row.legacy.legacyVendorId,
            `${row.legacy.legacyVendorId} -> ${row.vendorId}`,
          ]),
      ).values(),
    ]
    await prisma.$disconnect()
    throw new Error(
      `Vendor mapping verification failed: ${mappedVendors.length}/${mappedVendorIds.length}. Missing: ${missingMappings.join(', ')}`,
    )
  }
  return {
    prisma,
    actorId: actor?.id ?? null,
    resolutions: resolveDriverMigration(prepared, existingDrivers),
  }
}

async function writeReports(
  outputPath: string,
  sourcePath: string,
  vendorMapPath: string,
  prepared: ReturnType<typeof prepareDriverMigration>,
  resolutions: DriverDatabaseResolution[],
  apply: boolean,
) {
  await mkdir(outputPath, { recursive: true })
  const resolutionByLegacyId = new Map(
    resolutions.map((row) => [row.legacyId, row]),
  )
  const conflicts = resolutions.filter((row) => row.action === 'CONFLICT')
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    tenantId: PRAYAGRAJ_TENANT_ID,
    sourcePath,
    vendorMapPath,
    sourceSha256: prepared.sourceSha256,
    sourceRows: prepared.sourceRows,
    proposedDrivers: prepared.accepted.length,
    ownDrivers: prepared.accepted.filter((row) => row.engagementType === 'OWN')
      .length,
    vendorDrivers: prepared.accepted.filter(
      (row) => row.engagementType === 'VENDOR',
    ).length,
    driversToCreate: resolutions.filter((row) => row.action === 'CREATE')
      .length,
    existingDriversReused: resolutions.filter(
      (row) => row.action === 'REUSE_EXISTING',
    ).length,
    exactPreviouslyImportedDrivers: resolutions.filter(
      (row) => row.action === 'EXISTING_EXACT',
    ).length,
    databaseConflicts: conflicts.length,
    rejectedRows: prepared.rejected.length,
    duplicateKeyGroups: prepared.duplicates.length,
    sharedPhoneConflicts: prepared.sharedPhones.length,
    mappingCoverage: prepared.accepted.length + prepared.rejected.length,
    readyForApply:
      prepared.rejected.length === 0 &&
      prepared.duplicates.length === 0 &&
      prepared.sharedPhones.length === 0 &&
      conflicts.length === 0,
  }
  await Promise.all([
    writeFile(
      join(outputPath, 'summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    ),
    writeFile(
      join(outputPath, 'source-manifest.json'),
      `${JSON.stringify(
        {
          source: sourcePath,
          sha256: prepared.sourceSha256,
          vendorMap: vendorMapPath,
          expectedTenantId: PRAYAGRAJ_TENANT_ID,
        },
        null,
        2,
      )}\n`,
    ),
    writeFile(
      join(outputPath, 'driver-id-map.csv'),
      toCsv([
        [
          'legacy_id',
          'legacy_vendor_id',
          'source_name',
          'mobile',
          'new_driver_uuid',
          'engagement_type',
          'migration_action',
        ],
        ...prepared.accepted.map((row) => [
          row.legacy.legacyId,
          row.legacy.legacyVendorId,
          row.name,
          row.mobile,
          resolutionByLegacyId.get(row.legacy.legacyId)?.targetId ?? '',
          row.engagementType,
          resolutionByLegacyId.get(row.legacy.legacyId)?.action ??
            'NOT_CHECKED',
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'rejected-records.csv'),
      toCsv([
        [
          'row_number',
          'legacy_id',
          'legacy_vendor_id',
          'name',
          'mobile',
          'reason',
        ],
        ...prepared.rejected.map((row) => [
          row.rowNumber,
          row.legacyId,
          row.legacyVendorId,
          row.name,
          row.mobile,
          row.reason,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'duplicate-records.csv'),
      toCsv([
        ['field', 'value', 'row_numbers'],
        ...prepared.duplicates.map((row) => [
          row.field,
          row.value,
          row.rowNumbers.join(' | '),
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'shared-phone-conflicts.csv'),
      toCsv([
        ['mobile', 'legacy_id', 'legacy_vendor_id', 'name'],
        ...prepared.sharedPhones.flatMap((group) =>
          group.drivers.map((row) => [
            group.mobile,
            row.legacyId,
            row.legacyVendorId,
            row.name,
          ]),
        ),
      ]),
    ),
    writeFile(
      join(outputPath, 'database-conflicts.csv'),
      toCsv([
        ['legacy_id', 'prepared_uuid', 'matched_target_uuid', 'reason'],
        ...conflicts.map((row) => [
          row.legacyId,
          row.preparedId,
          row.targetId,
          row.reason,
        ]),
      ]),
    ),
  ])
  return summary
}

async function applyMigration(
  prisma: PrismaClient,
  tenantId: string,
  prepared: ReturnType<typeof prepareDriverMigration>,
  resolutions: DriverDatabaseResolution[],
  actorId: string | null,
) {
  const resolutionByLegacyId = new Map(
    resolutions.map((row) => [row.legacyId, row]),
  )
  const newRows: PreparedLegacyDriver[] = prepared.accepted.filter(
    (row) => resolutionByLegacyId.get(row.legacy.legacyId)?.action === 'CREATE',
  )
  await prisma.$transaction(
    async (transaction) => {
      if (newRows.length)
        await transaction.driver.createMany({
          data: newRows.map(({ legacy: _legacy, ...row }) => ({
            ...row,
            createdById: actorId,
            updatedById: actorId,
          })),
        })
      await transaction.tenantAuditLog.createMany({
        data: prepared.accepted.map((row) => {
          const resolution = resolutionByLegacyId.get(row.legacy.legacyId)
          if (!resolution?.targetId)
            throw new Error(
              `Missing target mapping for driver ${row.legacy.legacyId}`,
            )
          return {
            id: deterministicUuid(
              `old-driver-audit:${tenantId}:${row.legacy.legacyId}:${resolution.targetId}`,
            ),
            tenantId,
            actorUserId: actorId,
            module: 'DRIVER_MIGRATION',
            action:
              resolution.action === 'REUSE_EXISTING' ? 'LINK_LEGACY' : 'IMPORT',
            referenceId: resolution.targetId,
            newValues: {
              ...row.legacy,
              targetDriverId: resolution.targetId,
              targetVendorId: row.vendorId,
              migrationAction: resolution.action,
            } as unknown as Prisma.InputJsonValue,
            remarks: 'Imported from legacy MySQL driver CSV',
          }
        }),
        skipDuplicates: true,
      })
    },
    { timeout: 120_000 },
  )
  const targetIds = resolutions
    .map((row) => row.targetId)
    .filter((id): id is string => Boolean(id))
  const verified = await prisma.driver.count({
    where: { tenantId, id: { in: targetIds } },
  })
  if (verified !== new Set(targetIds).size)
    throw new Error(
      `Post-import verification failed: ${verified}/${new Set(targetIds).size}`,
    )
  return {
    inserted: newRows.length,
    reused: resolutions.filter((row) => row.action === 'REUSE_EXISTING').length,
    verified,
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
  const [source, vendorMapSource] = await Promise.all([
    readFile(selected.sourcePath, 'utf8'),
    readFile(selected.vendorMapPath, 'utf8'),
  ])
  const prepared = prepareDriverMigration(
    source,
    selected.tenantId,
    parseVendorMappings(vendorMapSource),
  )
  const preflight = await databasePreflight(selected.tenantId, prepared)
  try {
    const summary = await writeReports(
      selected.outputPath,
      selected.sourcePath,
      selected.vendorMapPath,
      prepared,
      preflight.resolutions,
      selected.apply,
    )
    console.log(JSON.stringify(summary, null, 2))
    if (!selected.apply) return
    if (
      prepared.rejected.length ||
      prepared.duplicates.length ||
      prepared.sharedPhones.length ||
      preflight.resolutions.some((row) => row.action === 'CONFLICT')
    )
      throw new Error('Apply refused: driver dry-run reports contain errors')
    if (selected.confirmedSourceSha !== prepared.sourceSha256)
      throw new Error(
        `Apply requires --confirm-source-sha ${prepared.sourceSha256}`,
      )
    console.log(
      JSON.stringify(
        await applyMigration(
          preflight.prisma,
          selected.tenantId,
          prepared,
          preflight.resolutions,
          preflight.actorId,
        ),
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
