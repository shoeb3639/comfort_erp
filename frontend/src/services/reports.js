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

export async function getReportCatalog() {
  return (await api.get("/tenant/reports/catalog", config())).data.data;
}

export async function getReportOptions() {
  return (await api.get("/tenant/reports/options", config())).data.data;
}

export async function generateReport(reportKey, params = {}) {
  return (await api.get(`/tenant/reports/${reportKey}`, config(params))).data
    .data;
}
