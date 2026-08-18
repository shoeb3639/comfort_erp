import 'dotenv/config'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRAYAGRAJ_TENANT_ID = '1bf92e04-a9a5-445d-bad5-e889604feb05'
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const defaultSource = join(scriptDirectory, 'old_customer_records.csv')
const defaultOutput = join(scriptDirectory, 'customer-migration-output')
const gstinPattern = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/

interface CompanyOverride {
  name: string
  gstin: string | null
  aliases: string[]
  groupKey?: string
}

const companyOverrides: CompanyOverride[] = [
  {
    name: 'Xomox Sanmar Limited',
    gstin: '33AAACX0247K1ZG',
    aliases: ['XOMOX SANMAR LTD'],
  },
  {
    name: 'Chemplast Sanmar Limited',
    gstin: '33AAACC3000F1ZN',
    aliases: [
      'CHEMPLAST CUDDALORE VINYLS LTD',
      'CHEMPLAST CUDDALORE VINYLS SANMAR LTD',
      'CHEMPLAST CUDDALORE VINYLS SANMAR LTD 33AAACK2576L1ZF',
    ],
  },
  {
    name: 'Flowserve Sanmar Private Limited',
    gstin: '33AAACD2238A1ZI',
    aliases: ['FLOWSERVE SANMAR LTD', 'FLOWSERVE SANMAR PVT LTD'],
  },
  {
    name: 'Anderson Greenwood Crosby Sanmar Limited',
    gstin: '33AAACT7409H1ZH',
    aliases: [
      'ANDERSON GREENWOOD CROSBY SANMAR',
      'ANDERSON GREENWOOD CROSBY SANMAR LTD',
      'ANDERSON GREENWOOD CROSSBY SANMAR LTD',
    ],
  },
  {
    name: 'BS&B Safety Systems (India) Limited',
    gstin: '33AAACB1438Q1ZN',
    aliases: [
      'BS B SAFETY SYSTEMS',
      'BS B SAFETY SYSTEMS I LTD',
      'BS B SAFETY SYSTEMS INDIA LTD',
    ],
  },
  {
    name: 'Asian Paints Ltd',
    gstin: '09AAACA3622L1ZT',
    aliases: ['ASIAN PAINTS LTD'],
  },
  {
    name: 'BIT Air Travels Pvt. Ltd.',
    gstin: null,
    aliases: ['BITS BANGLORE'],
  },
  {
    name: 'Swapnodeep Travels Private Limited',
    gstin: null,
    aliases: ['SWAPNODEEP TRAVEL', 'SWAPNODEEP TRAVELS'],
    groupKey: 'NAME:SWAPNODEEP TRAVELS',
  },
]

const excludedCompanyNames = new Set([
  'TRIPKARTZ',
  'SHARIQUE VENDOR',
  'SUNIL MANOCHA',
  'HOTEL WELCOME ITC',
])
const excludedIndividualNames = new Set(['SHARIQUE VENDOR'])
interface LegacyRow {
  id: string
  customer_id: string
  name: string
  mobile_no: string
  email: string
  company_name: string
  address_1: string
  address_2: string
  gst_no: string
}

interface PreparedRow extends LegacyRow {
  rowNumber: number
  normalizedPhone: string
  normalizedEmail: string | null
  normalizedGstin: string | null
  validGstin: string | null
  address: string | null
  salutation: 'MR' | 'MS' | null
  personName: string
  companyKey: string | null
  associationMethod: 'EXPLICIT_COMPANY' | 'LEGACY_CUSTOMER_ID' | null
}

function parseCsv(source: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (character === '"') quoted = false
      else value += character
    } else if (character === '"') quoted = true
    else if (character === ',') {
      record.push(value)
      value = ''
    } else if (character === '\n') {
      record.push(value.replace(/\r$/, ''))
      records.push(record)
      record = []
      value = ''
    } else value += character
  }
  if (value || record.length) {
    record.push(value.replace(/\r$/, ''))
    records.push(record)
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field')
  return records
}

function csv(rows: Array<Array<string | number | null>>): string {
  return `${rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\n')}\n`
}

function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ')
}

function normalizedName(value: string): string {
  return clean(value)
    .toUpperCase()
    .replace(/\bPRIVATE\b/g, 'PVT')
    .replace(/\bLIMITED\b/g, 'LTD')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(
      /(^|[\s./&()-])([a-z])/g,
      (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`,
    )
}

function person(value: string) {
  const cleaned = clean(value)
  const match = cleaned.match(/^(mr|mr\.|mrs|mrs\.|ms|ms\.|miss)\s+(.+)$/i)
  if (!match) return { salutation: null, name: titleCase(cleaned) } as const
  const prefix = match[1]?.toLowerCase()
  return {
    salutation:
      prefix === 'mr' || prefix === 'mr.' ? ('MR' as const) : ('MS' as const),
    name: titleCase(match[2] ?? cleaned),
  }
}

function deterministicUuid(value: string): string {
  const hex = createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, 32)
    .split('')
  hex[12] = '5'
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16] ?? '0', 16) % 4] ?? '8'
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}

function customerCode(prefix: string, value: string): string {
  const slug =
    normalizedName(value).replaceAll(' ', '-').slice(0, 28) || 'UNKNOWN'
  const hash = createHash('sha256')
    .update(`${prefix}:${value}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase()
  return `LEGACY-${slug}-${hash}`
}

function preferred(values: string[]): string | null {
  const frequencies = new Map<string, number>()
  for (const raw of values.map(clean).filter(Boolean)) {
    frequencies.set(raw, (frequencies.get(raw) ?? 0) + 1)
  }
  return (
    [...frequencies.entries()].sort(
      ([left, leftCount], [right, rightCount]) =>
        rightCount - leftCount ||
        right.length - left.length ||
        left.localeCompare(right),
    )[0]?.[0] ?? null
  )
}

function editDistance(left: string, right: string): number {
  const previous = [...Array(right.length + 1).keys()]
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length] ?? 0
}

function samePerson(left: PreparedRow, right: PreparedRow): boolean {
  if (!left.normalizedPhone || left.normalizedPhone !== right.normalizedPhone)
    return false
  const leftName = normalizedName(left.personName)
  const rightName = normalizedName(right.personName)
  const leftCompact = leftName.replaceAll(' ', '')
  const rightCompact = rightName.replaceAll(' ', '')
  if (
    leftCompact === rightCompact ||
    editDistance(leftCompact, rightCompact) <= 2
  )
    return true
  const leftTokens = new Set(leftName.split(' '))
  const rightTokens = new Set(rightName.split(' '))
  const commonTokens = [...leftTokens].filter((token) => rightTokens.has(token))
  return (
    commonTokens.length >= 2 &&
    (commonTokens.length === leftTokens.size ||
      commonTokens.length === rightTokens.size)
  )
}

function deduplicatePeople(group: PreparedRow[]) {
  const unique: PreparedRow[] = []
  const canonicalByLegacyId = new Map<string, PreparedRow>()
  for (const row of group) {
    const duplicate = unique.find((candidate) => samePerson(candidate, row))
    if (duplicate) canonicalByLegacyId.set(row.id, duplicate)
    else {
      unique.push(row)
      canonicalByLegacyId.set(row.id, row)
    }
  }
  const namesByPhone = new Map<string, Set<string>>()
  for (const row of unique) {
    if (!row.normalizedPhone) continue
    const names = namesByPhone.get(row.normalizedPhone) ?? new Set<string>()
    names.add(normalizedName(row.personName))
    namesByPhone.set(row.normalizedPhone, names)
  }
  return {
    unique,
    canonicalByLegacyId,
    duplicateCount: group.length - unique.length,
    sharedPhoneCount: [...namesByPhone.values()].filter(
      (names) => names.size > 1,
    ).length,
  }
}

function overrideGroupKey(override: CompanyOverride): string {
  return override.groupKey ?? `OVERRIDE:${normalizedName(override.name)}`
}

async function prepare() {
  const args = process.argv.slice(2)
  const option = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  const apply = args.includes('--apply')
  const allowRejected = args.includes('--allow-rejected')
  const sourcePath = resolve(option('--source') ?? defaultSource)
  const outputPath = resolve(option('--output') ?? defaultOutput)
  const tenantId = option('--tenant-id')
  if (!tenantId)
    throw new Error(
      `Pass --tenant-id ${PRAYAGRAJ_TENANT_ID} to target the Prayagraj tenant`,
    )
  if (tenantId !== PRAYAGRAJ_TENANT_ID)
    throw new Error(
      `This CSV is approved only for Prayagraj tenant ${PRAYAGRAJ_TENANT_ID}`,
    )
  if (apply && option('--confirm-tenant') !== tenantId) {
    throw new Error(`Apply requires --confirm-tenant ${tenantId}`)
  }

  const source = await readFile(sourcePath, 'utf8')
  const sourceSha256 = createHash('sha256').update(source).digest('hex')
  const rawRecords = parseCsv(source)
  const headers = rawRecords.shift()
  const expected = [
    'id',
    'customer_id',
    'name',
    'mobile_no',
    'email',
    'company_name',
    'address_1',
    'address_2',
    'gst_no',
  ]
  if (!headers || headers.join('|') !== expected.join('|')) {
    throw new Error(`Unexpected CSV headers. Expected: ${expected.join(', ')}`)
  }
  const legacyRows = rawRecords.map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? '']),
    ),
  ) as unknown as LegacyRow[]

  const companyGstins = new Map<string, Set<string>>()
  const overrideByAlias = new Map<string, CompanyOverride>()
  for (const override of companyOverrides) {
    for (const alias of override.aliases) {
      overrideByAlias.set(normalizedName(alias), override)
    }
  }
  for (const row of legacyRows) {
    const company = normalizedName(row.company_name)
    const gstin = clean(row.gst_no).toUpperCase().replace(/\s/g, '')
    if (company && gstinPattern.test(gstin)) {
      const values = companyGstins.get(company) ?? new Set<string>()
      values.add(gstin)
      companyGstins.set(company, values)
    }
  }

  const prepared: PreparedRow[] = legacyRows.map((row, index) => {
    const company = normalizedName(row.company_name)
    const gstin = clean(row.gst_no).toUpperCase().replace(/\s/g, '') || null
    const validGstin = gstin && gstinPattern.test(gstin) ? gstin : null
    const override = overrideByAlias.get(company)
    const knownGstins = companyGstins.get(company)
    const companyKey = company
      ? override
        ? overrideGroupKey(override)
        : knownGstins?.size === 1
          ? `GST:${[...knownGstins][0]}`
          : validGstin
            ? `GST:${validGstin}`
            : `NAME:${company}`
      : null
    const parsedPerson = person(row.name)
    const address =
      [clean(row.address_1), clean(row.address_2)].filter(Boolean).join(', ') ||
      null
    return {
      ...row,
      rowNumber: index + 2,
      normalizedPhone: clean(row.mobile_no).replace(/\D/g, ''),
      normalizedEmail: clean(row.email).toLowerCase() || null,
      normalizedGstin: gstin,
      validGstin,
      address,
      salutation: parsedPerson.salutation,
      personName: parsedPerson.name,
      companyKey,
      associationMethod: companyKey ? 'EXPLICIT_COMPANY' : null,
    }
  })

  const rejected = prepared.filter(
    (row) =>
      !row.id ||
      !row.customer_id ||
      row.personName.length < 2 ||
      row.normalizedPhone.length < 8,
  )
  const excluded = prepared.filter((row) => {
    const company = normalizedName(row.company_name)
    return company
      ? excludedCompanyNames.has(company)
      : excludedIndividualNames.has(normalizedName(row.personName))
  })
  const eligibleRows = prepared.filter(
    (row) => !rejected.includes(row) && !excluded.includes(row),
  )
  const companyKeysByLegacyCustomerId = new Map<string, Set<string>>()
  for (const row of eligibleRows) {
    if (!row.companyKey) continue
    const keys =
      companyKeysByLegacyCustomerId.get(row.customer_id) ?? new Set<string>()
    keys.add(row.companyKey)
    companyKeysByLegacyCustomerId.set(row.customer_id, keys)
  }
  const conflictingLegacyCustomerIds = new Map<string, string[]>(
    [...companyKeysByLegacyCustomerId.entries()]
      .filter(([, keys]) => keys.size > 1)
      .map(([legacyCustomerId, keys]) => [legacyCustomerId, [...keys]]),
  )
  for (const row of eligibleRows) {
    if (row.companyKey || conflictingLegacyCustomerIds.has(row.customer_id))
      continue
    const keys = companyKeysByLegacyCustomerId.get(row.customer_id)
    if (keys?.size === 1) {
      row.companyKey = [...keys][0] as string
      row.associationMethod = 'LEGACY_CUSTOMER_ID'
    }
  }
  const validRows = eligibleRows.filter(
    (row) => !conflictingLegacyCustomerIds.has(row.customer_id),
  )
  const associatedCorporateRows = validRows.filter(
    (row) => row.associationMethod === 'LEGACY_CUSTOMER_ID',
  )
  const companyGroups = new Map<string, PreparedRow[]>()
  for (const row of validRows.filter((item) => item.companyKey)) {
    const group = companyGroups.get(row.companyKey as string) ?? []
    group.push(row)
    companyGroups.set(row.companyKey as string, group)
  }

  const customers: Record<string, unknown>[] = []
  const contacts: Record<string, unknown>[] = []
  const travellers: Record<string, unknown>[] = []
  const mappings: Array<Array<string | null>> = []
  const migrationKey = `old-customers:${tenantId}`

  for (const [groupKey, group] of companyGroups) {
    const override = companyOverrides.find(
      (candidate) => overrideGroupKey(candidate) === groupKey,
    )
    const companyName =
      override?.name ??
      (preferred(group.map((row) => row.company_name)) as string)
    const customerId = deterministicUuid(`${migrationKey}:company:${groupKey}`)
    const code = customerCode('company', groupKey)
    const deduplicated = deduplicatePeople(group)
    const primary = deduplicated.unique[0] as PreparedRow
    customers.push({
      id: customerId,
      tenantId,
      customerCode: code,
      type: 'CORPORATE',
      salutation: null,
      name: titleCase(companyName),
      billingName: titleCase(companyName),
      email: preferred(group.map((row) => row.normalizedEmail ?? '')),
      phone: preferred(group.map((row) => row.normalizedPhone)) as string,
      city: null,
      gstin:
        override?.gstin ?? preferred(group.map((row) => row.validGstin ?? '')),
      billingAddress: preferred(group.map((row) => row.address ?? '')),
      creditLimit: 0,
      outstanding: 0,
      status: 'ACTIVE',
    })
    contacts.push({
      id: deterministicUuid(`${migrationKey}:contact:${customerId}`),
      tenantId,
      customerId,
      salutation: primary.salutation,
      name: primary.personName,
      role: 'Primary',
      phone: primary.normalizedPhone,
      email: primary.normalizedEmail,
      isPrimary: true,
    })
    const travellerIdByLegacyId = new Map<string, string>()
    for (const row of deduplicated.unique) {
      const travellerId = deterministicUuid(
        `${migrationKey}:traveller:${row.id}`,
      )
      travellerIdByLegacyId.set(row.id, travellerId)
      travellers.push({
        id: travellerId,
        tenantId,
        customerId,
        travellerType: 'Employee',
        salutation: row.salutation,
        name: row.personName,
        phone: row.normalizedPhone,
        email: row.normalizedEmail,
        notes: `Migrated from legacy customer row ${row.id}`,
        status: 'ACTIVE',
      })
    }
    for (const row of group) {
      const canonical = deduplicated.canonicalByLegacyId.get(
        row.id,
      ) as PreparedRow
      mappings.push([
        row.id,
        row.customer_id,
        customerId,
        code,
        travellerIdByLegacyId.get(canonical.id) as string,
        'CORPORATE',
        canonical.id === row.id ? '' : canonical.id,
        row.associationMethod,
      ])
    }
  }

  for (const row of validRows.filter((item) => !item.companyKey)) {
    const customerId = deterministicUuid(`${migrationKey}:individual:${row.id}`)
    const code = customerCode('individual', `${row.customer_id}:${row.id}`)
    customers.push({
      id: customerId,
      tenantId,
      customerCode: code,
      type: 'RETAIL',
      salutation: row.salutation,
      name: row.personName,
      billingName: row.personName,
      email: row.normalizedEmail,
      phone: row.normalizedPhone,
      city: null,
      gstin: row.validGstin,
      billingAddress: row.address,
      creditLimit: 0,
      outstanding: 0,
      status: 'ACTIVE',
    })
    contacts.push({
      id: deterministicUuid(`${migrationKey}:contact:${customerId}`),
      tenantId,
      customerId,
      salutation: row.salutation,
      name: row.personName,
      role: 'Primary',
      phone: row.normalizedPhone,
      email: row.normalizedEmail,
      isPrimary: true,
    })
    mappings.push([
      row.id,
      row.customer_id,
      customerId,
      code,
      null,
      'RETAIL',
      '',
      'INDIVIDUAL',
    ])
  }

  const reviews = [...companyGroups.entries()].map(([key, group]) => {
    const variants = [
      ...new Set(group.map((row) => clean(row.company_name)).filter(Boolean)),
    ]
    const invalidGstins = [
      ...new Set(
        group
          .map((row) => row.normalizedGstin)
          .filter((gstin) => gstin && !gstinPattern.test(gstin)),
      ),
    ]
    const deduplicated = deduplicatePeople(group)
    const override = companyOverrides.find(
      (candidate) => overrideGroupKey(candidate) === key,
    )
    const flags = [
      !override && variants.length > 1 ? 'NAME_VARIANTS' : '',
      !override && invalidGstins.length ? 'INVALID_GSTIN' : '',
      deduplicated.sharedPhoneCount ? 'SHARED_PHONE_REVIEW' : '',
    ].filter(Boolean)
    return [
      key,
      override?.name ?? preferred(group.map((row) => row.company_name)),
      group.length,
      variants.join(' | '),
      override?.gstin ?? '',
      invalidGstins.join(' | '),
      deduplicated.duplicateCount,
      deduplicated.sharedPhoneCount,
      flags.join(' | ') || 'READY',
    ]
  })

  await mkdir(outputPath, { recursive: true })
  await writeFile(
    join(outputPath, 'company-review.csv'),
    csv([
      [
        'group_key',
        'selected_company_name',
        'source_rows',
        'name_variants',
        'final_gstin',
        'invalid_source_gstins',
        'duplicates_removed',
        'shared_phones_to_review',
        'review_status',
      ],
      ...reviews,
    ]),
  )
  await writeFile(
    join(outputPath, 'legacy-id-map.csv'),
    csv([
      [
        'legacy_id',
        'legacy_customer_id',
        'new_customer_uuid',
        'new_customer_code',
        'new_traveller_uuid',
        'customer_type',
        'deduplicated_to_legacy_id',
        'association_method',
      ],
      ...mappings,
    ]),
  )
  await writeFile(
    join(outputPath, 'corporate-associations.csv'),
    csv([
      [
        'legacy_id',
        'legacy_customer_id',
        'person_name',
        'company_group_key',
        'selected_company_name',
        'association_method',
      ],
      ...associatedCorporateRows.map((row) => {
        const group = companyGroups.get(row.companyKey as string) ?? []
        const override = companyOverrides.find(
          (candidate) => overrideGroupKey(candidate) === row.companyKey,
        )
        return [
          row.id,
          row.customer_id,
          row.personName,
          row.companyKey,
          override?.name ?? preferred(group.map((item) => item.company_name)),
          row.associationMethod,
        ]
      }),
    ]),
  )
  await writeFile(
    join(outputPath, 'association-conflicts.csv'),
    csv([
      ['legacy_customer_id', 'company_group_keys', 'source_row_count'],
      ...[...conflictingLegacyCustomerIds.entries()].map(
        ([legacyCustomerId, keys]) => [
          legacyCustomerId,
          keys.join(' | '),
          eligibleRows.filter((row) => row.customer_id === legacyCustomerId)
            .length,
        ],
      ),
    ]),
  )
  await writeFile(
    join(outputPath, 'rejected-records.csv'),
    csv([
      ['row_number', 'legacy_id', 'legacy_customer_id', 'reason'],
      ...rejected.map((row) => [
        row.rowNumber,
        row.id,
        row.customer_id,
        !row.id
          ? 'MISSING_ID'
          : !row.customer_id
            ? 'MISSING_CUSTOMER_ID'
            : row.personName.length < 2
              ? 'INVALID_NAME'
              : 'INVALID_PHONE',
      ]),
    ]),
  )
  await writeFile(
    join(outputPath, 'excluded-records.csv'),
    csv([
      [
        'row_number',
        'legacy_id',
        'legacy_customer_id',
        'name',
        'company_name',
        'reason',
      ],
      ...excluded.map((row) => [
        row.rowNumber,
        row.id,
        row.customer_id,
        row.name,
        row.company_name,
        'OWNER_EXCLUDED',
      ]),
    ]),
  )
  if (mappings.length !== validRows.length)
    throw new Error(
      `Mapping coverage mismatch: ${mappings.length}/${validRows.length}`,
    )
  const mappedLegacyIds = mappings.map((row) => row[0] as string)
  if (new Set(mappedLegacyIds).size !== mappedLegacyIds.length)
    throw new Error('A legacy row was mapped more than once')
  const corporateMappingByLegacyId = new Map(
    mappings.map((row) => [row[0] as string, row[5] as string]),
  )
  if (
    associatedCorporateRows.some(
      (row) => corporateMappingByLegacyId.get(row.id) !== 'CORPORATE',
    )
  )
    throw new Error('A company-associated person was mapped as retail')

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    sourcePath,
    sourceSha256,
    outputPath,
    tenantId,
    sourceRows: prepared.length,
    acceptedRows: validRows.length,
    rejectedRows: rejected.length,
    excludedRows: excluded.length,
    associationConflictRows: eligibleRows.length - validRows.length,
    legacyCustomerIdsWithAssociationConflicts:
      conflictingLegacyCustomerIds.size,
    individualsPromotedToCorporate: associatedCorporateRows.length,
    proposedCustomers: customers.length,
    corporateCustomers: companyGroups.size,
    retailCustomers: customers.length - companyGroups.size,
    proposedTravellers: travellers.length,
    proposedContacts: contacts.length,
    duplicateCorporatePeopleRemoved: [...companyGroups.values()].reduce(
      (total, group) => total + deduplicatePeople(group).duplicateCount,
      0,
    ),
    companyGroupsNeedingReview: reviews.filter((row) => row[8] !== 'READY')
      .length,
    mappingCoverage: `${mappings.length}/${validRows.length}`,
  }
  await writeFile(
    join(outputPath, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  )
  console.log(JSON.stringify(summary, null, 2))

  if (!apply) return
  if (conflictingLegacyCustomerIds.size)
    throw new Error(
      'Apply refused: association-conflicts.csv must be resolved first',
    )
  if (rejected.length && !allowRejected)
    throw new Error(
      'Apply refused: rejected-records.csv is not empty; review it and pass --allow-rejected to skip those rows',
    )
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required for --apply')
  const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
    import('@prisma/adapter-pg'),
    import('../src/generated/prisma/client'),
  ])
  const databaseConfig = new URL(databaseUrl)
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
      password: databaseConfig.password,
    }),
  })
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, tradeName: true },
    })
    if (!tenant) throw new Error(`Tenant ${tenantId} does not exist`)
    const tenantName =
      `${tenant.tradeName ?? ''} ${tenant.legalName}`.toLowerCase()
    if (
      !tenantName.includes('comfort') ||
      !tenantName.includes('car') ||
      !tenantName.includes('prayagraj')
    ) {
      throw new Error(
        `Tenant identity check failed for ${tenant.tradeName ?? tenant.legalName}`,
      )
    }
    const ids = customers.map((item) => item.id as string)
    const codes = customers.map((item) => item.customerCode as string)
    const collisions = await prisma.customer.findMany({
      where: { tenantId, customerCode: { in: codes }, id: { notIn: ids } },
      select: { customerCode: true },
    })
    if (collisions.length)
      throw new Error(`Customer-code collision: ${collisions[0]?.customerCode}`)
    const auditRecords = customers.map((item) => ({
      id: deterministicUuid(`${migrationKey}:audit:${item.id as string}`),
      tenantId,
      actorUserId: null,
      module: 'CUSTOMER_MIGRATION',
      action: 'IMPORT',
      referenceId: item.id as string,
      remarks: 'Imported from old_customer_records.csv',
    }))
    await prisma.$transaction(
      async (transaction) => {
        await transaction.customer.createMany({
          data: customers as never[],
          skipDuplicates: true,
        })
        await transaction.customerContact.createMany({
          data: contacts as never[],
          skipDuplicates: true,
        })
        await transaction.customerTraveller.createMany({
          data: travellers as never[],
          skipDuplicates: true,
        })
        await transaction.tenantAuditLog.createMany({
          data: auditRecords,
          skipDuplicates: true,
        })
      },
      { timeout: 120_000 },
    )
    const imported = await prisma.customer.count({
      where: { tenantId, id: { in: ids } },
    })
    console.log(
      `Verified ${imported}/${customers.length} migrated customers for ${tenant.tradeName ?? tenant.legalName}`,
    )
    if (imported !== customers.length)
      throw new Error('Post-import customer count mismatch')
  } finally {
    await prisma.$disconnect()
  }
}

prepare().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
