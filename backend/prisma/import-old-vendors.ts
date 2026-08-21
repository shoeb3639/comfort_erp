import 'dotenv/config'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../src/generated/prisma/client'
import {
  deterministicUuid,
  type PreparedLegacyVendor,
  prepareVendorMigration,
  PRAYAGRAJ_TENANT_ID,
  resolveVendorMigration,
  type VendorDatabaseResolution,
} from '../src/migrations/legacy/vendor-import'
import { toCsv } from '../src/migrations/legacy/csv'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const defaultSource = join(
  scriptDirectory,
  'legacy-migration-input-prayagraj',
  'vendor.csv',
)
const defaultOutput = join(scriptDirectory, 'vendor-migration-output-prayagraj')

function argumentsForMigration() {
  const args = process.argv.slice(2)
  const option = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  return {
    apply: args.includes('--apply'),
    sourcePath: resolve(option('--source') ?? defaultSource),
    outputPath: resolve(option('--output') ?? defaultOutput),
    tenantId: option('--tenant-id'),
    confirmedTenantId: option('--confirm-tenant'),
    confirmedSourceSha: option('--confirm-source-sha'),
  }
}

async function writeReports(
  outputPath: string,
  sourcePath: string,
  prepared: ReturnType<typeof prepareVendorMigration>,
  resolutions: VendorDatabaseResolution[],
  apply: boolean,
) {
  await mkdir(outputPath, { recursive: true })
  const resolutionByLegacyId = new Map(
    resolutions.map((row) => [row.legacyId, row]),
  )
  const mappings = [
    ...prepared.ownCompanyMappings.map((row) => [
      row.legacyId,
      row.legacyVendorId,
      row.name,
      '',
      'OWN',
      'OWN_COMPANY_MAPPING',
    ]),
    ...prepared.accepted.map((row) => [
      row.legacy.legacyId,
      row.legacy.legacyVendorId,
      row.name,
      resolutionByLegacyId.get(row.legacy.legacyId)?.targetId ?? '',
      'VENDOR',
      resolutionByLegacyId.get(row.legacy.legacyId)?.action ?? 'NOT_CHECKED',
    ]),
  ]
  const databaseConflicts = resolutions.filter(
    (row) => row.action === 'CONFLICT',
  )
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    tenantId: PRAYAGRAJ_TENANT_ID,
    sourcePath,
    sourceSha256: prepared.sourceSha256,
    sourceRows: prepared.sourceRows,
    ownCompanyRows: prepared.ownCompanyMappings.length,
    proposedExternalVendors: prepared.accepted.length,
    vendorsToCreate: resolutions.filter((row) => row.action === 'CREATE')
      .length,
    existingVendorsReused: resolutions.filter(
      (row) => row.action === 'REUSE_EXISTING',
    ).length,
    exactPreviouslyImportedVendors: resolutions.filter(
      (row) => row.action === 'EXISTING_EXACT',
    ).length,
    databaseConflicts: databaseConflicts.length,
    rejectedRows: prepared.rejected.length,
    duplicateKeyGroups: prepared.duplicates.length,
    mappingCoverage:
      prepared.accepted.length +
      prepared.ownCompanyMappings.length +
      prepared.rejected.length,
    readyForApply:
      prepared.rejected.length === 0 &&
      prepared.duplicates.length === 0 &&
      databaseConflicts.length === 0,
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
          expectedTenantId: PRAYAGRAJ_TENANT_ID,
        },
        null,
        2,
      )}\n`,
    ),
    writeFile(
      join(outputPath, 'vendor-id-map.csv'),
      toCsv([
        [
          'legacy_id',
          'legacy_vendor_id',
          'source_name',
          'new_vendor_uuid',
          'ownership_type',
          'migration_action',
        ],
        ...mappings,
      ]),
    ),
    writeFile(
      join(outputPath, 'rejected-records.csv'),
      toCsv([
        ['row_number', 'legacy_id', 'legacy_vendor_id', 'reason'],
        ...prepared.rejected.map((row) => [
          row.rowNumber,
          row.legacyId,
          row.legacyVendorId,
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
      join(outputPath, 'database-conflicts.csv'),
      toCsv([
        [
          'legacy_id',
          'legacy_vendor_id',
          'prepared_uuid',
          'matched_target_uuid',
          'reason',
        ],
        ...databaseConflicts.map((row) => [
          row.legacyId,
          row.legacyVendorId,
          row.preparedId,
          row.targetId,
          row.reason,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'preserved-legacy-fields.csv'),
      toCsv([
        [
          'legacy_id',
          'legacy_vendor_id',
          'address',
          'joined_on',
          'total_vehicles',
          'priority',
          'preservation',
        ],
        ...prepared.accepted.map((row) => [
          row.legacy.legacyId,
          row.legacy.legacyVendorId,
          row.legacy.address,
          row.legacy.joinedOn,
          row.legacy.totalVehicles,
          row.legacy.priority,
          'TENANT_AUDIT_LOG_AND_SOURCE_REPORT',
        ]),
      ]),
    ),
  ])
  return summary
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

async function databasePreflight(
  tenantId: string,
  prepared: ReturnType<typeof prepareVendorMigration>,
) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required for preflight')
  const databaseConfig = new URL(databaseUrl)
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
      password: databaseConfig.password,
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

  const [existing, actor] = await Promise.all([
    prisma.vendor.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        vendorCode: true,
        name: true,
        recordType: true,
        category: true,
        rating: true,
        phone: true,
        city: true,
        status: true,
      },
    }),
    prisma.tenantUser.findFirst({
      where: { tenantId, isPrimaryOwner: true },
      select: { id: true },
    }),
  ])
  return {
    prisma,
    actorId: actor?.id ?? null,
    resolutions: resolveVendorMigration(
      prepared,
      existing.map((row) => ({ ...row, rating: Number(row.rating) })),
    ),
  }
}

async function applyMigration(
  prisma: PrismaClient,
  tenantId: string,
  prepared: ReturnType<typeof prepareVendorMigration>,
  resolutions: VendorDatabaseResolution[],
  actorId: string | null,
) {
  const resolutionByLegacyId = new Map(
    resolutions.map((row) => [row.legacyId, row]),
  )
  const newRows: PreparedLegacyVendor[] = prepared.accepted.filter(
    (row) => resolutionByLegacyId.get(row.legacy.legacyId)?.action === 'CREATE',
  )
  await prisma.$transaction(
    async (transaction) => {
      if (newRows.length)
        await transaction.vendor.createMany({
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
              `Missing target mapping for ${row.legacy.legacyVendorId}`,
            )
          return {
            id: deterministicUuid(
              `old-vendor-audit:${tenantId}:${row.legacy.legacyId}:${resolution.targetId}`,
            ),
            tenantId,
            actorUserId: actorId,
            module: 'VENDOR_MIGRATION',
            action:
              resolution.action === 'REUSE_EXISTING' ? 'LINK_LEGACY' : 'IMPORT',
            referenceId: resolution.targetId,
            newValues: {
              ...row.legacy,
              targetVendorId: resolution.targetId,
              migrationAction: resolution.action,
            } as unknown as Prisma.InputJsonValue,
            remarks: 'Imported from legacy MySQL vendor CSV',
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
  const verified = await prisma.vendor.count({
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
  const options = argumentsForMigration()
  if (!options.tenantId)
    throw new Error(`Pass --tenant-id ${PRAYAGRAJ_TENANT_ID}`)
  if (options.tenantId !== PRAYAGRAJ_TENANT_ID)
    throw new Error(`This importer only permits tenant ${PRAYAGRAJ_TENANT_ID}`)
  if (options.apply && options.confirmedTenantId !== options.tenantId)
    throw new Error(`Apply requires --confirm-tenant ${options.tenantId}`)

  const source = await readFile(options.sourcePath, 'utf8')
  const prepared = prepareVendorMigration(source, options.tenantId)
  const preflight = await databasePreflight(options.tenantId, prepared)
  try {
    const summary = await writeReports(
      options.outputPath,
      options.sourcePath,
      prepared,
      preflight.resolutions,
      options.apply,
    )
    console.log(JSON.stringify(summary, null, 2))
    if (!options.apply) return
    if (
      prepared.rejected.length ||
      prepared.duplicates.length ||
      preflight.resolutions.some((row) => row.action === 'CONFLICT')
    )
      throw new Error('Apply refused: vendor dry-run reports contain errors')
    if (options.confirmedSourceSha !== prepared.sourceSha256)
      throw new Error(
        `Apply requires --confirm-source-sha ${prepared.sourceSha256}`,
      )
    console.log(
      JSON.stringify(
        await applyMigration(
          preflight.prisma,
          options.tenantId,
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
