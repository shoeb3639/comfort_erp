import { randomInt, randomUUID } from 'node:crypto'
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { Prisma } from '../../generated/prisma/client'
import type {
  BookingStatus,
  CollectionStatus,
} from '../../generated/prisma/enums'
import { AppError } from '../../shared/errors/app-error'
import type { PageRequest } from '../../shared/pagination'
import { pageResult } from '../../shared/pagination'
import { titleCaseOptional, toTitleCase } from '../../shared/text/title-case'
import {
  normalizeReferenceNumber,
  validateReference,
} from '../accounts/accounts.service'
import {
  DUTY_EVIDENCE_FIELDS,
  DUTY_EVIDENCE_IMAGE_EXTENSIONS,
  DUTY_EVIDENCE_ROOT,
} from './booking.constants'
import { asDutyEvidence, mapBooking } from './booking.mapper'
import * as repository from './booking.repository'
import type {
  AssignmentInput,
  BookingInput,
  CloseBookingInput,
  CollectionInput,
  Context,
  CreateBookingInput,
  DutyCompleteInput,
  DutyEvidenceFile,
  DutyEvidenceType,
  DutyStartInput,
} from './booking.types'

async function validateCustomer(
  context: Context,
  customerId: string,
  travellerId?: string | null,
) {
  const customer = await repository.findCustomer(context.tenantId, customerId)
  if (!customer) throw new AppError('Customer was not found', 'NOT_FOUND', 404)
  if (travellerId) {
    const traveller = await repository.findTraveller(
      context.tenantId,
      travellerId,
    )
    if (!traveller || traveller.customerId !== customerId)
      throw new AppError(
        'Traveller must belong to the selected customer',
        'INVALID_TRAVELLER',
        409,
      )
  }
}

function validateDates(startDate: Date, endDate: Date) {
  if (endDate < startDate)
    throw new AppError(
      'End date cannot be before start date',
      'VALIDATION_ERROR',
      400,
    )
}

export async function getPrefix(context: Context) {
  const tenant = await repository.getTenantPrefix(context.tenantId)
  return { bookingPrefix: tenant?.bookingPrefix ?? null }
}

export async function setPrefix(context: Context, bookingPrefix: string) {
  try {
    return await repository.updateTenantPrefix(
      context.tenantId,
      bookingPrefix.toUpperCase(),
    )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new AppError(
        'This booking prefix is already used by another tenant',
        'BOOKING_PREFIX_EXISTS',
        409,
      )
    throw error
  }
}

export async function list(
  context: Context,
  filters: { search?: string; status?: string; view?: string } & PageRequest,
) {
  const [records, total] = await repository.list(context.tenantId, filters)
  return pageResult(
    records.map((record) => mapBooking(record)!),
    total,
    filters,
  )
}

export async function get(context: Context, idOrNumber: string) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  return mapBooking(booking)
}

export async function uploadDutyEvidence(
  context: Context,
  idOrNumber: string,
  type: DutyEvidenceType,
  file: { data: Buffer; mimeType: string; originalName: string },
) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  const expectedStatus = type === 'opening-meter' ? 'ASSIGNED' : 'RUNNING'
  if (booking.status !== expectedStatus)
    throw new AppError(
      type === 'opening-meter'
        ? 'Opening meter evidence can only be uploaded for an assigned booking'
        : 'Completion evidence can only be uploaded for a running duty',
      'INVALID_BOOKING_TRANSITION',
      409,
    )

  const supportsPdf = type === 'duty-slip' || type === 'toll-parking'
  const extension =
    DUTY_EVIDENCE_IMAGE_EXTENSIONS[file.mimeType] ||
    (supportsPdf && file.mimeType === 'application/pdf' ? 'pdf' : null)
  if (!extension)
    throw new AppError(
      supportsPdf
        ? 'Supporting document must be a JPEG, PNG, WebP, HEIC, or PDF file'
        : 'Meter evidence must be a JPEG, PNG, WebP, or HEIC image',
      'UNSUPPORTED_FILE_TYPE',
      415,
    )
  if (file.data.length === 0)
    throw new AppError('Uploaded file is empty', 'VALIDATION_ERROR', 400)

  const storageDirectory = join(context.tenantId, booking.id)
  const storedName = `${randomUUID()}.${extension}`
  const storageKey = join(storageDirectory, storedName)
  const absolutePath = resolve(DUTY_EVIDENCE_ROOT, storageKey)
  await mkdir(resolve(DUTY_EVIDENCE_ROOT, storageDirectory), {
    recursive: true,
  })
  await writeFile(absolutePath, file.data, { flag: 'wx' })

  const field = DUTY_EVIDENCE_FIELDS[type]
  const current = asDutyEvidence(booking.dutyEvidence)
  const previous = current[field]
  const metadata: DutyEvidenceFile = {
    originalName: basename(file.originalName).slice(0, 255) || storedName,
    storageKey,
    mimeType: file.mimeType,
    size: file.data.length,
    uploadedAt: new Date().toISOString(),
    uploadedByUserId: context.userId,
  }
  try {
    const updated = await repository.updateDutyEvidence(
      context.tenantId,
      booking.id,
      { ...current, [field]: metadata } as Prisma.InputJsonValue,
    )
    if (previous?.storageKey) {
      const previousPath = resolve(DUTY_EVIDENCE_ROOT, previous.storageKey)
      if (previousPath.startsWith(`${DUTY_EVIDENCE_ROOT}${sep}`))
        await unlink(previousPath).catch(() => undefined)
    }
    return mapBooking(updated)
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined)
    throw error
  }
}

export async function getDutyEvidenceFile(
  context: Context,
  idOrNumber: string,
  type: DutyEvidenceType,
) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  const metadata = asDutyEvidence(booking.dutyEvidence)[
    DUTY_EVIDENCE_FIELDS[type]
  ]
  if (!metadata)
    throw new AppError('Duty evidence was not found', 'NOT_FOUND', 404)
  const absolutePath = resolve(DUTY_EVIDENCE_ROOT, metadata.storageKey)
  if (!absolutePath.startsWith(`${DUTY_EVIDENCE_ROOT}${sep}`))
    throw new AppError(
      'Duty evidence path is invalid',
      'INTERNAL_SERVER_ERROR',
      500,
    )
  await stat(absolutePath).catch(() => {
    throw new AppError('Duty evidence file is missing', 'NOT_FOUND', 404)
  })
  return { ...metadata, absolutePath }
}

export async function create(context: Context, input: CreateBookingInput) {
  const tenant = await repository.getTenantPrefix(context.tenantId)
  if (!tenant?.bookingPrefix)
    throw new AppError(
      'Set the four-character Booking Prefix in Company Setup before creating a booking',
      'BOOKING_PREFIX_REQUIRED',
      409,
    )
  validateDates(input.startDate, input.endDate)
  await validateCustomer(context, input.customerId, input.travellerId)

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const sequence = randomInt(100000, 1000000)
    try {
      const booking = await repository.create({
        tenantId: context.tenantId,
        bookingNumber: `${tenant.bookingPrefix}-${sequence}`,
        customerId: input.customerId,
        travellerId: input.travellerId ?? null,
        bookingType: input.bookingType,
        bookingPackage: input.bookingPackage ?? null,
        tripType: input.tripType ?? 'ONE_WAY',
        serviceCity: toTitleCase(input.serviceCity),
        startDate: input.startDate,
        endDate: input.endDate,
        pickupTime: input.pickupTime,
        travellingFrom: toTitleCase(input.travellingFrom),
        travellingTo: toTitleCase(input.travellingTo),
        pickupReportingAddress: toTitleCase(input.pickupReportingAddress),
        routeStops: titleCaseOptional(input.routeStops) ?? null,
        packageDetails: titleCaseOptional(input.packageDetails) ?? null,
        requestedVehicleType: toTitleCase(input.requestedVehicleType),
        assignmentSource: input.assignmentSource,
        pricingBasis: input.pricingBasis,
        customerRate: input.customerRate,
        requiredDutyDocuments: input.requiredDutyDocuments ?? [],
        notes: titleCaseOptional(input.notes) ?? null,
        status: input.status ?? 'CONFIRMED',
        confirmedAt: input.status === 'DRAFT' ? null : new Date(),
        createdById: context.userId,
        updatedById: context.userId,
      })
      return mapBooking(booking)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        continue
      throw error
    }
  }
  throw new AppError(
    'Unable to allocate a unique booking number; please retry',
    'BOOKING_NUMBER_UNAVAILABLE',
    503,
  )
}

export async function update(
  context: Context,
  idOrNumber: string,
  input: BookingInput,
) {
  const current = await repository.find(context.tenantId, idOrNumber)
  if (!current) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  if (!['DRAFT', 'CONFIRMED', 'ASSIGNED'].includes(current.status))
    throw new AppError(
      'Running, completed, closed, or cancelled bookings cannot be edited',
      'BOOKING_LOCKED',
      409,
    )
  const customerId = input.customerId ?? current.customerId
  const travellerId =
    input.travellerId === undefined ? current.travellerId : input.travellerId
  await validateCustomer(context, customerId, travellerId)
  const startDate = input.startDate ?? current.startDate
  const endDate = input.endDate ?? current.endDate
  validateDates(startDate, endDate)
  await repository.update(context.tenantId, current.id, {
    ...input,
    customerId,
    travellerId,
    startDate,
    endDate,
    ...(input.serviceCity
      ? { serviceCity: toTitleCase(input.serviceCity) }
      : {}),
    ...(input.travellingFrom !== undefined
      ? { travellingFrom: titleCaseOptional(input.travellingFrom) }
      : {}),
    ...(input.travellingTo !== undefined
      ? { travellingTo: titleCaseOptional(input.travellingTo) }
      : {}),
    ...(input.pickupReportingAddress
      ? {
          pickupReportingAddress: toTitleCase(input.pickupReportingAddress),
        }
      : {}),
    ...(input.routeStops !== undefined
      ? { routeStops: titleCaseOptional(input.routeStops) }
      : {}),
    ...(input.packageDetails !== undefined
      ? { packageDetails: titleCaseOptional(input.packageDetails) }
      : {}),
    ...(input.requestedVehicleType
      ? { requestedVehicleType: toTitleCase(input.requestedVehicleType) }
      : {}),
    ...(input.notes !== undefined
      ? { notes: titleCaseOptional(input.notes) }
      : {}),
    updatedById: context.userId,
  })
  return get(context, current.id)
}

export async function assign(
  context: Context,
  idOrNumber: string,
  input: AssignmentInput,
) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  if (!['CONFIRMED', 'ASSIGNED'].includes(booking.status))
    throw new AppError(
      'This booking cannot be assigned',
      'BOOKING_ASSIGNMENT_LOCKED',
      409,
    )
  const [vendor, vehicle, driver] = await repository.findAssignmentResources(
    context.tenantId,
    input.vendorId,
    input.vehicleId,
    input.driverId,
  )
  if (!vehicle || !driver || (input.assignmentSource === 'VENDOR' && !vendor))
    throw new AppError(
      'Active assignment resources were not found',
      'ASSIGNMENT_RESOURCE_NOT_FOUND',
      404,
    )
  if (
    input.assignmentSource === 'OWN' &&
    (input.vendorId ||
      vehicle.ownershipType !== 'OWN' ||
      vehicle.vendorId ||
      driver.engagementType !== 'OWN' ||
      driver.vendorId)
  )
    throw new AppError(
      'Own assignment requires own vehicle and own driver without a vendor',
      'INVALID_OWN_ASSIGNMENT',
      409,
    )
  if (
    input.assignmentSource === 'VENDOR' &&
    (!input.vendorId ||
      vehicle.ownershipType !== 'VENDOR' ||
      driver.engagementType !== 'VENDOR' ||
      vehicle.vendorId !== input.vendorId ||
      driver.vendorId !== input.vendorId)
  )
    throw new AppError(
      'Vendor, vehicle, and driver must belong to the same vendor',
      'INVALID_VENDOR_ASSIGNMENT',
      409,
    )
  const conflict = await repository.hasResourceConflict(
    context.tenantId,
    booking.id,
    input.vehicleId,
    input.driverId,
    booking.startDate,
    booking.endDate,
  )
  if (conflict)
    throw new AppError(
      `Vehicle or driver is already assigned to ${conflict.bookingNumber}`,
      'DUTY_ASSIGNMENT_CONFLICT',
      409,
    )
  return mapBooking(
    await repository.assign(
      context.tenantId,
      booking.id,
      {
        assignmentSource: input.assignmentSource,
        vendorId: input.vendorId,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        vendorRateType: input.vendorRateType ?? null,
        vendorRate: input.vendorRate ?? null,
        status: 'ASSIGNED',
        assignedAt: new Date(),
        updatedById: context.userId,
      },
      context.userId,
    ),
  )
}

async function transition(
  context: Context,
  idOrNumber: string,
  expectedStatuses: BookingStatus[],
  data: Prisma.BookingUncheckedUpdateInput,
  action: string,
  errorMessage: string,
) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  if (!expectedStatuses.includes(booking.status))
    throw new AppError(errorMessage, 'INVALID_BOOKING_TRANSITION', 409)
  const updated = await repository.lifecycleTransition(
    context.tenantId,
    booking.id,
    expectedStatuses,
    { ...data, updatedById: context.userId },
    context.userId,
    action,
  )
  if (!updated)
    throw new AppError(
      'Booking status changed concurrently; refresh and retry',
      'BOOKING_TRANSITION_CONFLICT',
      409,
    )
  return mapBooking(updated)
}

export function confirm(context: Context, idOrNumber: string) {
  return transition(
    context,
    idOrNumber,
    ['DRAFT'],
    { status: 'CONFIRMED', confirmedAt: new Date() },
    'CONFIRM',
    'Only a draft booking can be confirmed',
  )
}

export async function startDuty(
  context: Context,
  idOrNumber: string,
  input: DutyStartInput,
) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  if (booking.status !== 'ASSIGNED')
    throw new AppError(
      'Only an assigned booking can start duty',
      'INVALID_BOOKING_TRANSITION',
      409,
    )
  if (!booking.vehicleId || !booking.driverId)
    throw new AppError(
      'Vehicle and driver assignment is required before duty start',
      'DUTY_ASSIGNMENT_REQUIRED',
      409,
    )
  if (
    booking.assignmentSource === 'OWN' &&
    (input.openingOdometer === null || input.openingOdometer === undefined)
  )
    throw new AppError(
      'Opening odometer is required for an own vehicle duty',
      'OPENING_ODOMETER_REQUIRED',
      400,
    )
  if (!asDutyEvidence(booking.dutyEvidence).openingMeter)
    throw new AppError(
      'Opening meter photo is required before duty start',
      'OPENING_METER_PHOTO_REQUIRED',
      400,
    )
  return transition(
    context,
    idOrNumber,
    ['ASSIGNED'],
    {
      status: 'RUNNING',
      dutyStartedAt: new Date(),
      openingOdometer: input.openingOdometer ?? null,
      dutyStartRemarks: titleCaseOptional(input.remarks) ?? null,
    },
    'START_DUTY',
    'Only an assigned booking can start duty',
  )
}

export async function completeDuty(
  context: Context,
  idOrNumber: string,
  input: DutyCompleteInput,
) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  if (booking.status !== 'RUNNING')
    throw new AppError(
      'Only a running booking can complete duty',
      'INVALID_BOOKING_TRANSITION',
      409,
    )
  const evidence = asDutyEvidence(booking.dutyEvidence)
  const requiredDocuments = new Set(booking.requiredDutyDocuments)
  if (requiredDocuments.has('CLOSING_METER_PHOTO') && !evidence.closingMeter)
    throw new AppError(
      'Closing meter photo is required before duty completion',
      'CLOSING_METER_PHOTO_REQUIRED',
      400,
    )
  if (requiredDocuments.has('SIGNED_DUTY_SLIP') && !evidence.dutySlip)
    throw new AppError(
      'Signed duty slip is required before duty completion',
      'DUTY_SLIP_REQUIRED',
      400,
    )
  if (
    requiredDocuments.has('TOLL_PARKING_RECEIPTS') &&
    !evidence.tollParkingReceipts
  )
    throw new AppError(
      'Toll and parking supporting document is required before duty completion',
      'TOLL_PARKING_DOCUMENT_REQUIRED',
      400,
    )
  if (
    booking.assignmentSource === 'OWN' &&
    (input.closingOdometer === null || input.closingOdometer === undefined)
  )
    throw new AppError(
      'Closing odometer is required for an own vehicle duty',
      'CLOSING_ODOMETER_REQUIRED',
      400,
    )
  if (
    booking.openingOdometer !== null &&
    input.closingOdometer !== null &&
    input.closingOdometer !== undefined &&
    input.closingOdometer < Number(booking.openingOdometer)
  )
    throw new AppError(
      'Closing odometer cannot be lower than opening odometer',
      'INVALID_ODOMETER',
      400,
    )
  return transition(
    context,
    idOrNumber,
    ['RUNNING'],
    {
      status: 'COMPLETED',
      dutyCompletedAt: new Date(),
      closingOdometer: input.closingOdometer ?? null,
      dutyCompletionRemarks: titleCaseOptional(input.remarks) ?? null,
      dutyCompletionDetails: {
        tollTax: input.tollTax,
        parking: input.parking,
        driverAllowance: input.driverAllowance,
        otherRecoverableCharges: input.otherRecoverableCharges,
        paymentAmount: input.paymentAmount,
        paymentMode: input.paymentMode ?? null,
        paymentDate: input.paymentDate?.toISOString() ?? null,
        paymentReference: input.paymentReference?.trim() || null,
        collectedBy: input.collectedBy ? toTitleCase(input.collectedBy) : null,
      },
    },
    'COMPLETE_DUTY',
    'Only a running booking can complete duty',
  )
}

export function cancel(context: Context, idOrNumber: string, reason: string) {
  return transition(
    context,
    idOrNumber,
    ['DRAFT', 'CONFIRMED', 'ASSIGNED', 'RUNNING'],
    {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: toTitleCase(reason),
    },
    'CANCEL',
    'Completed, closed, or already cancelled bookings cannot be cancelled',
  )
}

function inclusiveDays(startDate: Date, endDate: Date) {
  return Math.max(
    1,
    Math.round(
      (Date.UTC(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth(),
        endDate.getUTCDate(),
      ) -
        Date.UTC(
          startDate.getUTCFullYear(),
          startDate.getUTCMonth(),
          startDate.getUTCDate(),
        )) /
        86400000,
    ) + 1,
  )
}

function packageKm(bookingPackage: string) {
  return Number(bookingPackage.match(/\d+/g)?.at(-1) ?? 0)
}

export function minimumBillingKm(
  bookingPackage: string | null,
  startDate: Date,
  endDate: Date,
) {
  if (!bookingPackage) return 0
  if (bookingPackage.startsWith('outstation_min_'))
    return packageKm(bookingPackage) * inclusiveDays(startDate, endDate)
  if (bookingPackage.startsWith('local_')) return packageKm(bookingPackage)
  return 0
}

function nonNegative(value: number | undefined) {
  return Math.max(0, value ?? 0)
}

export function calculateVendorCost(input: {
  baseFare: number
  tollTax: number
  parking: number
  driverAllowance: number
  vendorPayableAmount: number
  vendorExtraCharges: number
  vendorDeduction: number
}) {
  const recoverableCharges =
    input.tollTax + input.parking + input.driverAllowance
  const revenue = input.baseFare + recoverableCharges
  const finalPayable = Math.max(
    0,
    input.vendorPayableAmount +
      recoverableCharges +
      input.vendorExtraCharges -
      input.vendorDeduction,
  )
  return {
    recoverableCharges,
    revenue,
    finalPayable,
    profit: revenue - finalPayable,
  }
}

export async function close(
  context: Context,
  idOrNumber: string,
  input: CloseBookingInput,
) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  if (!['CONFIRMED', 'ASSIGNED', 'COMPLETED'].includes(booking.status))
    throw new AppError(
      'Only confirmed, assigned, or completed bookings can be closed',
      'INVALID_BOOKING_TRANSITION',
      409,
    )
  if (booking.closure)
    throw new AppError(
      'Booking is already closed',
      'BOOKING_ALREADY_CLOSED',
      409,
    )
  if (!booking.customer.billingAddress)
    throw new AppError(
      'Customer billing address is required before closing the booking and creating its invoice',
      'CUSTOMER_BILLING_ADDRESS_REQUIRED',
      400,
    )

  const startKm =
    input.startKm ??
    (booking.openingOdometer === null ? null : Number(booking.openingOdometer))
  const endKm =
    input.endKm ??
    (booking.closingOdometer === null ? null : Number(booking.closingOdometer))
  if (startKm !== null && endKm !== null && endKm < startKm)
    throw new AppError(
      'End KM cannot be lower than Start KM',
      'INVALID_ODOMETER',
      400,
    )
  const actualRunningKm =
    startKm !== null && endKm !== null ? endKm - startKm : 0
  const minimumKm = minimumBillingKm(
    booking.bookingPackage,
    booking.startDate,
    booking.endDate,
  )
  const billingKm = Math.max(actualRunningKm, minimumKm)
  const ratePerKm =
    input.billingTripType === 'KM_BASED'
      ? (input.ratePerKm ?? Number(booking.customerRate))
      : null
  const packageAmount =
    input.billingTripType === 'PACKAGE_BASED'
      ? (input.packageAmount ?? Number(booking.customerRate))
      : null
  if (
    (input.billingTripType === 'KM_BASED' && (!ratePerKm || ratePerKm < 0)) ||
    (input.billingTripType === 'PACKAGE_BASED' &&
      (!packageAmount || packageAmount < 0))
  )
    throw new AppError(
      'A valid billing rate or package amount is required',
      'VALIDATION_ERROR',
      400,
    )
  const baseFare =
    input.billingTripType === 'KM_BASED'
      ? billingKm * ratePerKm!
      : packageAmount!
  const tollTax = nonNegative(input.tollTax)
  const parking = nonNegative(input.parking)
  const driverAllowance = nonNegative(input.driverAllowance)
  const otherRecoverableCharges = nonNegative(input.otherRecoverableCharges)
  const gstAmount = nonNegative(input.gst)
  const totalBillAmount =
    baseFare +
    tollTax +
    parking +
    driverAllowance +
    otherRecoverableCharges +
    gstAmount
  const paymentAmount = nonNegative(input.paymentAmount)
  if (paymentAmount > totalBillAmount)
    throw new AppError(
      'Received amount cannot exceed the final booking bill',
      'COLLECTION_EXCEEDS_BALANCE',
      409,
    )
  if (paymentAmount > 0 && (!input.paymentMode || !input.paymentDate))
    throw new AppError(
      'Payment mode and payment date are required when an amount is received',
      'VALIDATION_ERROR',
      400,
    )
  const paymentReference =
    paymentAmount > 0 ? input.paymentReference?.trim() || null : null
  if (paymentReference) {
    const validation = await validateReference(
      context.tenantId,
      paymentReference,
    )
    if (!validation.available)
      throw new AppError(
        `Reference number ${paymentReference} is already in use`,
        'DUPLICATE_REFERENCE',
        409,
      )
  }
  const isVendor = booking.assignmentSource === 'VENDOR'
  const dieselCost = isVendor ? 0 : nonNegative(input.dieselCost)
  const directVehicleExpense = isVendor
    ? 0
    : nonNegative(input.directVehicleExpense)
  const driverCost = isVendor ? 0 : nonNegative(input.driverCost)
  const allocatedOfficeExpense = isVendor
    ? 0
    : nonNegative(input.allocatedOfficeExpense)
  const vehicleRevenue = isVendor ? 0 : baseFare
  const netVehicleProfit = isVendor
    ? 0
    : vehicleRevenue -
      dieselCost -
      directVehicleExpense -
      driverCost -
      allocatedOfficeExpense
  const vendorPayableAmount = isVendor
    ? nonNegative(
        input.vendorPayableAmount ?? Number(booking.vendorPayableAmount ?? 0),
      )
    : 0
  const vendorExtraCharges = isVendor
    ? nonNegative(input.vendorExtraCharges)
    : 0
  const vendorDeduction = isVendor ? nonNegative(input.vendorDeduction) : 0
  const vendorCost = isVendor
    ? calculateVendorCost({
        baseFare,
        tollTax,
        parking,
        driverAllowance,
        vendorPayableAmount,
        vendorExtraCharges,
        vendorDeduction,
      })
    : { recoverableCharges: 0, revenue: 0, finalPayable: 0, profit: 0 }
  const finalVendorPayable = vendorCost.finalPayable
  const vendorBookingProfit = vendorCost.profit

  const charges = [
    ['Toll Tax', tollTax],
    ['Parking', parking],
    ['Driver Allowance', driverAllowance],
    ['Other Recoverable Charges', otherRecoverableCharges],
    ['GST', gstAmount],
  ] as const
  const invoiceItems: Prisma.InvoiceItemUncheckedCreateWithoutInvoiceInput[] = [
    {
      dateType:
        booking.startDate.getTime() === booking.endDate.getTime()
          ? 'single'
          : 'range',
      serviceDate:
        booking.startDate.getTime() === booking.endDate.getTime()
          ? booking.startDate
          : null,
      serviceStartDate: booking.startDate,
      serviceEndDate: booking.endDate,
      description:
        input.billingTripType === 'KM_BASED'
          ? 'Vehicle Hire Charges'
          : 'Package Fare',
      quantity: input.billingTripType === 'KM_BASED' ? billingKm : 1,
      unit: input.billingTripType === 'KM_BASED' ? 'KM' : 'Package',
      rate: input.billingTripType === 'KM_BASED' ? ratePerKm! : baseFare,
      amount: baseFare,
      sortOrder: 0,
    },
    ...charges
      .filter(([, amount]) => amount > 0)
      .map(([description, amount], index) => ({
        dateType: 'single',
        serviceDate: booking.endDate,
        description,
        quantity: 1,
        unit: 'Actual',
        rate: amount,
        amount,
        sortOrder: index + 1,
      })),
  ]

  const closed = await repository.closeBooking(
    context.tenantId,
    booking.id,
    context.userId,
    {
      closure: {
        billingTripType: input.billingTripType,
        startKm,
        endKm,
        actualRunningKm,
        minimumBillingKm: minimumKm,
        billingKm,
        ratePerKm,
        packageAmount,
        baseFare,
        tollTax,
        parking,
        driverAllowance,
        otherRecoverableCharges,
        gstAmount,
        totalBillAmount,
        dieselCost,
        directVehicleExpense,
        driverCost,
        allocatedOfficeExpense,
        vehicleRevenue,
        netVehicleProfit,
        vendorPayableAmount,
        vendorExtraCharges,
        vendorDeduction,
        finalVendorPayable,
        vendorBookingProfit,
        remarks: titleCaseOptional(input.remarks) ?? null,
        attachmentName: input.attachmentName ?? null,
        closedById: context.userId,
      },
      invoice: {
        customerId: booking.customerId,
        invoiceDate: new Date(),
        status: 'DRAFT',
        gstType: 'NO_GST',
        billingName: booking.customer.billingName,
        billingAddress: booking.customer.billingAddress,
        customerGstin: booking.customer.gstin,
        subtotal: totalBillAmount,
        taxableAmount: totalBillAmount,
        netPayable: totalBillAmount,
        createdById: context.userId,
        updatedById: context.userId,
      },
      invoiceItems,
      initialCollection:
        paymentAmount > 0
          ? {
              collectionDate: input.paymentDate!,
              amount: paymentAmount,
              paymentMode: input.paymentMode!,
              collectedByName: toTitleCase(input.collectedBy!),
              referenceNumber: paymentReference,
              normalizedReferenceNumber: paymentReference
                ? normalizeReferenceNumber(paymentReference)
                : null,
              status:
                input.paymentMode === 'CASH' ? 'PENDING' : 'DIRECTLY_RECEIVED',
            }
          : null,
    },
  )
  if (!closed)
    throw new AppError(
      'Booking status changed or it was already closed; refresh and retry',
      'BOOKING_CLOSE_CONFLICT',
      409,
    )
  return mapBooking(closed)
}

export async function getProfit(context: Context, idOrNumber: string) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  if (!booking.closure)
    throw new AppError(
      'Profit is available only after booking closure',
      'BOOKING_NOT_CLOSED',
      409,
    )
  return mapBooking(booking)
}

function resolvedCollectionStatus(input: CollectionInput): CollectionStatus {
  if (input.paymentMode !== 'CASH')
    return input.depositStatus === 'VERIFIED' ? 'VERIFIED' : 'DIRECTLY_RECEIVED'
  return input.depositStatus ?? (input.depositDate ? 'DEPOSITED' : 'PENDING')
}

export async function addCollection(
  context: Context,
  idOrNumber: string,
  input: CollectionInput,
) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  if (!booking.closure)
    throw new AppError(
      'Booking must be closed before recording a collection',
      'BOOKING_NOT_CLOSED',
      409,
    )
  const collected = booking.collections.reduce(
    (total, row) => total + Number(row.amount),
    0,
  )
  if (collected + input.amount > Number(booking.closure.totalBillAmount))
    throw new AppError(
      'Collection amount exceeds the pending booking balance',
      'COLLECTION_EXCEEDS_BALANCE',
      409,
    )
  const suppliedReferences = [
    input.referenceNumber
      ? {
          referenceNumber: input.referenceNumber.trim(),
          normalizedReferenceNumber: normalizeReferenceNumber(
            input.referenceNumber,
          ),
          source: 'COLLECTION' as const,
        }
      : null,
    input.depositReferenceNumber
      ? {
          referenceNumber: input.depositReferenceNumber.trim(),
          normalizedReferenceNumber: normalizeReferenceNumber(
            input.depositReferenceNumber,
          ),
          source: 'CASH_DEPOSIT' as const,
        }
      : null,
  ].filter(
    (
      reference,
    ): reference is {
      referenceNumber: string
      normalizedReferenceNumber: string
      source: 'COLLECTION' | 'CASH_DEPOSIT'
    } => Boolean(reference),
  )
  if (
    new Set(
      suppliedReferences.map(
        (reference) => reference.normalizedReferenceNumber,
      ),
    ).size !== suppliedReferences.length
  )
    throw new AppError(
      'Payment and deposit reference numbers must be different',
      'DUPLICATE_REFERENCE',
      409,
    )
  for (const reference of suppliedReferences) {
    const validation = await validateReference(
      context.tenantId,
      reference.referenceNumber,
    )
    if (!validation.available)
      throw new AppError(
        `Reference number ${reference.referenceNumber} is already in use`,
        'DUPLICATE_REFERENCE',
        409,
      )
  }
  const status = resolvedCollectionStatus(input)
  try {
    await repository.createCollection(
      context.tenantId,
      booking.id,
      context.userId,
      {
        invoiceId: booking.invoices[0]?.id ?? null,
        collectionDate: input.collectionDate,
        amount: input.amount,
        paymentMode: input.paymentMode,
        collectedByName: toTitleCase(input.collectedBy),
        receiverName: titleCaseOptional(input.receiverName) ?? null,
        referenceNumber: input.referenceNumber?.trim() || null,
        remarks: titleCaseOptional(input.remarks) ?? null,
        depositDate: input.depositDate ?? null,
        depositMode: titleCaseOptional(input.depositMode) ?? null,
        depositReferenceNumber: input.depositReferenceNumber?.trim() || null,
        depositedByName: titleCaseOptional(input.depositedBy) ?? null,
        verifiedByName: titleCaseOptional(input.verifiedBy) ?? null,
        status,
        ...(status === 'VERIFIED'
          ? { verifiedAt: new Date(), verifiedById: context.userId }
          : {}),
      },
      suppliedReferences,
    )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new AppError(
        'Payment or deposit reference number is already in use',
        'DUPLICATE_REFERENCE',
        409,
      )
    throw error
  }
  return get(context, booking.id)
}

export async function verifyCollection(
  context: Context,
  idOrNumber: string,
  collectionId: string,
  verifiedBy?: string | null,
) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  const collection = booking.collections.find(
    (record) => record.id === collectionId,
  )
  if (
    collection?.paymentMode === 'CASH' &&
    collection.cashDeposit?.status !== 'DEPOSITED'
  )
    throw new AppError(
      'Cash must be deposited before the collection can be verified',
      'CASH_DEPOSIT_REQUIRED',
      409,
    )
  const result = await repository.verifyCollection(
    context.tenantId,
    booking.id,
    collectionId,
    context.userId,
    titleCaseOptional(verifiedBy) ?? null,
  )
  if (!result)
    throw new AppError(
      'Collection was not found or is already verified',
      'COLLECTION_NOT_AVAILABLE',
      409,
    )
  return get(context, booking.id)
}

export async function voidCollection(
  context: Context,
  idOrNumber: string,
  collectionId: string,
) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  const result = await repository.voidCollection(
    context.tenantId,
    booking.id,
    collectionId,
    context.userId,
  )
  if (!result) throw new AppError('Collection was not found', 'NOT_FOUND', 404)
  return get(context, booking.id)
}

export async function remove(context: Context, idOrNumber: string) {
  const booking = await repository.find(context.tenantId, idOrNumber)
  if (!booking) throw new AppError('Booking was not found', 'NOT_FOUND', 404)
  const result = await repository.softDelete(
    context.tenantId,
    booking.id,
    context.userId,
  )
  if (!result.count)
    throw new AppError(
      'Only draft or confirmed unprocessed bookings can be deleted',
      'BOOKING_DELETE_NOT_ALLOWED',
      409,
    )
  return { id: booking.bookingNumber, deleted: true }
}
