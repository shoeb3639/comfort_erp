import { createHash } from 'node:crypto'
import { toTitleCase } from '../../shared/text/title-case'
import { clean, parseCsv } from './csv'
import type { LegacyVendorMapping } from './vehicle-import'
import { deterministicUuid, PRAYAGRAJ_TENANT_ID } from './vendor-import'

export const DRIVER_HEADERS = [
  'id',
  'vendor_id',
  'driver_name',
  'driver_no',
  'driver_address',
  'driver_al_no',
] as const

interface LegacyDriverRow {
  id: string
  vendor_id: string
  driver_name: string
  driver_no: string
  driver_address: string
  driver_al_no: string
}

export interface PreparedLegacyDriver {
  id: string
  tenantId: string
  engagementType: 'OWN' | 'VENDOR'
  vendorId: string | null
  driverCode: string
  salutation: null
  name: string
  mobile: string
  alternateMobile: string | null
  licenceNumber: null
  licenceType: null
  licenceExpiry: null
  address: string | null
  status: 'ACTIVE'
  createdAt: Date
  updatedAt: Date
  legacy: {
    sourceTable: 'driver'
    legacyId: string
    legacyVendorId: string
    sourceName: string
    sourceMobile: string
    sourceAlternateMobile: string | null
  }
}

export interface DriverRejection {
  rowNumber: number
  legacyId: string
  legacyVendorId: string
  name: string
  mobile: string
  reason: string
}

export interface DriverDuplicate {
  field: 'id' | 'name_mobile'
  value: string
  rowNumbers: number[]
}

export interface SharedDriverPhone {
  mobile: string
  drivers: Array<{ legacyId: string; name: string; legacyVendorId: string }>
}

export interface PreparedDriverMigration {
  sourceSha256: string
  sourceRows: number
  accepted: PreparedLegacyDriver[]
  rejected: DriverRejection[]
  duplicates: DriverDuplicate[]
  sharedPhones: SharedDriverPhone[]
}

export interface ExistingDriverForMigration {
  id: string
  driverCode: string
  engagementType: string
  vendorId: string | null
  name: string
  mobile: string
  status: string
}

export interface DriverDatabaseResolution {
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

export function normalizeDriverPhone(value: string) {
  return clean(value).replace(/\D/g, '')
}

function baseRejectionReason(
  row: LegacyDriverRow,
  vendorMappings: Map<string, LegacyVendorMapping>,
) {
  const legacyId = clean(row.id)
  const legacyVendorId = clean(row.vendor_id).toUpperCase()
  const name = clean(row.driver_name)
  const mobile = normalizeDriverPhone(row.driver_no)
  const alternateMobile = normalizeDriverPhone(row.driver_al_no)
  if (!legacyId) return 'MISSING_LEGACY_ID'
  if (!legacyVendorId) return 'MISSING_VENDOR_ID'
  if (!vendorMappings.has(legacyVendorId)) return 'VENDOR_MAPPING_NOT_FOUND'
  if (name.length < 2 || name.length > 150) return 'INVALID_NAME'
  if (mobile.length < 8 || mobile.length > 30) return 'INVALID_MOBILE'
  if (
    alternateMobile &&
    (alternateMobile.length < 8 || alternateMobile.length > 30)
  )
    return 'INVALID_ALTERNATE_MOBILE'
  if (clean(row.driver_address).length > 1000) return 'ADDRESS_TOO_LONG'
  return null
}

function duplicateGroups(
  rows: Array<{ row: LegacyDriverRow; rowNumber: number }>,
  field: 'id' | 'name_mobile',
) {
  const rowNumbers = new Map<string, number[]>()
  for (const item of rows) {
    const value =
      field === 'id'
        ? clean(item.row.id)
        : `${normalizedText(item.row.driver_name)}|${normalizeDriverPhone(item.row.driver_no)}`
    if (!value || value === '|') continue
    rowNumbers.set(value, [...(rowNumbers.get(value) ?? []), item.rowNumber])
  }
  return [...rowNumbers.entries()]
    .filter(([, groupedRows]) => groupedRows.length > 1)
    .map(([value, groupedRows]) => ({
      field,
      value,
      rowNumbers: groupedRows,
    }))
}

export function prepareDriverMigration(
  source: string,
  tenantId: string,
  vendorMappings: Map<string, LegacyVendorMapping>,
): PreparedDriverMigration {
  if (tenantId !== PRAYAGRAJ_TENANT_ID)
    throw new Error(
      `Driver source is approved only for Prayagraj tenant ${PRAYAGRAJ_TENANT_ID}`,
    )
  const records = parseCsv(source.replace(/^\uFEFF/, ''))
  const headers = records.shift()
  if (!headers || headers.join('|') !== DRIVER_HEADERS.join('|'))
    throw new Error(
      `Unexpected driver CSV headers. Expected: ${DRIVER_HEADERS.join(', ')}`,
    )
  const sourceRows = records
    .filter((values) => values.some((value) => clean(value)))
    .map((values, index) => ({
      rowNumber: index + 2,
      row: Object.fromEntries(
        DRIVER_HEADERS.map((header, valueIndex) => [
          header,
          values[valueIndex] ?? '',
        ]),
      ) as unknown as LegacyDriverRow,
    }))
  const baseReasons = new Map(
    sourceRows.map((item) => [
      item.rowNumber,
      baseRejectionReason(item.row, vendorMappings),
    ]),
  )
  const validCandidates = sourceRows.filter(
    (item) => !baseReasons.get(item.rowNumber),
  )
  const duplicates = [
    ...duplicateGroups(sourceRows, 'id'),
    ...duplicateGroups(validCandidates, 'name_mobile'),
  ]
  const duplicateRows = new Set(
    duplicates.flatMap((duplicate) => duplicate.rowNumbers),
  )
  const accepted: PreparedLegacyDriver[] = []
  const rejected: DriverRejection[] = []

  for (const item of sourceRows) {
    const baseReason = baseReasons.get(item.rowNumber)
    if (baseReason || duplicateRows.has(item.rowNumber)) {
      rejected.push({
        rowNumber: item.rowNumber,
        legacyId: clean(item.row.id),
        legacyVendorId: clean(item.row.vendor_id).toUpperCase(),
        name: clean(item.row.driver_name),
        mobile: normalizeDriverPhone(item.row.driver_no),
        reason: baseReason ?? 'DUPLICATE_SOURCE_DRIVER',
      })
      continue
    }
    const legacyId = clean(item.row.id)
    const legacyVendorId = clean(item.row.vendor_id).toUpperCase()
    const mapping = vendorMappings.get(legacyVendorId)!
    const id = deterministicUuid(
      `old-drivers:${tenantId}:driver:${legacyId}:${legacyVendorId}`,
    )
    const alternateMobile = normalizeDriverPhone(item.row.driver_al_no)
    accepted.push({
      id,
      tenantId,
      engagementType: mapping.ownershipType,
      vendorId: mapping.targetVendorId,
      driverCode: `DRV-${createHash('sha256').update(id).digest('hex').slice(0, 8).toUpperCase()}`,
      salutation: null,
      name: toTitleCase(item.row.driver_name),
      mobile: normalizeDriverPhone(item.row.driver_no),
      alternateMobile: alternateMobile || null,
      licenceNumber: null,
      licenceType: null,
      licenceExpiry: null,
      address: clean(item.row.driver_address)
        ? toTitleCase(item.row.driver_address)
        : null,
      status: 'ACTIVE',
      createdAt: new Date('1970-01-01T00:00:00.000Z'),
      updatedAt: new Date('1970-01-01T00:00:00.000Z'),
      legacy: {
        sourceTable: 'driver',
        legacyId,
        legacyVendorId,
        sourceName: clean(item.row.driver_name),
        sourceMobile: clean(item.row.driver_no),
        sourceAlternateMobile: clean(item.row.driver_al_no) || null,
      },
    })
  }

  const phones = new Map<string, PreparedLegacyDriver[]>()
  for (const row of accepted)
    phones.set(row.mobile, [...(phones.get(row.mobile) ?? []), row])
  const sharedPhones = [...phones.entries()]
    .filter(
      ([, rows]) =>
        new Set(rows.map((row) => normalizedText(row.name))).size > 1,
    )
    .map(([mobile, rows]) => ({
      mobile,
      drivers: rows.map((row) => ({
        legacyId: row.legacy.legacyId,
        name: row.name,
        legacyVendorId: row.legacy.legacyVendorId,
      })),
    }))

  return {
    sourceSha256: createHash('sha256').update(source).digest('hex'),
    sourceRows: sourceRows.length,
    accepted,
    rejected,
    duplicates,
    sharedPhones,
  }
}

function sameDriver(
  prepared: PreparedLegacyDriver,
  existing: ExistingDriverForMigration,
) {
  return (
    normalizedText(prepared.name) === normalizedText(existing.name) &&
    prepared.mobile === normalizeDriverPhone(existing.mobile) &&
    prepared.engagementType === existing.engagementType &&
    prepared.vendorId === existing.vendorId &&
    prepared.status === existing.status
  )
}

export function resolveDriverMigration(
  prepared: PreparedDriverMigration,
  existing: ExistingDriverForMigration[],
): DriverDatabaseResolution[] {
  const byId = new Map(existing.map((row) => [row.id, row]))
  const byCode = new Map(
    existing.map((row) => [normalizedText(row.driverCode), row]),
  )
  return prepared.accepted.map((row) => {
    const base = { legacyId: row.legacy.legacyId, preparedId: row.id }
    const deterministicMatch = byId.get(row.id)
    if (deterministicMatch)
      return sameDriver(row, deterministicMatch)
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
    const codeMatch = byCode.get(normalizedText(row.driverCode))
    if (codeMatch)
      return {
        ...base,
        targetId: codeMatch.id,
        action: 'CONFLICT' as const,
        reason: 'DRIVER_CODE_ALREADY_USED',
      }
    const naturalMatches = existing.filter(
      (candidate) =>
        normalizedText(candidate.name) === normalizedText(row.name) &&
        normalizeDriverPhone(candidate.mobile) === row.mobile,
    )
    const exactNaturalMatches = naturalMatches.filter((candidate) =>
      sameDriver(row, candidate),
    )
    if (exactNaturalMatches.length === 1)
      return {
        ...base,
        targetId: exactNaturalMatches[0]!.id,
        action: 'REUSE_EXISTING' as const,
        reason: null,
      }
    if (naturalMatches.length)
      return {
        ...base,
        targetId: naturalMatches[0]?.id ?? null,
        action: 'CONFLICT' as const,
        reason:
          naturalMatches.length > 1
            ? 'MULTIPLE_NAME_AND_MOBILE_MATCHES'
            : 'NAME_AND_MOBILE_LINKED_DIFFERENTLY',
      }
    return {
      ...base,
      targetId: row.id,
      action: 'CREATE' as const,
      reason: null,
    }
  })
}
