import { createHash } from 'node:crypto'
import { toTitleCase } from '../../shared/text/title-case'
import { clean, parseCsv } from './csv'
import { deterministicUuid, PRAYAGRAJ_TENANT_ID } from './vendor-import'

export const VEHICLE_HEADERS = [
  'id',
  'vendor_id',
  'vendor_name',
  'vehicle_name',
  'vehicle_type',
  'vehicle_no',
] as const

export const VENDOR_MAP_HEADERS = [
  'legacy_id',
  'legacy_vendor_id',
  'source_name',
  'new_vendor_uuid',
  'ownership_type',
  'migration_action',
] as const

interface LegacyVehicleRow {
  id: string
  vendor_id: string
  vendor_name: string
  vehicle_name: string
  vehicle_type: string
  vehicle_no: string
}

export interface LegacyVendorMapping {
  legacyVendorId: string
  sourceName: string
  targetVendorId: string | null
  ownershipType: 'OWN' | 'VENDOR'
}

export interface PreparedLegacyVehicle {
  id: string
  tenantId: string
  ownershipType: 'OWN' | 'VENDOR'
  vendorId: string | null
  vehicleCode: string
  registrationNumber: string
  vehicleTypeName: string
  make: null
  model: string
  status: 'ACTIVE'
  createdAt: Date
  updatedAt: Date
  legacy: {
    sourceTable: 'vehicle'
    legacyId: string
    legacyVendorId: string
    sourceVendorName: string
    sourceVehicleName: string
    sourceVehicleType: string | null
    inferredVehicleType: boolean
  }
}

export interface VehicleRejection {
  rowNumber: number
  legacyId: string
  legacyVendorId: string
  registrationNumber: string
  reason: string
}

export interface VehicleDuplicate {
  field: 'id' | 'registration_number'
  value: string
  rowNumbers: number[]
}

export interface PreparedVehicleMigration {
  sourceSha256: string
  sourceRows: number
  accepted: PreparedLegacyVehicle[]
  rejected: VehicleRejection[]
  duplicates: VehicleDuplicate[]
}

export interface ExistingVehicleForMigration {
  id: string
  vehicleCode: string
  registrationNumber: string
  ownershipType: string
  vendorId: string | null
  vehicleTypeName: string
  make: string | null
  model: string | null
  status: string
}

export interface VehicleDatabaseResolution {
  legacyId: string
  preparedId: string
  targetId: string | null
  action: 'CREATE' | 'REUSE_EXISTING' | 'EXISTING_EXACT' | 'CONFLICT'
  reason: string | null
}

function normalizedText(value: string) {
  return clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeRegistration(value: string) {
  return clean(value)
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
}

function inferredType(vehicleName: string) {
  const name = normalizedText(vehicleName)
  if (name.includes('INNOVA')) return 'SUV'
  return null
}

function canonicalVehicleType(value: string) {
  return normalizedText(value) === 'SUV' ? 'SUV' : toTitleCase(value)
}

export function parseVendorMappings(source: string) {
  const records = parseCsv(source.replace(/^\uFEFF/, ''))
  const headers = records.shift()
  if (!headers || headers.join('|') !== VENDOR_MAP_HEADERS.join('|'))
    throw new Error(
      `Unexpected vendor mapping headers. Expected: ${VENDOR_MAP_HEADERS.join(', ')}`,
    )

  const mappings = new Map<string, LegacyVendorMapping>()
  for (const values of records.filter((row) =>
    row.some((value) => clean(value)),
  )) {
    const legacyVendorId = clean(values[1]).toUpperCase()
    const ownershipType = clean(values[4]).toUpperCase()
    const targetVendorId = clean(values[3]) || null
    if (
      !legacyVendorId ||
      (ownershipType !== 'OWN' && ownershipType !== 'VENDOR')
    )
      throw new Error(
        `Invalid vendor mapping for ${legacyVendorId || 'blank code'}`,
      )
    if (ownershipType === 'VENDOR' && !targetVendorId)
      throw new Error(`Vendor mapping ${legacyVendorId} has no target UUID`)
    if (mappings.has(legacyVendorId))
      throw new Error(`Duplicate vendor mapping ${legacyVendorId}`)
    mappings.set(legacyVendorId, {
      legacyVendorId,
      sourceName: clean(values[2]),
      targetVendorId,
      ownershipType,
    })
  }
  return mappings
}

function duplicateValues(
  rows: Array<{ row: LegacyVehicleRow; rowNumber: number }>,
  field: 'id' | 'registration_number',
) {
  const rowNumbers = new Map<string, number[]>()
  for (const item of rows) {
    const value =
      field === 'id'
        ? clean(item.row.id)
        : normalizeRegistration(item.row.vehicle_no)
    if (!value) continue
    rowNumbers.set(value, [...(rowNumbers.get(value) ?? []), item.rowNumber])
  }
  return [...rowNumbers.entries()]
    .filter(([, rowsForValue]) => rowsForValue.length > 1)
    .map(([value, rowsForValue]) => ({
      field,
      value,
      rowNumbers: rowsForValue,
    }))
}

function rejectionReason(
  row: LegacyVehicleRow,
  vendorMappings: Map<string, LegacyVendorMapping>,
) {
  const legacyId = clean(row.id)
  const legacyVendorId = clean(row.vendor_id).toUpperCase()
  const vehicleName = clean(row.vehicle_name)
  const registration = normalizeRegistration(row.vehicle_no)
  const mapping = vendorMappings.get(legacyVendorId)
  const type = clean(row.vehicle_type) || inferredType(vehicleName)
  if (!legacyId) return 'MISSING_LEGACY_ID'
  if (!legacyVendorId) return 'MISSING_VENDOR_ID'
  if (!mapping) return 'VENDOR_MAPPING_NOT_FOUND'
  if (
    mapping.sourceName &&
    normalizedText(mapping.sourceName) !== normalizedText(row.vendor_name)
  )
    return 'VENDOR_NAME_DOES_NOT_MATCH_MAPPING'
  if (vehicleName.length < 2 || vehicleName.length > 150)
    return 'INVALID_VEHICLE_NAME'
  if (!type || type.length < 2 || type.length > 100)
    return 'MISSING_VEHICLE_TYPE'
  if (registration.length < 6 || registration.length > 30)
    return 'INVALID_REGISTRATION_NUMBER'
  return null
}

export function prepareVehicleMigration(
  source: string,
  tenantId: string,
  vendorMappings: Map<string, LegacyVendorMapping>,
): PreparedVehicleMigration {
  if (tenantId !== PRAYAGRAJ_TENANT_ID)
    throw new Error(
      `Vehicle source is approved only for Prayagraj tenant ${PRAYAGRAJ_TENANT_ID}`,
    )
  const records = parseCsv(source.replace(/^\uFEFF/, ''))
  const headers = records.shift()
  if (!headers || headers.join('|') !== VEHICLE_HEADERS.join('|'))
    throw new Error(
      `Unexpected vehicle CSV headers. Expected: ${VEHICLE_HEADERS.join(', ')}`,
    )
  const sourceRows = records
    .filter((values) => values.some((value) => clean(value)))
    .map((values, index) => ({
      rowNumber: index + 2,
      row: Object.fromEntries(
        VEHICLE_HEADERS.map((header, valueIndex) => [
          header,
          values[valueIndex] ?? '',
        ]),
      ) as unknown as LegacyVehicleRow,
    }))
  const duplicates = [
    ...duplicateValues(sourceRows, 'id'),
    ...duplicateValues(sourceRows, 'registration_number'),
  ]
  const duplicateRows = new Set(
    duplicates.flatMap((duplicate) => duplicate.rowNumbers),
  )
  const accepted: PreparedLegacyVehicle[] = []
  const rejected: VehicleRejection[] = []

  for (const item of sourceRows) {
    const reason = rejectionReason(item.row, vendorMappings)
    if (reason || duplicateRows.has(item.rowNumber)) {
      rejected.push({
        rowNumber: item.rowNumber,
        legacyId: clean(item.row.id),
        legacyVendorId: clean(item.row.vendor_id).toUpperCase(),
        registrationNumber: normalizeRegistration(item.row.vehicle_no),
        reason: reason ?? 'DUPLICATE_SOURCE_REGISTRATION',
      })
      continue
    }
    const mapping = vendorMappings.get(clean(item.row.vendor_id).toUpperCase())!
    const legacyId = clean(item.row.id)
    const registrationNumber = normalizeRegistration(item.row.vehicle_no)
    const sourceType = clean(item.row.vehicle_type)
    const vehicleTypeName = canonicalVehicleType(
      sourceType || inferredType(item.row.vehicle_name)!,
    )
    const id = deterministicUuid(
      `old-vehicles:${tenantId}:vehicle:${legacyId}:${registrationNumber}`,
    )
    accepted.push({
      id,
      tenantId,
      ownershipType: mapping.ownershipType,
      vendorId: mapping.targetVendorId,
      vehicleCode: `VEH-${createHash('sha256').update(id).digest('hex').slice(0, 8).toUpperCase()}`,
      registrationNumber,
      vehicleTypeName,
      make: null,
      model: toTitleCase(item.row.vehicle_name),
      status: 'ACTIVE',
      createdAt: new Date('1970-01-01T00:00:00.000Z'),
      updatedAt: new Date('1970-01-01T00:00:00.000Z'),
      legacy: {
        sourceTable: 'vehicle',
        legacyId,
        legacyVendorId: mapping.legacyVendorId,
        sourceVendorName: clean(item.row.vendor_name),
        sourceVehicleName: clean(item.row.vehicle_name),
        sourceVehicleType: sourceType || null,
        inferredVehicleType: !sourceType,
      },
    })
  }
  return {
    sourceSha256: createHash('sha256').update(source).digest('hex'),
    sourceRows: sourceRows.length,
    accepted,
    rejected,
    duplicates,
  }
}

function sameVehicle(
  prepared: PreparedLegacyVehicle,
  existing: ExistingVehicleForMigration,
) {
  const existingModel = normalizedText(existing.model ?? '')
  const existingMakeAndModel = normalizedText(
    [existing.make, existing.model].filter(Boolean).join(' '),
  )
  return (
    prepared.registrationNumber ===
      normalizeRegistration(existing.registrationNumber) &&
    prepared.ownershipType === existing.ownershipType &&
    prepared.vendorId === existing.vendorId &&
    normalizedText(prepared.vehicleTypeName) ===
      normalizedText(existing.vehicleTypeName) &&
    (normalizedText(prepared.model) === existingModel ||
      normalizedText(prepared.model) === existingMakeAndModel) &&
    prepared.status === existing.status
  )
}

export function resolveVehicleMigration(
  prepared: PreparedVehicleMigration,
  existing: ExistingVehicleForMigration[],
): VehicleDatabaseResolution[] {
  const byId = new Map(existing.map((row) => [row.id, row]))
  const byRegistration = new Map<string, ExistingVehicleForMigration[]>()
  for (const row of existing) {
    const key = normalizeRegistration(row.registrationNumber)
    byRegistration.set(key, [...(byRegistration.get(key) ?? []), row])
  }
  return prepared.accepted.map((row) => {
    const base = { legacyId: row.legacy.legacyId, preparedId: row.id }
    const deterministicMatch = byId.get(row.id)
    if (deterministicMatch)
      return sameVehicle(row, deterministicMatch)
        ? {
            ...base,
            targetId: deterministicMatch.id,
            action: 'EXISTING_EXACT' as const,
            reason: null,
          }
        : {
            ...base,
            targetId: deterministicMatch.id,
            action: 'CONFLICT' as const,
            reason: 'DETERMINISTIC_ID_CONTENT_MISMATCH',
          }
    const registrationMatches = byRegistration.get(row.registrationNumber) ?? []
    if (
      registrationMatches.length === 1 &&
      sameVehicle(row, registrationMatches[0]!)
    )
      return {
        ...base,
        targetId: registrationMatches[0]!.id,
        action: 'REUSE_EXISTING' as const,
        reason: null,
      }
    if (registrationMatches.length)
      return {
        ...base,
        targetId: registrationMatches[0]?.id ?? null,
        action: 'CONFLICT' as const,
        reason:
          registrationMatches.length > 1
            ? 'MULTIPLE_REGISTRATION_MATCHES'
            : 'REGISTRATION_ALREADY_USED_BY_DIFFERENT_VEHICLE',
      }
    return {
      ...base,
      targetId: row.id,
      action: 'CREATE' as const,
      reason: null,
    }
  })
}
