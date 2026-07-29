import { Prisma } from '../../generated/prisma/client'
import { AppError } from '../../shared/errors/app-error'
import { toTitleCase } from '../../shared/text/title-case'
import type { Context } from '../bookings/booking.service'
import * as repository from './invoice.repository'

type InvoiceRecord = NonNullable<Awaited<ReturnType<typeof repository.find>>>

function financialYear(date = new Date()) {
  const startYear =
    date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1
  return `${startYear}-${String(startYear + 1).slice(-2)}`
}

export function mapInvoice(invoice: InvoiceRecord) {
  const bank = invoice.tenant.bankAccounts[0]
  const gst = invoice.tenant.gstRegistrations[0]
  return {
    id: invoice.id,
    invoice_source: invoice.bookingId ? 'booking' : 'direct',
    invoiceSource: invoice.bookingId ? 'booking' : 'direct',
    invoiceNumber:
      invoice.invoiceNumber ||
      `Draft • ${invoice.booking?.bookingNumber || invoice.id.slice(0, 8)}`,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    bookingId: invoice.booking?.bookingNumber || '',
    billingCustomer: invoice.billingName,
    billingName: invoice.billingName,
    billingAddress: invoice.billingAddress,
    customerGstin: invoice.customerGstin,
    invoiceStatus: toTitleCase(invoice.status),
    status: toTitleCase(invoice.status),
    gstType:
      invoice.gstType === 'CGST_SGST'
        ? 'CGST + SGST'
        : invoice.gstType === 'IGST'
          ? 'IGST'
          : 'No GST',
    vehicle: invoice.booking?.requestedVehicleType || '',
    serviceCity: invoice.booking?.serviceCity || '',
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
  }
}

export async function list(
  context: Context,
  filters: { search?: string; status?: string },
) {
  return (await repository.list(context.tenantId, filters)).map(mapInvoice)
}

export async function get(context: Context, invoiceId: string) {
  const invoice = await repository.find(context.tenantId, invoiceId)
  if (!invoice) throw new AppError('Invoice was not found', 'NOT_FOUND', 404)
  return mapInvoice(invoice)
}

export async function generate(context: Context, invoiceId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const invoice = await repository.generate(
        context.tenantId,
        invoiceId,
        context.userId,
        financialYear(),
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
      throw error
    }
  }
  throw new AppError(
    'Invoice number allocation conflicted; please retry',
    'INVOICE_NUMBER_CONFLICT',
    409,
  )
}
