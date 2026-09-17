import axios from "axios";
import { readStoredSession } from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1",
  headers: { "Content-Type": "application/json" },
});

function config() {
  const token = readStoredSession()?.accessToken;
  return { headers: token ? { Authorization: `Bearer ${token}` } : {} };
}

const typeToApi = {
  Individuals: "RETAIL",
  Corporate: "CORPORATE",
  "Travel Agent": "TRAVEL_AGENT",
};
const typeFromApi = {
  RETAIL: "Individuals",
  CORPORATE: "Corporate",
  TRAVEL_AGENT: "Travel Agent",
};

function mapTraveller(item, customerId) {
  return {
    ...item,
    displayName: `${item.salutation === "MR" ? "Mr. " : item.salutation === "MS" ? "Ms. " : ""}${item.name}`,
    customer_id: customerId,
    traveller_type: item.travellerType,
    employee_id: item.employeeId,
    status: item.status === "ACTIVE" ? "Active" : "Inactive",
  };
}

function mapCustomer(item) {
  return {
    ...item,
    type: typeFromApi[item.type] || item.type,
    status: item.status === "ACTIVE" ? "Active" : "Inactive",
    address: item.billingAddress,
    contacts: (item.contacts || []).map((contact) => ({
      ...contact,
      displayName: `${contact.salutation === "MR" ? "Mr. " : contact.salutation === "MS" ? "Ms. " : ""}${contact.name}`,
    })),
    travellers: (item.travellers || []).map((traveller) =>
      mapTraveller(traveller, item.id),
    ),
  };
}

function customerPayload(values) {
  return {
    type: typeToApi[values.type] || values.type,
    salutation: values.salutation || null,
    name: values.name,
    billingName: values.billingName,
    email: values.email || null,
    phone: values.phone,
    whatsappNumber: values.whatsappSameAsPhone
      ? values.phone
      : values.whatsappNumber || values.phone || null,
    city: values.city || null,
    gstin: values.gstin || null,
    billingAddress: values.address || null,
    creditLimit: Number(values.creditLimit || 0),
    ...(values.contacts
      ? {
          contacts: values.contacts.map((contact) => ({
            salutation: contact.salutation || null,
            name: contact.name,
            role: contact.role || null,
            phone: contact.phone || null,
            email: contact.email || null,
            isPrimary: Boolean(contact.isPrimary),
          })),
        }
      : {}),
    ...(values.status
      ? { status: values.status === "Active" ? "ACTIVE" : "INACTIVE" }
      : {}),
  };
}

export async function getCustomers(params = {}) {
  const response = await api.get("/tenant/customers", { ...config(), params });
  return {
    ...response.data.data,
    items: response.data.data.items.map(mapCustomer),
  };
}

export async function getCustomer(id) {
  const response = await api.get(`/tenant/customers/${id}`, config());
  return mapCustomer(response.data.data);
}

export async function searchCustomerBookingOptions({
  type,
  query,
  page = 1,
  limit = 20,
  id,
  signal,
} = {}) {
  const response = await api.get("/tenant/customers/booking-options", {
    ...config(),
    signal,
    params: {
      type: typeToApi[type] || type,
      q: query || undefined,
      page,
      limit,
      id,
    },
  });
  return {
    ...response.data.data,
    items: response.data.data.items.map((item) => ({
      ...item,
      type: typeFromApi[item.type] || item.type,
    })),
  };
}

export async function searchTravellerBookingOptions(
  customerId,
  { query, page = 1, limit = 20, id, signal } = {},
) {
  const response = await api.get(
    `/tenant/customers/${customerId}/traveller-options`,
    {
      ...config(),
      signal,
      params: { q: query || undefined, page, limit, id },
    },
  );
  return {
    ...response.data.data,
    items: response.data.data.items.map((item) =>
      mapTraveller(item, customerId),
    ),
  };
}

export async function createCustomer(values) {
  const response = await api.post(
    "/tenant/customers",
    customerPayload(values),
    config(),
  );
  return mapCustomer(response.data.data);
}

export async function updateCustomer(id, values) {
  const response = await api.patch(
    `/tenant/customers/${id}`,
    customerPayload(values),
    config(),
  );
  return mapCustomer(response.data.data);
}

export async function createCustomerTraveller(customerId, values) {
  const response = await api.post(
    `/tenant/customers/${customerId}/travellers`,
    {
      travellerType: values.traveller_type,
      salutation: values.salutation || null,
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      department: values.department || null,
      employeeId: values.employee_id || null,
      notes: values.notes || null,
      status: "ACTIVE",
    },
    config(),
  );
  return mapTraveller(response.data.data, customerId);
}

export async function updateCustomerTraveller(customerId, travellerId, values) {
  const response = await api.patch(
    `/tenant/customers/${customerId}/travellers/${travellerId}`,
    {
      travellerType: values.traveller_type,
      salutation: values.salutation || null,
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      department: values.department || null,
      employeeId: values.employee_id || null,
      notes: values.notes || null,
      status: "ACTIVE",
    },
    config(),
  );
  return mapTraveller(response.data.data, customerId);
}

export function getCustomerErrorMessage(error) {
  const details = error.response?.data?.details;
  if (Array.isArray(details) && details.length) {
    return details
      .map((item) => item.message)
      .filter(Boolean)
      .join(", ");
  }
  return error.response?.data?.message || "Unable to complete customer action.";
}
