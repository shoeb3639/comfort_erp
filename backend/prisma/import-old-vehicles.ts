import 'dotenv/config'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../src/generated/prisma/client'
import { toCsv } from '../src/migrations/legacy/csv'
import {
  type PreparedLegacyVehicle,
  prepareVehicleMigration,
  parseVendorMappings,
  resolveVehicleMigration,
  type VehicleDatabaseResolution,
} from '../src/migrations/legacy/vehicle-import'
import {
  deterministicUuid,
  PRAYAGRAJ_TENANT_ID,
} from '../src/migrations/legacy/vendor-import'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const defaultSource = join(
  scriptDirectory,
  'legacy-migration-input-prayagraj',
  'vehicles.csv',
)
const defaultVendorMap = join(
  scriptDirectory,
  'vendor-migration-output-prayagraj',
  'vendor-id-map.csv',
)
const defaultOutput = join(
  scriptDirectory,
  'vehicle-migration-output-prayagraj',
)

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
  prepared: ReturnType<typeof prepareVehicleMigration>,
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
  const [mappedVendors, existingVehicles, vehicleTypes, actor] =
    await Promise.all([
      prisma.vendor.findMany({
        where: { tenantId, id: { in: mappedVendorIds }, deletedAt: null },
        select: { id: true },
      }),
      prisma.vehicle.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          vehicleCode: true,
          registrationNumber: true,
          ownershipType: true,
          vendorId: true,
          make: true,
          model: true,
          status: true,
          vehicleType: { select: { name: true } },
        },
      }),
      prisma.vehicleType.findMany({
        where: { tenantId },
        select: { id: true, name: true },
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
    vehicleTypes,
    resolutions: resolveVehicleMigration(
      prepared,
      existingVehicles.map((row) => ({
        ...row,
        vehicleTypeName: row.vehicleType.name,
      })),
    ),
  }
}

async function writeReports(
  outputPath: string,
  sourcePath: string,
  vendorMapPath: string,
  prepared: ReturnType<typeof prepareVehicleMigration>,
  resolutions: VehicleDatabaseResolution[],
  existingTypeNames: string[],
  apply: boolean,
) {
  await mkdir(outputPath, { recursive: true })
  const resolutionByLegacyId = new Map(
    resolutions.map((row) => [row.legacyId, row]),
  )
  const conflicts = resolutions.filter((row) => row.action === 'CONFLICT')
  const requiredTypes = [
    ...new Set(prepared.accepted.map((row) => row.vehicleTypeName)),
  ]
  const existingTypes = new Set(existingTypeNames.map(normalize))
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    tenantId: PRAYAGRAJ_TENANT_ID,
    sourcePath,
    vendorMapPath,
    sourceSha256: prepared.sourceSha256,
    sourceRows: prepared.sourceRows,
    proposedVehicles: prepared.accepted.length,
    ownVehicles: prepared.accepted.filter((row) => row.ownershipType === 'OWN')
      .length,
    vendorVehicles: prepared.accepted.filter(
      (row) => row.ownershipType === 'VENDOR',
    ).length,
    vehiclesToCreate: resolutions.filter((row) => row.action === 'CREATE')
      .length,
    existingVehiclesReused: resolutions.filter(
      (row) => row.action === 'REUSE_EXISTING',
    ).length,
    exactPreviouslyImportedVehicles: resolutions.filter(
      (row) => row.action === 'EXISTING_EXACT',
    ).length,
    vehicleTypesToCreate: requiredTypes.filter(
      (name) => !existingTypes.has(normalize(name)),
    ),
    inferredVehicleTypes: prepared.accepted.filter(
      (row) => row.legacy.inferredVehicleType,
    ).length,
    databaseConflicts: conflicts.length,
    rejectedRows: prepared.rejected.length,
    duplicateKeyGroups: prepared.duplicates.length,
    mappingCoverage: prepared.accepted.length + prepared.rejected.length,
    readyForApply:
      prepared.rejected.length === 0 &&
      prepared.duplicates.length === 0 &&
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
      join(outputPath, 'vehicle-id-map.csv'),
      toCsv([
        [
          'legacy_id',
          'legacy_vendor_id',
          'registration_number',
          'new_vehicle_uuid',
          'ownership_type',
          'migration_action',
        ],
        ...prepared.accepted.map((row) => [
          row.legacy.legacyId,
          row.legacy.legacyVendorId,
          row.registrationNumber,
          resolutionByLegacyId.get(row.legacy.legacyId)?.targetId ?? '',
          row.ownershipType,
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
          'registration_number',
          'reason',
        ],
        ...prepared.rejected.map((row) => [
          row.rowNumber,
          row.legacyId,
          row.legacyVendorId,
          row.registrationNumber,
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
        ['legacy_id', 'prepared_uuid', 'matched_target_uuid', 'reason'],
        ...conflicts.map((row) => [
          row.legacyId,
          row.preparedId,
          row.targetId,
          row.reason,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'inferred-values.csv'),
      toCsv([
        [
          'legacy_id',
          'vehicle_name',
          'source_vehicle_type',
          'resolved_vehicle_type',
          'inferred',
        ],
        ...prepared.accepted.map((row) => [
          row.legacy.legacyId,
          row.legacy.sourceVehicleName,
          row.legacy.sourceVehicleType,
          row.vehicleTypeName,
          row.legacy.inferredVehicleType,
        ]),
      ]),
    ),
  ])
  return summary
}

async function applyMigration(
  prisma: PrismaClient,
  tenantId: string,
  prepared: ReturnType<typeof prepareVehicleMigration>,
  resolutions: VehicleDatabaseResolution[],
  existingTypes: Array<{ id: string; name: string }>,
  actorId: string | null,
) {
  const resolutionByLegacyId = new Map(
    resolutions.map((row) => [row.legacyId, row]),
  )
  const typeIds = new Map(
    existingTypes.map((row) => [normalize(row.name), row.id]),
  )
  const requiredTypes = new Map(
    prepared.accepted.map((row) => [
      normalize(row.vehicleTypeName),
      row.vehicleTypeName,
    ]),
  )
  for (const [normalizedName] of requiredTypes) {
    if (!typeIds.has(normalizedName))
      typeIds.set(
        normalizedName,
        deterministicUuid(`old-vehicle-types:${tenantId}:${normalizedName}`),
      )
  }
  const newTypes = [...typeIds.entries()]
    .filter(([, id]) => !existingTypes.some((row) => row.id === id))
    .map(([name, id]) => ({ id, tenantId, name: requiredTypes.get(name)! }))
  const newRows: PreparedLegacyVehicle[] = prepared.accepted.filter(
    (row) => resolutionByLegacyId.get(row.legacy.legacyId)?.action === 'CREATE',
  )
  await prisma.$transaction(
    async (transaction) => {
      if (newTypes.length)
        await transaction.vehicleType.createMany({ data: newTypes })
      if (newRows.length)
        await transaction.vehicle.createMany({
          data: newRows.map(({ legacy: _legacy, vehicleTypeName, ...row }) => ({
            ...row,
            vehicleTypeId: typeIds.get(normalize(vehicleTypeName))!,
            createdById: actorId,
            updatedById: actorId,
          })),
        })
      await transaction.tenantAuditLog.createMany({
        data: prepared.accepted.map((row) => {
          const resolution = resolutionByLegacyId.get(row.legacy.legacyId)
          if (!resolution?.targetId)
            throw new Error(
              `Missing target mapping for vehicle ${row.legacy.legacyId}`,
            )
          return {
            id: deterministicUuid(
              `old-vehicle-audit:${tenantId}:${row.legacy.legacyId}:${resolution.targetId}`,
            ),
            tenantId,
            actorUserId: actorId,
            module: 'VEHICLE_MIGRATION',
            action:
              resolution.action === 'REUSE_EXISTING' ? 'LINK_LEGACY' : 'IMPORT',
            referenceId: resolution.targetId,
            newValues: {
              ...row.legacy,
              targetVehicleId: resolution.targetId,
              targetVendorId: row.vendorId,
              migrationAction: resolution.action,
            } as unknown as Prisma.InputJsonValue,
            remarks: 'Imported from legacy MySQL vehicle CSV',
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
  const verified = await prisma.vehicle.count({
    where: { tenantId, id: { in: targetIds } },
  })
  if (verified !== new Set(targetIds).size)
    throw new Error(
      `Post-import verification failed: ${verified}/${new Set(targetIds).size}`,
    )
  return {
    inserted: newRows.length,
    reused: resolutions.filter((row) => row.action === 'REUSE_EXISTING').length,
    vehicleTypesInserted: newTypes.length,
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
  const prepared = prepareVehicleMigration(
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
      preflight.vehicleTypes.map((row) => row.name),
      selected.apply,
    )
    console.log(JSON.stringify(summary, null, 2))
    if (!selected.apply) return
    if (
      prepared.rejected.length ||
      prepared.duplicates.length ||
      preflight.resolutions.some((row) => row.action === 'CONFLICT')
    )
      throw new Error('Apply refused: vehicle dry-run reports contain errors')
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
          preflight.vehicleTypes,
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
