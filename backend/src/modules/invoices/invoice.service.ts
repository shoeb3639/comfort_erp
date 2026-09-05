import { Prisma } from '../../generated/prisma/client'
import { AppError } from '../../shared/errors/app-error'
import type { PageRequest } from '../../shared/pagination'
import { pageResult } from '../../shared/pagination'
import { toTitleCase } from '../../shared/text/title-case'
import type { Context } from '../bookings/booking.types'
import * as repository from './invoice.repository'

type InvoiceRecord = NonNullable<Awaited<ReturnType<typeof repository.find>>>

export interface InvoiceInput {
  bookingId?: string | null
  customerId: string
  invoiceDate: Date
  gstType: 'NO_GST' | 'CGST_SGST' | 'IGST'
  billingName: string
  billingAddress: string
  customerGstin?: string | null
  referenceNumber?: string | null
  billingType?: string | null
  billingContact?: string | null
  billingMobile?: string | null
  billingEmail?: string | null
  vehicleDescription?: string | null
  serviceCity?: string | null
  placeOfSupply?: string | null
  hsnCode?: string | null
  paymentTerms?: string | null
  terms?: string | null
  displaySnapshot?: Prisma.InputJsonValue | null
  items: Array<{
    dateType: string
    serviceDate?: Date | null
    serviceStartDate?: Date | null
    serviceEndDate?: Date | null
    description: string
    quantity: number
    unit: string
    rate: number
    amount?: number
  }>
}

export function mapInvoice(invoice: InvoiceRecord) {
  const bank = invoice.tenant.bankAccounts[0]
  const gst = invoice.tenant.gstRegistrations[0]
  return {
    ...(invoice.displaySnapshot &&
    typeof invoice.displaySnapshot === 'object' &&
    !Array.isArray(invoice.displaySnapshot)
      ? invoice.displaySnapshot
      : {}),
    id: invoice.id,
    invoice_source: invoice.bookingId ? 'booking' : 'direct',
    invoiceSource: invoice.bookingId ? 'booking' : 'direct',
    invoiceNumber:
      invoice.invoiceNumber ||
      `Draft • ${invoice.booking?.bookingNumber || invoice.id.slice(0, 8)}`,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    bookingId: invoice.booking?.bookingNumber || '',
    booking_id: invoice.bookingId,
    bookingRecordId: invoice.bookingId,
    billingCustomer: invoice.billingName,
    billingName: invoice.billingName,
    billingAddress: invoice.billingAddress,
    customerGstin: invoice.customerGstin,
    customerId: invoice.customerId,
    billing_customer_id: invoice.customerId,
    referenceNumber: invoice.referenceNumber,
    billingType: invoice.billingType,
    billingContact: invoice.billingContact,
    traveller: invoice.billingContact,
    mobileNumber: invoice.billingMobile,
    email: invoice.billingEmail,
    vehicle:
      invoice.vehicleDescription || invoice.booking?.requestedVehicleType || '',
    serviceCity: invoice.serviceCity || invoice.booking?.serviceCity || '',
    placeOfSupply: invoice.placeOfSupply,
    hsnCode: invoice.hsnCode,
    paymentTerms: invoice.paymentTerms,
    terms: invoice.terms,
    invoiceStatus: toTitleCase(invoice.status),
    status: toTitleCase(invoice.status),
    gstType:
      invoice.gstType === 'CGST_SGST'
        ? 'CGST + SGST'
        : invoice.gstType === 'IGST'
          ? 'IGST'
          : 'No GST',
    items: invoice.items.map((item) => ({
      id: item.id,
      dateType: item.dateType,
      serviceDate: item.serviceDate?.toISOString().slice(0, 10) || '',
      serviceStartDate: item.serviceStartDate?.toISOString().slice(0, 10) || '',
      serviceEndDate: item.serviceEndDate?.toISOString().slice(0, 10) || '',
      description: item.description,
      qty: Number(item.quantity),
      quantity: Number(item.quantity),
      unit: item.unit,
      rate: Number(item.rate),
      amount: Number(item.amount),
    })),
    totals: {
      subtotal: Number(invoice.subtotal),
      taxableAmount: Number(invoice.taxableAmount),
      cgst: Number(invoice.cgstAmount),
      sgst: Number(invoice.sgstAmount),
      igst: Number(invoice.igstAmount),
      totalTax: Number(invoice.totalGst),
      totalGst: Number(invoice.totalGst),
      netPayable: Number(invoice.netPayable),
    },
    companyDetails: {
      name: invoice.tenant.tradeName || invoice.tenant.legalName,
      address: [
        invoice.tenant.addressLine1,
        invoice.tenant.addressLine2,
        invoice.tenant.city,
        invoice.tenant.state,
        invoice.tenant.pinCode,
      ]
        .filter(Boolean)
        .join(', '),
      website: invoice.tenant.website,
      mobile: invoice.tenant.mobile,
      gstNumber: gst?.gstin || invoice.tenant.gstin,
    },
    bankDetails: bank
      ? {
          accountName: bank.accountName,
          accountNumber: bank.accountNumber,
          bankName: bank.bankName,
          ifscCode: bank.ifscCode,
          upiId: bank.upiId,
        }
      : null,
    generatedAt: invoice.generatedAt?.toISOString() ?? null,
    cancelledAt: invoice.cancelledAt?.toISOString() ?? null,
    cancellationReason: invoice.cancellationReason,
  }
}

export async function list(
  context: Context,
  filters: { search?: string; status?: string; source?: string } & PageRequest,
) {
  const [records, total] = await repository.list(context.tenantId, filters)
  return pageResult(records.map(mapInvoice), total, filters)
}

export async function get(context: Context, invoiceId: string) {
  const invoice = await repository.find(context.tenantId, invoiceId)
  if (!invoice) throw new AppError('Invoice was not found', 'NOT_FOUND', 404)
  return mapInvoice(invoice)
}

function optional(value: string | null | undefined) {
  return value?.trim() || null
}

export function calculateInvoiceAmounts(input: InvoiceInput) {
  const items = input.items.map((item, index) => {
    const amount = item.amount ?? item.quantity * item.rate
    if (Math.abs(amount - item.quantity * item.rate) > 0.01)
      throw new AppError(
        `Invoice item ${index + 1} amount must equal quantity × rate`,
        'INVALID_INVOICE_AMOUNT',
        400,
      )
    return { ...item, amount }
  })
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const taxableAmount = Math.max(0, subtotal)
  const cgstAmount = input.gstType === 'CGST_SGST' ? taxableAmount * 0.025 : 0
  const sgstAmount = input.gstType === 'CGST_SGST' ? taxableAmount * 0.025 : 0
  const igstAmount = input.gstType === 'IGST' ? taxableAmount * 0.05 : 0
  const totalGst = cgstAmount + sgstAmount + igstAmount
  return {
    items,
    subtotal,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalGst,
    netPayable: taxableAmount + totalGst,
  }
}

export async function save(
  context: Context,
  invoiceId: string | null,
  input: InvoiceInput,
) {
  const [customer, booking] = await Promise.all([
    repository.findCustomer(context.tenantId, input.customerId),
    input.bookingId
      ? repository.findBooking(context.tenantId, input.bookingId)
      : null,
  ])
  if (!customer) throw new AppError('Customer was not found', 'NOT_FOUND', 404)
  if (input.bookingId && !booking)
    throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  if (booking && booking.customerId !== input.customerId)
    throw new AppError(
      'Booking and invoice customer do not match',
      'VALIDATION_ERROR',
      400,
    )
  const calculated = calculateInvoiceAmounts(input)
  try {
    const invoice = await repository.save(
      context.tenantId,
      context.userId,
      invoiceId,
      {
        tenantId: context.tenantId,
        bookingId: input.bookingId ?? null,
        customerId: input.customerId,
        invoiceDate: input.invoiceDate,
        gstType: input.gstType,
        billingName: input.billingName.trim(),
        billingAddress: input.billingAddress.trim(),
        customerGstin: optional(input.customerGstin),
        referenceNumber: optional(input.referenceNumber),
        billingType: optional(input.billingType),
        billingContact: optional(input.billingContact),
        billingMobile: optional(input.billingMobile),
        billingEmail: optional(input.billingEmail),
        vehicleDescription: optional(input.vehicleDescription),
        serviceCity: optional(input.serviceCity),
        placeOfSupply: optional(input.placeOfSupply),
        hsnCode: optional(input.hsnCode),
        paymentTerms: optional(input.paymentTerms),
        terms: optional(input.terms),
        displaySnapshot: input.displaySnapshot ?? Prisma.JsonNull,
        subtotal: calculated.subtotal,
        taxableAmount: calculated.taxableAmount,
        cgstAmount: calculated.cgstAmount,
        sgstAmount: calculated.sgstAmount,
        igstAmount: calculated.igstAmount,
        totalGst: calculated.totalGst,
        netPayable: calculated.netPayable,
        createdById: context.userId,
        updatedById: context.userId,
      },
      calculated.items.map((item, index) => ({
        dateType: item.dateType,
        serviceDate: item.serviceDate ? new Date(item.serviceDate) : null,
        serviceStartDate: item.serviceStartDate
          ? new Date(item.serviceStartDate)
          : null,
        serviceEndDate: item.serviceEndDate
          ? new Date(item.serviceEndDate)
          : null,
        description: item.description.trim(),
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        amount: item.amount,
        sortOrder: index,
      })),
    )
    if (!invoice)
      throw new AppError(
        'Invoice cannot be edited in its current status',
        'INVALID_INVOICE_STATUS',
        409,
      )
    return mapInvoice(invoice)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new AppError(
        'This booking already has an invoice',
        'INVOICE_ALREADY_EXISTS',
        409,
      )
    throw error
  }
}

export async function options(context: Context) {
  const [customers, bookings, vehicles, drivers, tenant] =
    await repository.options(context.tenantId)
  return {
    customers,
    bookings,
    vehicles,
    drivers,
    settings: tenant
      ? {
          prefix: tenant.invoicePrefix || 'INV',
          hsnCode:
            typeof tenant.invoiceSettings === 'object' &&
            tenant.invoiceSettings &&
            !Array.isArray(tenant.invoiceSettings) &&
            'hsnCode' in tenant.invoiceSettings
              ? typeof tenant.invoiceSettings.hsnCode === 'string'
                ? tenant.invoiceSettings.hsnCode
                : ''
              : '996601',
          terms:
            typeof tenant.invoiceSettings === 'object' &&
            tenant.invoiceSettings &&
            !Array.isArray(tenant.invoiceSettings) &&
            'terms' in tenant.invoiceSettings
              ? typeof tenant.invoiceSettings.terms === 'string'
                ? tenant.invoiceSettings.terms
                : ''
              : '',
          placeOfSupply: tenant.state || '',
          logoUrl: tenant.logoUrl || '',
          companyDetails: {
            name: tenant.tradeName || tenant.legalName,
            address: [
              tenant.addressLine1,
              tenant.addressLine2,
              tenant.city,
              tenant.state,
              tenant.pinCode,
            ]
              .filter(Boolean)
              .join(', '),
            website: tenant.website || '',
            mobile: tenant.mobile,
            gstNumber: tenant.gstRegistrations[0]?.gstin || tenant.gstin || '',
            category: 'Car Rental',
          },
          bankDetails: tenant.bankAccounts[0]
            ? {
                accountName: tenant.bankAccounts[0].accountName,
                accountNumber: tenant.bankAccounts[0].accountNumber,
                bankName: tenant.bankAccounts[0].bankName,
                ifscCode: tenant.bankAccounts[0].ifscCode,
                upiId: tenant.bankAccounts[0].upiId,
              }
            : null,
        }
      : null,
  }
}

export async function cancel(
  context: Context,
  invoiceId: string,
  reason: string,
) {
  const invoice = await repository.cancel(
    context.tenantId,
    invoiceId,
    context.userId,
    reason.trim(),
  )
  if (!invoice)
    throw new AppError(
      'Only a generated invoice can be cancelled',
      'INVALID_INVOICE_STATUS',
      409,
    )
  return mapInvoice(invoice)
}

export async function generate(context: Context, invoiceId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const invoice = await repository.generate(
        context.tenantId,
        invoiceId,
        context.userId,
      )
      if (!invoice)
        throw new AppError(
          'Only a draft invoice can be generated',
          'INVOICE_NOT_DRAFT',
          409,
        )
      return mapInvoice(invoice)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      )
        continue
      if (error instanceof Error && error.message === 'INVALID_INVOICE_PREFIX')
        throw new AppError(
          'Invoice prefix must contain 1 to 3 uppercase letters.',
          'INVALID_INVOICE_PREFIX',
          400,
        )
      throw error
    }
  }
  throw new AppError(
    'Invoice number allocation conflicted; please retry',
    'INVOICE_NUMBER_CONFLICT',
    409,
  )
}
