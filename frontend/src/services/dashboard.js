import axios from "axios";
import { readStoredSession } from "./auth";

function requestConfig(signal) {
  const token = readStoredSession()?.accessToken;
  return {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
}

export async function getDashboardOverview(signal) {
  const response = await axios.get(
    `${import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1"}/tenant/dashboard/overview`,
    requestConfig(signal),
  );
  return response.data.data;
}

export async function getCardMetric(params, signal) {
  const token = readStoredSession()?.accessToken;
  const response = await axios.get(
    `${import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1"}/tenant/dashboard/card`,
    {
      params,
      signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  return response.data.data;
}

export async function getOutstandingCustomers(signal) {
  const token = readStoredSession()?.accessToken;
  const response = await axios.get(
    `${import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1"}/tenant/dashboard/outstanding-customers`,
    {
      signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  return response.data.data;
}

export async function getVehiclePerformance(ownership, range, signal) {
  const token = readStoredSession()?.accessToken;
  const response = await axios.get(
    `${import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1"}/tenant/dashboard/vehicle-performance`,
    {
      signal,
      params: { ownership, ...range },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  return response.data.data;
}
