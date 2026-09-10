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
export const listDrivers = async (params = {}) =>
  (await api.get("/tenant/drivers", { ...config(), params })).data.data;
export const createDriver = async (payload) =>
  (await api.post("/tenant/drivers", payload, config())).data.data;
export const updateDriver = async (id, payload) =>
  (await api.patch(`/tenant/drivers/${id}`, payload, config())).data.data;
export const deleteDriver = (id) =>
  api.delete(`/tenant/drivers/${id}`, config());
export const getDriverLedger = async (id) =>
  (await api.get(`/tenant/drivers/${id}/ledger`, config())).data.data;
