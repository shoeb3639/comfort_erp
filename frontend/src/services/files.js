import axios from "axios";
import { readStoredSession } from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1",
});
function config() {
  const token = readStoredSession()?.accessToken;
  return { headers: token ? { Authorization: `Bearer ${token}` } : {} };
}

export async function uploadFuelReceipt(bookingId, file) {
  const form = new FormData();
  form.append("entityType", "BOOKING");
  form.append("entityId", bookingId);
  form.append("documentType", "FUEL_RECEIPT");
  form.append("file", file);
  return (await api.post("/tenant/files", form, config())).data.data;
}

export async function downloadReceipt(file) {
  const response = await api.get(`/tenant/files/${file.id}/download`, {
    ...config(),
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name || file.originalFileName || "fuel-receipt";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
