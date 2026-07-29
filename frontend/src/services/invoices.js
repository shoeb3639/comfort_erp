import axios from "axios";
import { readStoredSession } from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1",
  headers: { "Content-Type": "application/json" },
});

const config = (params) => {
  const token = readStoredSession()?.accessToken;
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(params ? { params } : {}),
  };
};

export const listInvoices = async (params = {}) =>
  (await api.get("/tenant/invoices", config(params))).data.data;

export const getInvoice = async (invoiceId) =>
  (await api.get(`/tenant/invoices/${invoiceId}`, config())).data.data;

export const generateInvoice = async (invoiceId) =>
  (await api.patch(`/tenant/invoices/${invoiceId}/generate`, {}, config())).data
    .data;
