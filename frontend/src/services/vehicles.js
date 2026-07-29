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
export const listVehicles = async (params = {}) =>
  (await api.get("/tenant/vehicles", { ...config(), params })).data.data;
export const listVehicleTypes = async () =>
  (await api.get("/tenant/vehicles/types", config())).data.data;
export const createVehicleType = async (name) =>
  (await api.post("/tenant/vehicles/types", { name }, config())).data.data;
export const createVehicle = async (payload) =>
  (await api.post("/tenant/vehicles", payload, config())).data.data;
export const updateVehicle = async (id, payload) =>
  (await api.patch(`/tenant/vehicles/${id}`, payload, config())).data.data;
export const deleteVehicle = (id) =>
  api.delete(`/tenant/vehicles/${id}`, config());
