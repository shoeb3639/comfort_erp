import 'dotenv/config'
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../src/generated/prisma/client'
import { prepareInvoiceMigration } from '../src/migrations/legacy/invoice-import'
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
    confirmedSourceSha: option('--confirm-source-sha'),
    sourcePath: resolve(
      option('--source') ?? join(scriptDirectory, 'invoice.csv.zip'),
    ),
    outputPath: resolve(
      option('--output') ??
        join(scriptDirectory, 'invoice-migration-output-prayagraj'),
    ),
  }
}

async function readSource(path: string) {
  if (!path.toLowerCase().endsWith('.zip')) return readFile(path, 'utf8')
  return (
    await execFileAsync('unzip', ['-p', path], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    })
  ).stdout
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

async function preflight(tenantId: string, source: string) {
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
    throw new Error(
      `Tenant identity check failed for ${tenant.tradeName ?? tenant.legalName}`,
    )
  }
  const [actor, bookings, customers] = await Promise.all([
    prisma.tenantUser.findFirst({
      where: { tenantId, isPrimaryOwner: true },
      select: { id: true },
    }),
    prisma.booking.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, bookingNumber: true, customerId: true },
    }),
    prisma.customer.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, billingName: true, gstin: true },
    }),
  ])
  if (!actor) {
    await prisma.$disconnect()
    throw new Error('Primary-owner migration actor was not found')
  }
  const prepared = prepareInvoiceMigration(source, tenantId, {
    bookings,
    customers,
  })
  const [existingInvoices, existingCustomers] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        tenantId,
        OR: [
          { id: { in: prepared.accepted.map((row) => row.id) } },
          {
            invoiceNumber: {
              in: prepared.accepted.map((row) => row.invoiceNumber),
            },
          },
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        bookingId: true,
        customerId: true,
      },
    }),
    prisma.customer.findMany({
      where: {
        tenantId,
        id: { in: prepared.placeholders.map((row) => row.id) },
      },
      select: { id: true },
    }),
  ])
  const existingById = new Map(existingInvoices.map((row) => [row.id, row]))
  for (const row of prepared.accepted) {
    const existing = existingById.get(row.id)
    if (existing?.invoiceNumber === row.invoiceNumber) {
      row.bookingId = existing.bookingId
      row.customerId = existing.customerId
      row.legacy.customerResolution = 'EXISTING_IMPORTED_INVOICE'
    }
  }
  const conflicts = existingInvoices.filter(
    (existing) =>
      !prepared.accepted.some(
        (row) =>
          row.id === existing.id &&
          row.invoiceNumber === existing.invoiceNumber &&
          row.bookingId === existing.bookingId &&
          row.customerId === existing.customerId,
      ),
  )
  return {
    prisma,
    actorId: actor.id,
    prepared,
    existingInvoiceIds: new Set(existingInvoices.map((row) => row.id)),
    existingPlaceholderIds: new Set(existingCustomers.map((row) => row.id)),
    conflicts,
  }
}

async function reports(
  outputPath: string,
  sourcePath: string,
  apply: boolean,
  state: Awaited<ReturnType<typeof preflight>>,
) {
  await mkdir(outputPath, { recursive: true })
  const { prepared } = state
  const totalMismatches = prepared.accepted.filter(
    (row) =>
      Math.abs(row.legacy.sourceTotalAmount - row.legacy.sourceGrandTotal) >=
      0.01,
  )
  const adjustments = prepared.accepted.filter(
    (row) => Math.abs(row.legacy.reconciliationAdjustment) >= 0.01,
  )
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    tenantId: PRAYAGRAJ_TENANT_ID,
    sourcePath,
    sourceSha256: prepared.sourceSha256,
    sourceRows: prepared.sourceRows,
    invoicesPrepared: prepared.accepted.length,
    invoicesToCreate: prepared.accepted.filter(
      (row) => !state.existingInvoiceIds.has(row.id),
    ).length,
    existingInvoices: prepared.accepted.filter((row) =>
      state.existingInvoiceIds.has(row.id),
    ).length,
    linkedBookingInvoices: prepared.accepted.filter((row) => row.bookingId)
      .length,
    directInvoices: prepared.accepted.filter((row) => !row.bookingId).length,
    additionalBookingInvoicesImportedDirect: prepared.accepted.filter(
      (row) =>
        row.legacy.bookingResolution === 'ADDITIONAL_INVOICE_IMPORTED_DIRECT',
    ).length,
    compositeBookingReferencesImportedDirect: prepared.accepted.filter(
      (row) => row.legacy.bookingResolution === 'COMPOSITE_IMPORTED_DIRECT',
    ).length,
    unresolvedBookingReferencesImportedDirect: prepared.accepted.filter(
      (row) => row.legacy.bookingResolution === 'UNRESOLVED_IMPORTED_DIRECT',
    ).length,
    placeholderCustomers: prepared.placeholders.length,
    placeholderCustomersToCreate: prepared.placeholders.filter(
      (row) => !state.existingPlaceholderIds.has(row.id),
    ).length,
    rejectedRows: prepared.rejected.length,
    duplicateInvoiceRowsRemoved: prepared.rejected.filter(
      (row) => row.reason === 'DUPLICATE_INVOICE_NUMBER_REMOVED',
    ).length,
    sourceTotalMismatches: totalMismatches.length,
    reconciliationAdjustments: adjustments.length,
    databaseConflicts: state.conflicts.length,
    readyForApply:
      prepared.rejected.every(
        (row) => row.reason === 'DUPLICATE_INVOICE_NUMBER_REMOVED',
      ) && state.conflicts.length === 0,
  }
  await Promise.all([
    writeFile(
      join(outputPath, 'summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    ),
    writeFile(
      join(outputPath, 'source-manifest.json'),
      `${JSON.stringify({ sourcePath, sha256: prepared.sourceSha256, expectedTenantId: PRAYAGRAJ_TENANT_ID }, null, 2)}\n`,
    ),
    writeFile(
      join(outputPath, 'invoice-id-map.csv'),
      toCsv([
        [
          'legacy_id',
          'invoice_number',
          'new_invoice_uuid',
          'booking_uuid',
          'customer_uuid',
          'booking_resolution',
          'customer_resolution',
        ],
        ...prepared.accepted.map((row) => [
          row.legacy.id,
          row.invoiceNumber,
          row.id,
          row.bookingId,
          row.customerId,
          row.legacy.bookingResolution,
          row.legacy.customerResolution,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'rejected-records.csv'),
      toCsv([
        [
          'row_number',
          'legacy_id',
          'invoice_number',
          'booking_reference',
          'reason',
        ],
        ...prepared.rejected.map((row) => [
          row.rowNumber,
          row.legacyId,
          row.invoiceNumber,
          row.bookingReference,
          row.reason,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'placeholder-customers.csv'),
      toCsv([
        [
          'identity_key',
          'new_customer_uuid',
          'customer_code',
          'billing_name',
          'gstin',
        ],
        ...prepared.placeholders.map((row) => [
          row.identityKey,
          row.id,
          row.customerCode,
          row.billingName,
          row.gstin,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'direct-invoice-reasons.csv'),
      toCsv([
        [
          'legacy_id',
          'invoice_number',
          'source_booking_reference',
          'resolution',
        ],
        ...prepared.accepted
          .filter((row) => !row.bookingId)
          .map((row) => [
            row.legacy.id,
            row.invoiceNumber,
            row.legacy.booking_id,
            row.legacy.bookingResolution,
          ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'financial-mismatches.csv'),
      toCsv([
        [
          'legacy_id',
          'invoice_number',
          'source_total_amount',
          'json_grand_total',
          'difference',
        ],
        ...totalMismatches.map((row) => [
          row.legacy.id,
          row.invoiceNumber,
          row.legacy.sourceTotalAmount,
          row.legacy.sourceGrandTotal,
          row.legacy.sourceGrandTotal - row.legacy.sourceTotalAmount,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'reconciliation-adjustments.csv'),
      toCsv([
        ['legacy_id', 'invoice_number', 'taxable_amount', 'adjustment'],
        ...adjustments.map((row) => [
          row.legacy.id,
          row.invoiceNumber,
          row.taxableAmount,
          row.legacy.reconciliationAdjustment,
        ]),
      ]),
    ),
    writeFile(
      join(outputPath, 'database-conflicts.csv'),
      toCsv([
        [
          'existing_invoice_uuid',
          'invoice_number',
          'booking_uuid',
          'customer_uuid',
        ],
        ...state.conflicts.map((row) => [
          row.id,
          row.invoiceNumber,
          row.bookingId,
          row.customerId,
        ]),
      ]),
    ),
  ])
  return summary
}

async function applyMigration(
  tenantId: string,
  state: Awaited<ReturnType<typeof preflight>>,
) {
  const { prisma, prepared, actorId } = state
  const customers = prepared.placeholders.filter(
    (row) => !state.existingPlaceholderIds.has(row.id),
  )
  const invoices = prepared.accepted.filter(
    (row) => !state.existingInvoiceIds.has(row.id),
  )
  await prisma.$transaction(
    async (tx) => {
      if (customers.length)
        await tx.customer.createMany({
          data: customers.map(({ identityKey: _key, ...row }) => ({
            ...row,
            createdById: actorId,
            updatedById: actorId,
          })),
          skipDuplicates: true,
        })
      if (invoices.length)
        await tx.invoice.createMany({
          data: invoices.map(({ legacy: _legacy, items: _items, ...row }) => ({
            ...row,
            createdById: actorId,
            updatedById: actorId,
            generatedById: actorId,
          })),
        })
      const items = invoices.flatMap((row) => row.items)
      if (items.length) await tx.invoiceItem.createMany({ data: items })
      await tx.tenantAuditLog.createMany({
        data: [
          ...prepared.placeholders.map((row) => ({
            id: deterministicUuid(
              `old-invoice-placeholder-audit:${tenantId}:${row.identityKey}`,
            ),
            tenantId,
            actorUserId: actorId,
            module: 'INVOICE_MIGRATION',
            action: 'CREATE_PLACEHOLDER_CUSTOMER',
            referenceId: row.id,
            newValues: {
              identityKey: row.identityKey,
            } as Prisma.InputJsonValue,
            remarks:
              'Placeholder approved for unresolved legacy invoice customer',
          })),
          ...prepared.accepted.map((row) => ({
            id: deterministicUuid(
              `old-invoice-audit:${tenantId}:${row.legacy.id}`,
            ),
            tenantId,
            actorUserId: actorId,
            module: 'INVOICE_MIGRATION',
            action: 'IMPORT_GENERATED_INVOICE',
            referenceId: row.id,
            newValues: row.legacy as unknown as Prisma.InputJsonValue,
            remarks:
              'Imported from legacy MySQL invoice CSV with JSON grand total authoritative',
          })),
        ],
        skipDuplicates: true,
      })
    },
    { timeout: 180_000 },
  )
  const [invoiceCount, itemCount] = await Promise.all([
    prisma.invoice.count({
      where: { tenantId, id: { in: prepared.accepted.map((row) => row.id) } },
    }),
    prisma.invoiceItem.count({
      where: {
        tenantId,
        invoiceId: { in: prepared.accepted.map((row) => row.id) },
      },
    }),
  ])
  const expectedItems = prepared.accepted.reduce(
    (sum, row) => sum + row.items.length,
    0,
  )
  if (invoiceCount !== prepared.accepted.length || itemCount !== expectedItems)
    throw new Error(
      `Post-import reconciliation failed: invoices ${invoiceCount}/${prepared.accepted.length}, items ${itemCount}/${expectedItems}`,
    )
  return {
    placeholderCustomersInserted: customers.length,
    invoicesInserted: invoices.length,
    invoiceItemsInserted: invoices.reduce(
      (sum, row) => sum + row.items.length,
      0,
    ),
    verifiedInvoices: invoiceCount,
    verifiedInvoiceItems: itemCount,
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
  const source = await readSource(selected.sourcePath)
  const state = await preflight(selected.tenantId, source)
  try {
    const summary = await reports(
      selected.outputPath,
      selected.sourcePath,
      selected.apply,
      state,
    )
    console.log(JSON.stringify(summary, null, 2))
    if (!selected.apply) return
    if (!summary.readyForApply)
      throw new Error(
        'Apply refused: invoice dry-run contains unapproved errors or conflicts',
      )
    if (selected.confirmedSourceSha !== state.prepared.sourceSha256)
      throw new Error(
        `Apply requires --confirm-source-sha ${state.prepared.sourceSha256}`,
      )
    console.log(
      JSON.stringify(await applyMigration(selected.tenantId, state), null, 2),
    )
  } finally {
    await state.prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
