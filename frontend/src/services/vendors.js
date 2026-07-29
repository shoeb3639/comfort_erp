import axios from "axios";
import { readStoredSession } from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1",
  headers: { "Content-Type": "application/json" },
});
const config = () => {
  const token = readStoredSession()?.accessToken;
  return { headers: token ? { Authorization: `Bearer ${token}` } : {} };
};
const statusFromApi = (status) =>
  status === "ACTIVE" ? "Active" : status === "INACTIVE" ? "Inactive" : status;
const statusToApi = (status) =>
  status === "Active" ? "ACTIVE" : status === "Inactive" ? "INACTIVE" : status;
function mapDriver(driver) {
  return {
    ...driver,
    ownershipType:
      driver.engagementType === "OWN"
        ? "own"
        : driver.engagementType === "VENDOR"
          ? "vendor"
          : driver.ownershipType,
    license: driver.licenceNumber ?? driver.license,
    phone: driver.mobile ?? driver.phone,
    city: driver.address ?? driver.city,
    status:
      driver.status === "ACTIVE"
        ? "Available"
        : driver.status === "INACTIVE"
          ? "Offline"
          : driver.status,
    vendorId: driver.vendorId,
    displayName:
      driver.displayName ||
      `${driver.salutation === "MR" ? "Mr. " : driver.salutation === "MS" ? "Ms. " : ""}${driver.name}`,
  };
}
function mapVendor(vendor) {
  return {
    ...vendor,
    id: vendor.id,
    recordType: vendor.recordType,
    status: statusFromApi(vendor.status),
    rating: Number(vendor.rating),
    vehicles: (vendor.vehicles || []).map((vehicle) => ({
      ...vehicle,
      plate: vehicle.registrationNumber ?? vehicle.plate,
      type: vehicle.vehicleType?.name ?? vehicle.type,
      ownershipType:
        vehicle.ownershipType === "OWN"
          ? "own"
          : vehicle.ownershipType === "VENDOR"
            ? "vendor"
            : vehicle.ownershipType,
      status:
        vehicle.status === "ACTIVE"
          ? "Ready"
          : vehicle.status === "INACTIVE"
            ? "Maintenance"
            : vehicle.status,
    })),
    drivers: (vendor.drivers || []).map(mapDriver),
  };
}
function vendorPayload(record) {
  return {
    name: record.name,
    recordType: record.recordType,
    category: record.category,
    rating: Number(record.rating || 0),
    phone: record.phone,
    city: record.city,
    status: statusToApi(record.status),
  };
}
function vehiclePayload(record) {
  return {
    plate: record.plate,
    type: record.type,
    make: record.make,
    seatingCapacity: Number(record.seatingCapacity),
    status: record.status,
  };
}
function driverPayload(record) {
  return {
    salutation: record.salutation || null,
    name: record.name,
    license: record.license,
    phone: record.phone,
    city: record.city,
    status: record.status,
  };
}
export async function getVendors() {
  return (await api.get("/tenant/vendors", config())).data.data.map(mapVendor);
}
export async function createVendor(record) {
  return mapVendor(
    (await api.post("/tenant/vendors", vendorPayload(record), config())).data
      .data,
  );
}
export async function updateVendor(id, record) {
  return mapVendor(
    (await api.patch(`/tenant/vendors/${id}`, vendorPayload(record), config()))
      .data.data,
  );
}
export const deleteVendor = (id) =>
  api.delete(`/tenant/vendors/${id}`, config());
export async function createVendorVehicle(vendorId, record) {
  return (
    await api.post(
      `/tenant/vendors/${vendorId}/vehicles`,
      vehiclePayload(record),
      config(),
    )
  ).data.data;
}
export async function updateVendorVehicle(vendorId, id, record) {
  return (
    await api.patch(
      `/tenant/vendors/${vendorId}/vehicles/${id}`,
      vehiclePayload(record),
      config(),
    )
  ).data.data;
}
export const deleteVendorVehicle = (vendorId, id) =>
  api.delete(`/tenant/vendors/${vendorId}/vehicles/${id}`, config());
export async function createVendorDriver(vendorId, record) {
  return mapDriver(
    (
      await api.post(
        `/tenant/vendors/${vendorId}/drivers`,
        driverPayload(record),
        config(),
      )
    ).data.data,
  );
}
export async function updateVendorDriver(vendorId, id, record) {
  return mapDriver(
    (
      await api.patch(
        `/tenant/vendors/${vendorId}/drivers/${id}`,
        driverPayload(record),
        config(),
      )
    ).data.data,
  );
}
export const deleteVendorDriver = (vendorId, id) =>
  api.delete(`/tenant/vendors/${vendorId}/drivers/${id}`, config());
export function getVendorErrorMessage(error) {
  const details = error.response?.data?.details;
  if (Array.isArray(details) && details.length) {
    return details
      .map((item) => item.message)
      .filter(Boolean)
      .join(", ");
  }
  return error.response?.data?.message || "Unable to complete vendor action.";
}
