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

export async function getAccountsFoundation() {
  return (await api.get("/tenant/accounts/foundation", config())).data.data;
}

export async function recordDriverReturn(collectionId, values) {
  return (
    await api.post(
      `/tenant/accounts/collections/${collectionId}/driver-returns`,
      { ...values, amount: Number(values.amount) },
      config(),
    )
  ).data.data;
}

export async function validateAccountReference(referenceNumber) {
  return (
    await api.post(
      "/tenant/accounts/references/validate",
      { referenceNumber },
      config(),
    )
  ).data.data;
}

export async function listAccountCollections(params) {
  return (
    await api.get("/tenant/accounts/collections", {
      ...config(),
      params,
    })
  ).data.data;
}

export async function getAccountCollection(collectionId) {
  return (
    await api.get(`/tenant/accounts/collections/${collectionId}`, config())
  ).data.data;
}

export async function listCashDeposits(params) {
  return (
    await api.get("/tenant/accounts/cash-deposits", {
      ...config(),
      params,
    })
  ).data.data;
}

export async function getCashDeposit(depositId) {
  return (
    await api.get(`/tenant/accounts/cash-deposits/${depositId}`, config())
  ).data.data;
}

export async function receiveCashDeposit(depositId, body) {
  return (
    await api.patch(
      `/tenant/accounts/cash-deposits/${depositId}/receive`,
      body,
      config(),
    )
  ).data.data;
}

export async function recordCashDeposit(depositId, body) {
  return (
    await api.patch(
      `/tenant/accounts/cash-deposits/${depositId}/deposit`,
      body,
      config(),
    )
  ).data.data;
}

export async function verifyCashDeposit(depositId, body) {
  return (
    await api.patch(
      `/tenant/accounts/cash-deposits/${depositId}/verify`,
      body,
      config(),
    )
  ).data.data;
}

export async function listManagerLedgers(params = {}) {
  return (
    await api.get("/tenant/accounts/manager-ledgers", {
      ...config(),
      params,
    })
  ).data.data;
}

export async function getManagerLedger(ledgerId) {
  return (
    await api.get(`/tenant/accounts/manager-ledgers/${ledgerId}`, config())
  ).data.data;
}

export async function createManagerLedger(body) {
  return (await api.post("/tenant/accounts/manager-ledgers", body, config()))
    .data.data;
}

export async function updateManagerLedgerStatus(ledgerId, body) {
  return (
    await api.patch(
      `/tenant/accounts/manager-ledgers/${ledgerId}/status`,
      body,
      config(),
    )
  ).data.data;
}

export async function listFundReleases(params = {}) {
  return (
    await api.get("/tenant/accounts/fund-releases", {
      ...config(),
      params,
    })
  ).data.data;
}

export async function getFundRelease(releaseId) {
  return (
    await api.get(`/tenant/accounts/fund-releases/${releaseId}`, config())
  ).data.data;
}

export async function createFundRelease(body) {
  return (await api.post("/tenant/accounts/fund-releases", body, config())).data
    .data;
}

export async function listAccountTransactions(params = {}) {
  return (
    await api.get("/tenant/accounts/transactions", { ...config(), params })
  ).data.data;
}

export async function createAccountTransaction(body) {
  return (await api.post("/tenant/accounts/transactions", body, config())).data
    .data;
}

export async function getDailyClosing(params) {
  return (
    await api.get("/tenant/accounts/daily-closing", { ...config(), params })
  ).data.data;
}

export async function setDailyClosingStatus(body) {
  return (await api.put("/tenant/accounts/daily-closing", body, config())).data
    .data;
}

export async function getAccountsAudit() {
  return (await api.get("/tenant/accounts/audit", config())).data.data;
}

export async function resolveAuditException(body) {
  return (await api.patch("/tenant/accounts/audit/resolve", body, config()))
    .data.data;
}

export function getAccountsErrorMessage(error) {
  const details = error.response?.data?.details;
  if (Array.isArray(details) && details.length) {
    return details
      .map((item) => item.message)
      .filter(Boolean)
      .join(", ");
  }
  return error.response?.data?.message || "Unable to load Accounts.";
}
