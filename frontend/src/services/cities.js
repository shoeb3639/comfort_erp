import axios from "axios";
import { readStoredSession } from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1",
  headers: { "Content-Type": "application/json" },
});

export async function searchIndianCities({ query, page = 1, signal } = {}) {
  const token = readStoredSession()?.accessToken;
  const response = await api.get("/tenant/cities", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params: { q: query || undefined, page, limit: 20 },
    signal,
  });
  return response.data.data;
}

export async function searchReportingPlaces({
  query,
  latitude,
  longitude,
  signal,
}) {
  const token = readStoredSession()?.accessToken;
  const response = await api.get("/tenant/cities/places", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    params: { q: query, latitude, longitude },
    signal,
  });
  return response.data.data;
}
