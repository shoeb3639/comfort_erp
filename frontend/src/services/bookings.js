import axios from "axios";
import { readStoredSession } from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1",
  headers: { "Content-Type": "application/json" },
});

function config(params) {
  const token = readStoredSession()?.accessToken;
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(params ? { params } : {}),
  };
}

const bookingTypes = {
  package: "PACKAGE",
  local: "LOCAL",
  airport_transfer: "AIRPORT_TRANSFER",
  railway_station_transfer: "RAILWAY_STATION_TRANSFER",
  outstation: "OUTSTATION",
};

export function bookingPayload(values) {
  return {
    customerId: values.billing_customer_id,
    travellerId: values.traveller_id || null,
    bookingType: bookingTypes[values.booking_type] || values.booking_type,
    bookingPackage: values.duty_package || null,
    tripType: String(values.trip_type || "one_way").toUpperCase(),
    serviceCity: values.serviceCity,
    startDate: values.startDate,
    endDate: values.endDate,
    pickupTime: values.pickupTime,
    travellingFrom: values.travellingFrom || null,
    travellingTo: values.travellingTo || null,
    pickupReportingAddress: values.pickupReportingAddress,
    routeStops: values.routeStops || null,
    packageDetails: values.packageDetails || null,
    requestedVehicleType: values.requestedVehicleType,
    assignmentSource:
      values.assignmentType === "vendor_vehicle" ? "VENDOR" : "OWN",
    pricingBasis:
      values.billing_model === "rate_per_km" ? "RATE_PER_KM" : "FIXED",
    customerRate: Number(
      values.billing_model === "rate_per_km"
        ? values.ratePerKm
        : values.fixedAmount,
    ),
    notes: values.notes || null,
  };
}

export async function listBookings(params) {
  return (await api.get("/tenant/bookings", config(params))).data.data;
}

export async function getBooking(id) {
  return (await api.get(`/tenant/bookings/${id}`, config())).data.data;
}

export async function createBooking(values) {
  return (await api.post("/tenant/bookings", bookingPayload(values), config()))
    .data.data;
}

export async function updateBooking(id, values) {
  return (
    await api.patch(`/tenant/bookings/${id}`, bookingPayload(values), config())
  ).data.data;
}

export async function deleteBooking(id) {
  return (await api.delete(`/tenant/bookings/${id}`, config())).data.data;
}

export async function assignBooking(id, values) {
  return (
    await api.patch(
      `/tenant/bookings/${id}/assignment`,
      {
        assignmentSource:
          values.assignmentType === "vendor_vehicle" ? "VENDOR" : "OWN",
        vendorId: values.vendorId || null,
        vehicleId: values.vehicleId,
        driverId: values.driverId,
        vendorRateType: values.vendorRateType || null,
        vendorRate: values.vendorRate === "" ? null : Number(values.vendorRate),
        vendorPayableAmount:
          values.vendorPayableAmount === ""
            ? null
            : Number(values.vendorPayableAmount),
        vendorNotes: values.vendorNotes || null,
      },
      config(),
    )
  ).data.data;
}

export async function confirmBooking(id) {
  return (await api.patch(`/tenant/bookings/${id}/confirm`, {}, config())).data
    .data;
}

export async function startBookingDuty(id, values) {
  return (
    await api.patch(
      `/tenant/bookings/${id}/duty/start`,
      {
        openingOdometer:
          values.openingOdometer === "" ? null : Number(values.openingOdometer),
        remarks: values.remarks || null,
      },
      config(),
    )
  ).data.data;
}

export async function completeBookingDuty(id, values) {
  return (
    await api.patch(
      `/tenant/bookings/${id}/duty/complete`,
      {
        closingOdometer:
          values.closingOdometer === "" ? null : Number(values.closingOdometer),
        remarks: values.remarks || null,
      },
      config(),
    )
  ).data.data;
}

export async function cancelBooking(id, reason) {
  return (
    await api.patch(`/tenant/bookings/${id}/cancel`, { reason }, config())
  ).data.data;
}

export async function closeBooking(id, values) {
  const paymentAmount = Number(values.paymentAmount || 0);
  const payload = {
    billingTripType:
      values.billingTripType === "KM Based" ? "KM_BASED" : "PACKAGE_BASED",
    startKm: values.startKm === "" ? null : Number(values.startKm),
    endKm: values.endKm === "" ? null : Number(values.endKm),
    ratePerKm: values.ratePerKm === "" ? null : Number(values.ratePerKm),
    packageAmount:
      values.packageAmount === "" ? null : Number(values.packageAmount),
    tollTax: Number(values.tollTax || 0),
    parking: Number(values.parking || 0),
    driverAllowance: Number(values.driverAllowance || 0),
    otherRecoverableCharges: Number(values.otherRecoverableCharges || 0),
    gst: Number(values.gst || 0),
    dieselCost: Number(values.dieselCost || 0),
    directVehicleExpense: Number(values.directVehicleExpense || 0),
    driverCost: Number(values.driverCost || 0),
    allocatedOfficeExpense: Number(values.allocatedOfficeExpense || 0),
    vendorPayableAmount: Number(values.vendorPayableAmount || 0),
    vendorExtraCharges: Number(values.vendorExtraCharges || 0),
    vendorDeduction: Number(values.vendorDeduction || 0),
    paymentAmount,
    paymentMode: paymentAmount > 0 ? values.paymentMode : undefined,
    paymentDate: paymentAmount > 0 ? values.paymentDate : undefined,
    paymentReference: values.paymentReference || null,
    collectedBy: paymentAmount > 0 ? values.collectedBy : undefined,
    remarks: values.remarks || null,
    attachmentName: values.attachmentName || null,
  };
  return (await api.post(`/tenant/bookings/${id}/close`, payload, config()))
    .data.data;
}

export async function getBookingProfit(id) {
  return (await api.get(`/tenant/bookings/${id}/profit`, config())).data.data;
}

const paymentModes = {
  Cash: "CASH",
  UPI: "UPI",
  "Bank Transfer": "BANK_TRANSFER",
  Card: "CARD",
  Cheque: "CHEQUE",
};

const collectionStatuses = {
  Pending: "PENDING",
  "With Manager": "WITH_MANAGER",
  Deposited: "DEPOSITED",
  Verified: "VERIFIED",
  "Directly Received": "DIRECTLY_RECEIVED",
};

export async function addBookingCollection(id, values) {
  return (
    await api.post(
      `/tenant/bookings/${id}/collections`,
      {
        collectionDate: values.collectionDate,
        amount: Number(values.amount),
        paymentMode: paymentModes[values.paymentMode] || values.paymentMode,
        collectedBy: values.collectedBy,
        receiverName: values.receiverName || null,
        referenceNumber: values.referenceNumber || null,
        remarks: values.remarks || null,
        depositDate: values.depositDate || null,
        depositMode: values.depositMode || null,
        depositReferenceNumber: values.depositReferenceNumber || null,
        depositedBy: values.depositedBy || null,
        verifiedBy: values.verifiedBy || null,
        depositStatus: collectionStatuses[values.depositStatus] || undefined,
      },
      config(),
    )
  ).data.data;
}

export async function verifyBookingCollection(
  bookingId,
  collectionId,
  verifiedBy,
) {
  return (
    await api.patch(
      `/tenant/bookings/${bookingId}/collections/${collectionId}/verify`,
      { verifiedBy: verifiedBy || null },
      config(),
    )
  ).data.data;
}

export async function voidBookingCollection(bookingId, collectionId) {
  return (
    await api.delete(
      `/tenant/bookings/${bookingId}/collections/${collectionId}`,
      config(),
    )
  ).data.data;
}

export async function getBookingSettings() {
  return (await api.get("/tenant/bookings/settings", config())).data.data;
}

export async function updateBookingSettings(bookingPrefix) {
  return (
    await api.patch("/tenant/bookings/settings", { bookingPrefix }, config())
  ).data.data;
}

export function getBookingErrorMessage(error) {
  const details = error.response?.data?.details;
  if (Array.isArray(details) && details.length) {
    return details
      .map((item) => item.message)
      .filter(Boolean)
      .join(", ");
  }
  return error.response?.data?.message || "Unable to complete booking action.";
}
