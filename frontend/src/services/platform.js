import axios from "axios";
import { readStoredSession } from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1",
  headers: { "Content-Type": "application/json" },
});

function authorizationHeaders() {
  const accessToken = readStoredSession()?.accessToken;
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export async function getTenants() {
  const response = await api.get("/platform/tenants", {
    headers: authorizationHeaders(),
  });
  return response.data.data;
}

export async function getTenant(tenantId) {
  const response = await api.get(`/platform/tenants/${tenantId}`, {
    headers: authorizationHeaders(),
  });
  return response.data.data;
}

export async function getSubscriptionPlans() {
  const response = await api.get("/platform/subscription-plans", {
    headers: authorizationHeaders(),
  });
  return response.data.data.filter((plan) => plan.isActive);
}

export async function getAllSubscriptionPlans() {
  const response = await api.get("/platform/subscription-plans", {
    headers: authorizationHeaders(),
  });
  return response.data.data;
}

export async function createSubscriptionPlan(payload) {
  const response = await api.post("/platform/subscription-plans", payload, {
    headers: authorizationHeaders(),
  });
  return response.data.data;
}

export async function updateSubscriptionPlan(planId, payload) {
  const response = await api.patch(
    `/platform/subscription-plans/${planId}`,
    payload,
    { headers: authorizationHeaders() },
  );
  return response.data.data;
}

export async function deactivateSubscriptionPlan(planId) {
  const response = await api.delete(`/platform/subscription-plans/${planId}`, {
    headers: authorizationHeaders(),
  });
  return response.data.data;
}

export async function registerTenant(payload) {
  const response = await api.post("/platform/tenants", payload, {
    headers: authorizationHeaders(),
  });
  return response.data.data;
}

export async function updateTenantStatus(tenantId, status, reason) {
  const response = await api.patch(
    `/platform/tenants/${tenantId}/status`,
    { status, reason },
    { headers: authorizationHeaders() },
  );
  return response.data.data;
}

export async function updateTenant(tenantId, payload) {
  const response = await api.patch(`/platform/tenants/${tenantId}`, payload, {
    headers: authorizationHeaders(),
  });
  return response.data.data;
}

export async function updateTenantOwner(tenantId, ownerId, payload) {
  const response = await api.patch(
    `/platform/tenants/${tenantId}/owners/${ownerId}`,
    payload,
    { headers: authorizationHeaders() },
  );
  return response.data.data;
}

export async function getTenantSubscriptions(tenantId) {
  const response = await api.get("/platform/tenant-subscriptions", {
    headers: authorizationHeaders(),
    params: tenantId ? { tenantId } : undefined,
  });
  return response.data.data;
}

export async function createTenantSubscription(payload) {
  const response = await api.post("/platform/tenant-subscriptions", payload, {
    headers: authorizationHeaders(),
  });
  return response.data.data;
}

export async function updateTenantSubscription(subscriptionId, payload) {
  const response = await api.patch(
    `/platform/tenant-subscriptions/${subscriptionId}`,
    payload,
    { headers: authorizationHeaders() },
  );
  return response.data.data;
}

export async function getPlatformAuditLogs() {
  const response = await api.get("/platform/audit-logs", {
    headers: authorizationHeaders(),
  });
  return response.data.data;
}

export function getPlatformErrorMessage(error) {
  const details = error.response?.data?.details;
  if (Array.isArray(details) && details.length > 0) {
    return details
      .map((detail) => detail.message)
      .filter(Boolean)
      .join(", ");
  }
  return error.response?.data?.message || "Unable to complete the request.";
}
