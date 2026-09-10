import { toTitleCase } from '../../shared/text/title-case'
import { BOOKING_STATUS_LABELS } from './booking.constants'
import type * as repository from './booking.repository'

type BookingRecord = NonNullable<Awaited<ReturnType<typeof repository.find>>>

function packageKm(bookingPackage: string) {
  return Number(bookingPackage.match(/\d+/g)?.at(-1) ?? 0)
}

export function mapBookingInvoice(
  invoice: BookingRecord['invoices'][number],
  booking?: BookingRecord,
) {
  return {
    id: invoice.id,
    invoice_source: 'booking',
    invoiceSource: 'booking',
    invoiceNumber: invoice.invoiceNumber || `Draft • ${booking?.bookingNumber}`,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    bookingId: booking?.bookingNumber || '',
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
    generatedAt: invoice.generatedAt?.toISOString() ?? null,
  }
}

export function mapBooking(record: BookingRecord | null) {
  if (!record) return null
  const closure = record.closure
  const invoice = record.invoices[0] ?? null
  const collections = record.collections.map((collection) => ({
    id: collection.id,
    collectionDate: collection.collectionDate.toISOString().slice(0, 10),
    amount: Number(collection.amount),
    paymentHolder: collection.paymentHolder,
    fuelAmount: Number(collection.fuelAmount),
    returnedAmount: Number(collection.returnedAmount),
    driverBalance:
      collection.paymentHolder === 'DRIVER'
        ? Math.round(
            (Number(collection.amount) -
              Number(collection.fuelAmount) -
              Number(collection.returnedAmount)) *
              100,
          ) / 100
        : 0,
    fuelReceipt: collection.fuelReceipt
      ? {
          id: collection.fuelReceipt.id,
          name: collection.fuelReceipt.originalFileName,
        }
      : null,
    paymentMode: collection.paymentMode.split('_').map(toTitleCase).join(' '),
    collectedBy: collection.collectedByName,
    receiverName: collection.receiverName,
    referenceNumber: collection.referenceNumber,
    remarks: collection.remarks,
    depositDate: collection.depositDate?.toISOString().slice(0, 10) ?? '',
    depositMode: collection.depositMode,
    depositReferenceNumber: collection.depositReferenceNumber,
    depositedBy: collection.depositedByName,
    verifiedBy: collection.verifiedByName,
    depositStatus: collection.status.split('_').map(toTitleCase).join(' '),
    verifiedAt: collection.verifiedAt?.toISOString() ?? null,
    createdAt: collection.createdAt.toISOString(),
  }))
  const totalBillAmount = closure ? Number(closure.totalBillAmount) : 0
  const totalCollected = collections.reduce(
    (total, collection) => total + collection.amount,
    0,
  )
  const verifiedAmount = record.collections
    .filter((collection) =>
      ['VERIFIED', 'DIRECTLY_RECEIVED'].includes(collection.status),
    )
    .reduce((total, collection) => total + Number(collection.amount), 0)
  const cashPendingDeposit = record.collections
    .filter(
      (collection) =>
        collection.paymentMode === 'CASH' &&
        collection.paymentHolder !== 'DRIVER' &&
        ['PENDING', 'WITH_MANAGER'].includes(collection.status),
    )
    .reduce((total, collection) => total + Number(collection.amount), 0)

  return {
    ...record,
    databaseId: record.id,
    id: record.bookingNumber || record.id,
    bookingId: record.id,
    customer_type: record.customer.type
      .split('_')
      .map((part) => toTitleCase(part))
      .join(' '),
    billing_customer_id: record.customerId,
    traveller_id: record.travellerId,
    customer: record.customer.billingName,
    travellerName: record.traveller?.name,
    customerPhone: record.traveller?.phone || record.customer.phone,
    booking_type: record.bookingType.toLowerCase(),
    duty_package: record.bookingPackage,
    dailyMinimumKm: record.bookingPackage?.startsWith('outstation_min_')
      ? packageKm(record.bookingPackage)
      : null,
    includedHours: record.bookingPackage?.startsWith('local_')
      ? Number(record.bookingPackage.split('_')[1])
      : null,
    includedKm: record.bookingPackage?.startsWith('local_')
      ? packageKm(record.bookingPackage)
      : null,
    trip_type: record.tripType.toLowerCase(),
    serviceCity: record.serviceCity,
    startDate: record.startDate.toISOString().slice(0, 10),
    endDate: record.endDate.toISOString().slice(0, 10),
    pickupDate: record.startDate.toISOString().slice(0, 10),
    pickupTime: record.pickupTime,
    reportingTime: record.pickupTime,
    travellingFrom: record.travellingFrom,
    travellingTo: record.travellingTo,
    pickupReportingAddress: record.pickupReportingAddress,
    routeStops: record.routeStops,
    packageDetails: record.packageDetails,
    requestedVehicleType: record.requestedVehicleType,
    assignmentType:
      record.assignmentSource === 'VENDOR' ? 'vendor_vehicle' : 'own_vehicle',
    assignment_type:
      record.assignmentSource === 'VENDOR' ? 'vendor_vehicle' : 'own_vehicle',
    vendorId: record.vendorId,
    vendor: record.vendor?.name || 'Unassigned',
    vehicleId: record.vehicleId,
    vehicleType:
      record.vehicle?.vehicleType.name || record.requestedVehicleType,
    vehicleRegistrationNo: record.vehicle?.registrationNumber || '',
    driverId: record.driverId,
    driver: record.driver?.name || 'Unassigned',
    driverNumber: record.driver?.mobile || '',
    billing_model: record.pricingBasis.toLowerCase(),
    pricing_basis: record.pricingBasis.toLowerCase(),
    customerRate: Number(record.customerRate),
    fixedAmount:
      record.pricingBasis === 'FIXED' ? Number(record.customerRate) : '',
    ratePerKm:
      record.pricingBasis === 'RATE_PER_KM' ? Number(record.customerRate) : '',
    amount: Number(record.customerRate),
    vendorRate: record.vendorRate === null ? '' : Number(record.vendorRate),
    vendorPayableAmount:
      record.vendorPayableAmount === null
        ? ''
        : Number(record.vendorPayableAmount),
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
    assignedAt: record.assignedAt?.toISOString() ?? null,
    dutyStartedAt: record.dutyStartedAt?.toISOString() ?? null,
    dutyCompletedAt: record.dutyCompletedAt?.toISOString() ?? null,
    openingOdometer:
      record.openingOdometer === null ? null : Number(record.openingOdometer),
    closingOdometer:
      record.closingOdometer === null ? null : Number(record.closingOdometer),
    dutyCompletionDetails: record.dutyCompletionDetails,
    requiredDutyDocuments: record.requiredDutyDocuments,
    actualDistance:
      record.openingOdometer !== null && record.closingOdometer !== null
        ? Number(record.closingOdometer) - Number(record.openingOdometer)
        : null,
    dutyStartRemarks: record.dutyStartRemarks,
    dutyCompletionRemarks: record.dutyCompletionRemarks,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    cancellationReason: record.cancellationReason,
    closeDetails: closure
      ? {
          localPackageBilling: closure.localPackageBilling,
          billingTripType:
            closure.billingTripType === 'KM_BASED'
              ? 'KM Based'
              : 'Package Based',
          startKm: closure.startKm === null ? null : Number(closure.startKm),
          endKm: closure.endKm === null ? null : Number(closure.endKm),
          actualRunningKm: Number(closure.actualRunningKm),
          minimumKm: Number(closure.minimumBillingKm),
          billingKm: Number(closure.billingKm),
          totalKm: Number(closure.actualRunningKm),
          ratePerKm:
            closure.ratePerKm === null ? null : Number(closure.ratePerKm),
          packageAmount:
            closure.packageAmount === null
              ? null
              : Number(closure.packageAmount),
          baseFare: Number(closure.baseFare),
          tollTax: Number(closure.tollTax),
          parking: Number(closure.parking),
          driverAllowance: Number(closure.driverAllowance),
          otherRecoverableCharges: Number(closure.otherRecoverableCharges),
          gst: Number(closure.gstAmount),
          totalBillAmount,
          dieselCost: Number(closure.dieselCost),
          fuelConsumedLitres:
            closure.fuelConsumedLitres === null
              ? null
              : Number(closure.fuelConsumedLitres),
          directVehicleExpense: Number(closure.directVehicleExpense),
          driverCost: Number(closure.driverCost),
          allocatedOfficeExpense: Number(closure.allocatedOfficeExpense),
          vehicleRevenue: Number(closure.vehicleRevenue),
          netVehicleProfit: Number(closure.netVehicleProfit),
          vendorPayableAmount: Number(closure.vendorPayableAmount),
          vendorExtraCharges: Number(closure.vendorExtraCharges),
          vendorDeduction: Number(closure.vendorDeduction),
          vendorRecoverableCharges:
            record.assignmentSource === 'VENDOR'
              ? Number(closure.tollTax) +
                Number(closure.parking) +
                Number(closure.driverAllowance)
              : 0,
          vendorBookingRevenue:
            record.assignmentSource === 'VENDOR'
              ? Number(closure.baseFare) +
                Number(closure.tollTax) +
                Number(closure.parking) +
                Number(closure.driverAllowance)
              : 0,
          finalVendorPayable: Number(closure.finalVendorPayable),
          vendorBookingProfit: Number(closure.vendorBookingProfit),
          assignmentType:
            record.assignmentSource === 'VENDOR'
              ? 'vendor_vehicle'
              : 'own_vehicle',
          profitType:
            record.assignmentSource === 'VENDOR'
              ? 'vendor_vehicle'
              : 'own_vehicle',
          remarks: closure.remarks,
          attachmentName: closure.attachmentName,
          closedAt: closure.closedAt.toISOString(),
        }
      : null,
    collections,
    collectionSummary: {
      totalBillAmount,
      totalCollected,
      pendingBalance: Math.max(0, totalBillAmount - totalCollected),
      cashPendingDeposit,
      verifiedAmount,
      paymentStatus:
        totalCollected <= 0
          ? 'Unpaid'
          : totalCollected < totalBillAmount
            ? 'Partially Paid'
            : cashPendingDeposit > 0
              ? 'Cash With Manager'
              : verifiedAmount >= totalBillAmount
                ? 'Verified'
                : 'Paid',
    },
    invoice: invoice ? mapBookingInvoice(invoice, record) : null,
    assignment_status: record.vehicleId ? 'Assigned' : 'Unassigned',
    status: BOOKING_STATUS_LABELS[record.status],
  }
}
