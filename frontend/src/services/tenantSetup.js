import axios from "axios";
import {
  clearSession,
  readStoredSession,
  refreshSession,
  storeSession,
} from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1",
  headers: { "Content-Type": "application/json" },
});

let refreshPromise = null;

function config(token = readStoredSession()?.accessToken) {
  return { headers: token ? { Authorization: `Bearer ${token}` } : {} };
}

async function getFreshSession(staleSession) {
  const currentSession = readStoredSession();
  if (
    currentSession?.accessToken &&
    currentSession.accessToken !== staleSession.accessToken
  ) {
    return currentSession;
  }

  if (!refreshPromise) {
    refreshPromise = refreshSession(staleSession.refreshToken)
      .then((refreshed) => {
        storeSession(refreshed);
        return refreshed;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(method, path, body) {
  const session = readStoredSession();
  try {
    return (
      await api.request({
        method,
        url: `/tenant/setup${path}`,
        ...(body === undefined ? {} : { data: body }),
        ...config(session?.accessToken),
      })
    ).data.data;
  } catch (error) {
    if (error.response?.status !== 401 || !session?.refreshToken) throw error;

    try {
      const refreshed = await getFreshSession(session);
      return (
        await api.request({
          method,
          url: `/tenant/setup${path}`,
          ...(body === undefined ? {} : { data: body }),
          ...config(refreshed.accessToken),
        })
      ).data.data;
    } catch (refreshError) {
      clearSession();
      throw refreshError;
    }
  }
}

async function get(path) {
  return request("get", path);
}

async function post(path, body) {
  return request("post", path, body);
}

async function patch(path, body) {
  return request("patch", path, body);
}

export const getCompanyProfile = () => get("/company-profile");
export const updateCompanyProfile = (body) => patch("/company-profile", body);
export const getTaxSettings = () => get("/tax-settings");
export const updateTaxSettings = (body) => patch("/tax-settings", body);
export const getInvoiceSettings = () => get("/invoice-settings");
export const updateInvoiceSettings = (body) => patch("/invoice-settings", body);
export const getOnboarding = () => get("/onboarding");

export const getLocations = () => get("/locations");
export const createLocation = (body) => post("/locations", body);
export const updateLocation = (id, body) => patch(`/locations/${id}`, body);

export const getBankAccounts = () => get("/bank-accounts");
export const createBankAccount = (body) => post("/bank-accounts", body);
export const updateBankAccount = (id, body) =>
  patch(`/bank-accounts/${id}`, body);

export const getGstRegistrations = () => get("/gst-registrations");
export const createGstRegistration = (body) => post("/gst-registrations", body);
export const updateGstRegistration = (id, body) =>
  patch(`/gst-registrations/${id}`, body);

export const getTenantUsers = () => get("/users");
export const createTenantUser = (body) => post("/users", body);
export const updateTenantUser = (id, body) => patch(`/users/${id}`, body);

export const getTenantRoles = () => get("/roles");
export const createTenantRole = (body) => post("/roles", body);
export const updateTenantRole = (id, body) => patch(`/roles/${id}`, body);
export const updateRolePermissions = (id, permissionIds) =>
  patch(`/roles/${id}/permissions`, { permissionIds });
export const getTenantPermissions = () => get("/permissions");

export function getSetupErrorMessage(error) {
  const details = error.response?.data?.details;
  if (Array.isArray(details) && details.length) {
    return details
      .map((item) => item.message)
      .filter(Boolean)
      .join(", ");
  }
  return error.response?.data?.message || "Unable to save company setup.";
}
