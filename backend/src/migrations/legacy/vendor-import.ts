import { createHash } from 'node:crypto'
import { toTitleCase } from '../../shared/text/title-case'
import { clean, parseCsv } from './csv'

export const PRAYAGRAJ_TENANT_ID = '1bf92e04-a9a5-445d-bad5-e889604feb05'
export const VENDOR_HEADERS = [
  'id',
  'vendor_id',
  'name',
  'mobile_no',
  'city',
  'address',
  'joined_on',
  'total_vehicles',
  'priority',
] as const

export interface LegacyVendorRow {
  id: string
  vendor_id: string
  name: string
  mobile_no: string
  city: string
  address: string
  joined_on: string
  total_vehicles: string
  priority: string
}

export interface PreparedLegacyVendor {
  id: string
  tenantId: string
  vendorCode: string
  name: string
  recordType: 'external_vendor'
  category: 'Fleet'
  rating: number
  phone: string
  city: string
  status: 'ACTIVE'
  createdAt: Date
  updatedAt: Date
  legacy: {
    sourceTable: 'vendor'
    legacyId: string
    legacyVendorId: string
    address: string | null
    joinedOn: string | null
    totalVehicles: number
    priority: number | null
  }
}

export interface VendorRejection {
  rowNumber: number
  legacyId: string
  legacyVendorId: string
  reason: string
}

export interface VendorDuplicate {
  field: 'id' | 'vendor_id' | 'name_mobile'
  value: string
  rowNumbers: number[]
}

export interface OwnCompanyMapping {
  rowNumber: number
  legacyId: string
  legacyVendorId: string
  name: string
  ownershipType: 'OWN'
  targetVendorId: null
}

export interface PreparedVendorMigration {
  sourceSha256: string
  sourceRows: number
  accepted: PreparedLegacyVendor[]
  rejected: VendorRejection[]
  duplicates: VendorDuplicate[]
  ownCompanyMappings: OwnCompanyMapping[]
}

export interface ExistingVendorForMigration {
  id: string
  vendorCode: string
  name: string
  recordType: string
  category: string
  rating: number
  phone: string
  city: string
  status: string
}

export interface VendorDatabaseResolution {
  legacyId: string
  legacyVendorId: string
  preparedId: string
  targetId: string | null
  action: 'CREATE' | 'REUSE_EXISTING' | 'EXISTING_EXACT' | 'CONFLICT'
  reason: string | null
}

export function deterministicUuid(value: string) {
  const hex = createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, 32)
    .split('')
  hex[12] = '5'
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16] ?? '0', 16) % 4] ?? '8'
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}

function normalizedName(value: string) {
  return clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function samePreparedVendor(
  prepared: PreparedLegacyVendor,
  existing: ExistingVendorForMigration,
) {
  return (
    normalizedName(prepared.vendorCode) ===
      normalizedName(existing.vendorCode) &&
    normalizedName(prepared.name) === normalizedName(existing.name) &&
    prepared.recordType === existing.recordType &&
    normalizedName(prepared.category) === normalizedName(existing.category) &&
    prepared.rating === existing.rating &&
    prepared.phone === existing.phone &&
    normalizedName(prepared.city) === normalizedName(existing.city) &&
    prepared.status === existing.status
  )
}

function normalizedPhone(value: string) {
  return clean(value).replace(/\D/g, '')
}

function joinedAt(value: string) {
  const cleaned = clean(value)
  if (!cleaned) return null
  const dayFirst = cleaned.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/)
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const parsed = dayFirst
    ? new Date(`${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}T00:00:00.000Z`)
    : iso
      ? new Date(`${cleaned}T00:00:00.000Z`)
      : new Date(Number.NaN)
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !==
      (dayFirst ? `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}` : cleaned)
    ? null
    : parsed
}

function duplicateValues(
  rows: Array<{ row: LegacyVendorRow; rowNumber: number }>,
  field: 'id' | 'vendor_id',
) {
  const rowNumbers = new Map<string, number[]>()
  for (const item of rows) {
    const value = clean(item.row[field]).toUpperCase()
    if (!value) continue
    rowNumbers.set(value, [...(rowNumbers.get(value) ?? []), item.rowNumber])
  }
  return [...rowNumbers.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([value, values]) => ({ field, value, rowNumbers: values }))
}

function duplicateNaturalVendors(
  rows: Array<{ row: LegacyVendorRow; rowNumber: number }>,
) {
  const rowNumbers = new Map<string, number[]>()
  for (const item of rows) {
    const value = `${normalizedName(item.row.name)}|${normalizedPhone(item.row.mobile_no)}`
    if (value === '|') continue
    rowNumbers.set(value, [...(rowNumbers.get(value) ?? []), item.rowNumber])
  }
  return [...rowNumbers.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([value, values]) => ({
      field: 'name_mobile' as const,
      value,
      rowNumbers: values,
    }))
}

function rejectionReason(row: LegacyVendorRow) {
  const legacyId = clean(row.id)
  const vendorCode = clean(row.vendor_id).toUpperCase()
  const name = clean(row.name)
  const phone = normalizedPhone(row.mobile_no)
  const city = clean(row.city)
  const totalVehicles = Number(clean(row.total_vehicles))
  const priority = clean(row.priority)
  if (!legacyId) return 'MISSING_LEGACY_ID'
  if (!vendorCode || vendorCode.length > 50) return 'INVALID_VENDOR_ID'
  if (name.length < 2 || name.length > 200) return 'INVALID_NAME'
  if (phone.length < 8 || phone.length > 30) return 'INVALID_PHONE'
  if (city.length < 2 || city.length > 100) return 'INVALID_CITY'
  if (
    !Number.isInteger(totalVehicles) ||
    totalVehicles < 0 ||
    !Number.isFinite(totalVehicles)
  )
    return 'INVALID_TOTAL_VEHICLES'
  if (clean(row.joined_on) && !joinedAt(row.joined_on))
    return 'INVALID_JOINED_ON'
  if (priority && (!Number.isInteger(Number(priority)) || Number(priority) < 0))
    return 'INVALID_PRIORITY'
  return null
}

function isOwnCompany(row: LegacyVendorRow) {
  return normalizedName(row.name) === 'COMFORT CARS'
}

export function prepareVendorMigration(
  source: string,
  tenantId: string,
): PreparedVendorMigration {
  if (tenantId !== PRAYAGRAJ_TENANT_ID)
    throw new Error(
      `Vendor source is approved only for Prayagraj tenant ${PRAYAGRAJ_TENANT_ID}`,
    )

  const rawRecords = parseCsv(source.replace(/^\uFEFF/, ''))
  const headers = rawRecords.shift()
  if (!headers || headers.join('|') !== VENDOR_HEADERS.join('|'))
    throw new Error(
      `Unexpected vendor CSV headers. Expected: ${VENDOR_HEADERS.join(', ')}`,
    )

  const sourceRows = rawRecords
    .filter((values) => values.some((value) => clean(value)))
    .map((values, index) => ({
      rowNumber: index + 2,
      row: Object.fromEntries(
        VENDOR_HEADERS.map((header, valueIndex) => [
          header,
          values[valueIndex] ?? '',
        ]),
      ) as unknown as LegacyVendorRow,
    }))
  const duplicates = [
    ...duplicateValues(sourceRows, 'id'),
    ...duplicateValues(sourceRows, 'vendor_id'),
    ...duplicateNaturalVendors(sourceRows),
  ]
  const duplicateRows = new Set(
    duplicates.flatMap((duplicate) => duplicate.rowNumbers),
  )
  const rejected: VendorRejection[] = []
  const accepted: PreparedLegacyVendor[] = []
  const ownCompanyMappings: OwnCompanyMapping[] = []

  for (const item of sourceRows) {
    const reason = rejectionReason(item.row)
    if (reason || duplicateRows.has(item.rowNumber)) {
      rejected.push({
        rowNumber: item.rowNumber,
        legacyId: clean(item.row.id),
        legacyVendorId: clean(item.row.vendor_id).toUpperCase(),
        reason: reason ?? 'DUPLICATE_SOURCE_KEY',
      })
      continue
    }
    if (isOwnCompany(item.row)) {
      ownCompanyMappings.push({
        rowNumber: item.rowNumber,
        legacyId: clean(item.row.id),
        legacyVendorId: clean(item.row.vendor_id).toUpperCase(),
        name: toTitleCase(item.row.name),
        ownershipType: 'OWN',
        targetVendorId: null,
      })
      continue
    }

    const legacyId = clean(item.row.id)
    const legacyVendorId = clean(item.row.vendor_id).toUpperCase()
    const sourceJoinedAt = joinedAt(item.row.joined_on)
    const createdAt = sourceJoinedAt ?? new Date('1970-01-01T00:00:00.000Z')
    accepted.push({
      id: deterministicUuid(
        `old-vendors:${tenantId}:vendor:${legacyId}:${legacyVendorId}`,
      ),
      tenantId,
      vendorCode: legacyVendorId,
      name: toTitleCase(item.row.name),
      recordType: 'external_vendor',
      category: 'Fleet',
      rating: 0,
      phone: normalizedPhone(item.row.mobile_no),
      city: toTitleCase(item.row.city),
      status: 'ACTIVE',
      createdAt,
      updatedAt: createdAt,
      legacy: {
        sourceTable: 'vendor',
        legacyId,
        legacyVendorId,
        address: clean(item.row.address) || null,
        joinedOn: clean(item.row.joined_on) || null,
        totalVehicles: Number(clean(item.row.total_vehicles)),
        priority: clean(item.row.priority)
          ? Number(clean(item.row.priority))
          : null,
      },
    })
  }

  if (ownCompanyMappings.length > 1)
    throw new Error('More than one Comfort Cars own-company vendor was found')

  return {
    sourceSha256: createHash('sha256').update(source).digest('hex'),
    sourceRows: sourceRows.length,
    accepted,
    rejected,
    duplicates,
    ownCompanyMappings,
  }
}

export function resolveVendorMigration(
  prepared: PreparedVendorMigration,
  existing: ExistingVendorForMigration[],
): VendorDatabaseResolution[] {
  const byId = new Map(existing.map((row) => [row.id, row]))
  const byCode = new Map(
    existing.map((row) => [normalizedName(row.vendorCode), row]),
  )

  return prepared.accepted.map((row) => {
    const base = {
      legacyId: row.legacy.legacyId,
      legacyVendorId: row.legacy.legacyVendorId,
      preparedId: row.id,
    }
    const deterministicMatch = byId.get(row.id)
    if (deterministicMatch)
      return samePreparedVendor(row, deterministicMatch)
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

    const codeMatch = byCode.get(normalizedName(row.vendorCode))
    if (codeMatch)
      return {
        ...base,
        targetId: codeMatch.id,
        action: 'CONFLICT' as const,
        reason: 'VENDOR_CODE_ALREADY_USED',
      }

    const nameMatches = existing.filter(
      (candidate) =>
        normalizedName(candidate.name) === normalizedName(row.name),
    )
    const naturalMatches = nameMatches.filter(
      (candidate) => candidate.phone === row.phone,
    )
    if (naturalMatches.length === 1)
      return {
        ...base,
        targetId: naturalMatches[0]?.id ?? null,
        action: 'REUSE_EXISTING' as const,
        reason: null,
      }
    if (naturalMatches.length > 1)
      return {
        ...base,
        targetId: null,
        action: 'CONFLICT' as const,
        reason: 'MULTIPLE_NAME_AND_PHONE_MATCHES',
      }
    if (nameMatches.length)
      return {
        ...base,
        targetId: nameMatches[0]?.id ?? null,
        action: 'CONFLICT' as const,
        reason: 'NAME_MATCH_WITH_DIFFERENT_PHONE',
      }
    return {
      ...base,
      targetId: row.id,
      action: 'CREATE' as const,
      reason: null,
    }
  })
}
