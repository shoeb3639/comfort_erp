import { useCallback, useEffect, useState } from "react";
import {
  BanknoteArrowDown,
  Eye,
  LoaderCircle,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import ActionNotice from "../../components/ActionNotice";
import {
  getAccountsErrorMessage,
  getCashDeposit,
  listCashDeposits,
  receiveCashDeposit,
  recordCashDeposit,
  verifyCashDeposit,
} from "../../services/accounts";

const initialFilters = {
  dateFrom: "",
  dateTo: "",
  status: "",
  managerId: "",
  customerId: "",
  booking: "",
  search: "",
  page: 1,
  limit: 50,
};

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function label(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function StatusBadge({ status }) {
  const tone =
    status === "VERIFIED"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : status === "MISMATCH"
        ? "bg-rose-50 text-rose-700 ring-rose-600/20"
        : ["COLLECTED", "WITH_MANAGER"].includes(status)
          ? "bg-amber-50 text-amber-800 ring-amber-600/20"
          : "bg-brand-50 text-brand-700 ring-brand-600/20";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}
    >
      {label(status)}
    </span>
  );
}

function SummaryCard({ title, value, tone = "" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p
        className={`mt-2 text-xl font-bold ${
          tone === "success"
            ? "text-emerald-700"
            : tone === "danger"
              ? "text-rose-700"
              : tone === "warning"
                ? "text-amber-700"
                : "text-slate-950"
        }`}
      >
        ₹ {money(value)}
      </p>
    </div>
  );
}

function DetailModal({
  deposit,
  managers,
  userName,
  onClose,
  onChanged,
  onError,
}) {
  const [action, setAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    managerId: "",
    depositedAmount: deposit.amountCollected,
    depositDate: new Date().toISOString().slice(0, 10),
    depositMode: "CASH_DEPOSIT",
    bankReference: "",
    depositedBy: userName || "Accounts User",
    verifiedAmount: deposit.depositedAmount,
    verifiedBy: userName || "Accounts User",
    mismatchReason: "",
    remarks: "",
  });

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      let updated;
      if (action === "receive") {
        updated = await receiveCashDeposit(deposit.id, {
          managerId: form.managerId,
          remarks: form.remarks || null,
        });
      } else if (action === "deposit") {
        updated = await recordCashDeposit(deposit.id, {
          depositedAmount: Number(form.depositedAmount),
          depositDate: form.depositDate,
          depositMode: form.depositMode,
          bankReference: form.bankReference,
          depositedBy: form.depositedBy,
          remarks: form.remarks || null,
        });
      } else {
        updated = await verifyCashDeposit(deposit.id, {
          verifiedAmount: Number(form.verifiedAmount),
          verifiedBy: form.verifiedBy,
          mismatchReason: form.mismatchReason || null,
          remarks: form.remarks || null,
        });
      }
      await onChanged(updated, action);
      setAction("");
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    ["Tracking No.", deposit.trackingNumber],
    ["Booking", deposit.booking.bookingId],
    ["Customer", deposit.customer.name],
    ["Collection Receipt", deposit.collection.receiptNumber],
    ["Collection Date", deposit.collection.collectionDate],
    ["Collected By", deposit.collection.collectedBy],
    ["Cash Collected", `₹ ${money(deposit.amountCollected)}`],
    ["Deposited", `₹ ${money(deposit.depositedAmount)}`],
    ["Receiver Manager", deposit.receiverManager?.name || "—"],
    ["Deposit Date", deposit.depositDate || "—"],
    ["Deposit Mode", deposit.depositModeLabel || "—"],
    ["Bank Reference", deposit.bankReference || "—"],
    ["Deposited By", deposit.depositedBy || "—"],
    [
      "Verified Amount",
      deposit.verifiedAmount === null
        ? "—"
        : `₹ ${money(deposit.verifiedAmount)}`,
    ],
    ["Verified By", deposit.verifiedBy || "—"],
    ["Mismatch", `₹ ${money(deposit.mismatchAmount)}`],
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
      <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Cash Deposit Tracking
            </h2>
            <p className="text-sm text-slate-500">{deposit.trackingNumber}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-slate-100"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge status={deposit.status} />
            <div className="flex flex-wrap gap-2">
              {deposit.status === "COLLECTED" && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
                  onClick={() => setAction("receive")}
                >
                  <UserRoundCheck size={16} /> Assign Manager
                </button>
              )}
              {["COLLECTED", "WITH_MANAGER"].includes(deposit.status) && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => setAction("deposit")}
                >
                  <BanknoteArrowDown size={16} /> Record Deposit
                </button>
              )}
              {deposit.status === "DEPOSITED" && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => setAction("verify")}
                >
                  <ShieldCheck size={16} /> Verify Bank Credit
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {fields.map(([fieldLabel, value]) => (
              <div key={fieldLabel} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {fieldLabel}
                </p>
                <p className="mt-1 font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {deposit.mismatchReason && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <strong>Mismatch reason:</strong> {deposit.mismatchReason}
            </div>
          )}

          {action && (
            <form
              className="rounded-xl border border-brand-200 bg-brand-50/40 p-4"
              onSubmit={submit}
            >
              <h3 className="font-bold text-slate-950">
                {action === "receive"
                  ? "Assign Cash to Manager"
                  : action === "deposit"
                    ? "Record Company Bank Deposit"
                    : "Verify Company Bank Credit"}
              </h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {action === "receive" && (
                  <label>
                    <span className="text-sm font-semibold">
                      Receiver Manager
                    </span>
                    <select
                      required
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                      value={form.managerId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          managerId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select manager</option>
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} — {manager.role}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {action === "deposit" && (
                  <>
                    <label>
                      <span className="text-sm font-semibold">
                        Deposited Amount
                      </span>
                      <input
                        required
                        type="number"
                        min="0.01"
                        max={deposit.amountCollected}
                        step="0.01"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                        value={form.depositedAmount}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            depositedAmount: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="text-sm font-semibold">
                        Deposit Date
                      </span>
                      <input
                        required
                        type="date"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                        value={form.depositDate}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            depositDate: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="text-sm font-semibold">
                        Deposit Mode
                      </span>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                        value={form.depositMode}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            depositMode: event.target.value,
                          }))
                        }
                      >
                        <option value="CASH_DEPOSIT">Cash Deposit</option>
                        <option value="UPI">UPI</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-sm font-semibold">
                        Bank Reference
                      </span>
                      <input
                        required
                        minLength={3}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                        value={form.bankReference}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            bankReference: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="text-sm font-semibold">
                        Deposited By
                      </span>
                      <input
                        required
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                        value={form.depositedBy}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            depositedBy: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                )}
                {action === "verify" && (
                  <>
                    <label>
                      <span className="text-sm font-semibold">
                        Bank-Credited Amount
                      </span>
                      <input
                        required
                        type="number"
                        min="0"
                        max={deposit.depositedAmount}
                        step="0.01"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                        value={form.verifiedAmount}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            verifiedAmount: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="text-sm font-semibold">Verified By</span>
                      <input
                        required
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                        value={form.verifiedBy}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            verifiedBy: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="text-sm font-semibold">
                        Mismatch Reason
                      </span>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                        placeholder="Required if amounts differ"
                        value={form.mismatchReason}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            mismatchReason: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                )}
                <label className="md:col-span-2 xl:col-span-3">
                  <span className="text-sm font-semibold">Remarks</span>
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                    value={form.remarks}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        remarks: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
                  onClick={() => setAction("")}
                >
                  Cancel
                </button>
                <button
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Confirm"}
                </button>
              </div>
            </form>
          )}

          <section>
            <h3 className="font-bold text-slate-950">Audit Trail</h3>
            <div className="mt-3 space-y-3">
              {deposit.auditTrail.length ? (
                deposit.auditTrail.map((event) => (
                  <div
                    key={event.id}
                    className="flex justify-between gap-3 rounded-lg border border-slate-200 p-3"
                  >
                    <div>
                      <p className="font-semibold">{label(event.action)}</p>
                      <p className="text-sm text-slate-500">
                        {event.actor?.name || "System"} ·{" "}
                        {new Date(event.createdAt).toLocaleString("en-IN")}
                      </p>
                    </div>
                    {event.newValues?.status && (
                      <StatusBadge status={event.newValues.status} />
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Created from the linked cash collection. No transition has
                  been recorded yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

export default function BookingCashDepositPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(appliedFilters).filter(([, value]) => value !== ""),
      );
      setData(await listCashDeposits(params));
    } catch (error) {
      setNotice({ tone: "error", message: getAccountsErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(id) {
    try {
      setDetail(await getCashDeposit(id));
    } catch (error) {
      setNotice({ tone: "error", message: getAccountsErrorMessage(error) });
    }
  }

  async function changed(updated, action) {
    setDetail(updated);
    setNotice({
      tone:
        action === "verify" && updated.status === "MISMATCH"
          ? "warning"
          : "success",
      message:
        updated.status === "MISMATCH"
          ? "Deposit mismatch recorded for resolution."
          : action === "receive"
            ? "Cash assigned to manager."
            : action === "deposit"
              ? "Company bank deposit recorded."
              : "Bank credit verified.",
    });
    await load();
  }

  const summary = data?.summary || {};
  return (
    <div className="space-y-5">
      <ActionNotice
        message={notice?.message}
        tone={notice?.tone}
        onDismiss={() => setNotice(null)}
      />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          title="Total Cash Collected"
          value={summary.totalCashCollected}
        />
        <SummaryCard
          title="Cash With Manager"
          value={summary.cashWithManager}
          tone="warning"
        />
        <SummaryCard
          title="Deposited Amount"
          value={summary.depositedAmount}
          tone="success"
        />
        <SummaryCard
          title="Verified Amount"
          value={summary.verifiedAmount}
          tone="success"
        />
        <SummaryCard
          title="Pending Deposit"
          value={summary.pendingDeposit}
          tone="warning"
        />
        <SummaryCard
          title="Mismatch Amount"
          value={summary.mismatchAmount}
          tone="danger"
        />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
        Customer cash is company revenue. This register does not credit the
        manager ledger and cash must not be used for operational expenses.
      </div>

      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedFilters({ ...filters, page: 1 });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search booking or customer"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Booking ID"
            value={filters.booking}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                booking: event.target.value,
              }))
            }
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
          >
            <option value="">All statuses</option>
            {[
              "COLLECTED",
              "WITH_MANAGER",
              "DEPOSITED",
              "VERIFIED",
              "MISMATCH",
            ].map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={filters.managerId}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                managerId: event.target.value,
              }))
            }
          >
            <option value="">All receiver managers</option>
            {(data?.filters.managers || []).map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={filters.customerId}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                customerId: event.target.value,
              }))
            }
          >
            <option value="">All customers</option>
            {(data?.filters.customers || []).map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                dateFrom: event.target.value,
              }))
            }
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                dateTo: event.target.value,
              }))
            }
          />
          <div className="flex gap-2">
            <button className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Apply
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setFilters(initialFilters);
                setAppliedFilters(initialFilters);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-950">
            Booking Cash Deposit Register
          </h2>
          <p className="text-sm text-slate-500">
            {data?.pagination.total || 0} cash collection records
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Tracking",
                  "Booking",
                  "Customer",
                  "Collection Date",
                  "Cash Collected",
                  "Manager",
                  "Deposited",
                  "Bank Reference",
                  "Status",
                  "Action",
                ].map((column) => (
                  <th key={column} className="px-4 py-3">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center">
                    <LoaderCircle className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : data?.deposits.length ? (
                data.deposits.map((deposit) => (
                  <tr key={deposit.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold">
                      {deposit.trackingNumber}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/bookings/${deposit.booking.bookingId}`}
                        className="font-semibold text-brand-600"
                      >
                        {deposit.booking.bookingId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{deposit.customer.name}</td>
                    <td className="px-4 py-3">
                      {deposit.collection.collectionDate}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      ₹ {money(deposit.amountCollected)}
                    </td>
                    <td className="px-4 py-3">
                      {deposit.receiverManager?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      ₹ {money(deposit.depositedAmount)}
                    </td>
                    <td className="px-4 py-3">
                      {deposit.bankReference || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={deposit.status} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-semibold text-brand-600"
                        onClick={() => openDetail(deposit.id)}
                      >
                        <Eye size={15} /> View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No cash deposits match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <DetailModal
          deposit={detail}
          managers={data?.filters.managers || []}
          userName={user?.name}
          onClose={() => setDetail(null)}
          onChanged={changed}
          onError={(error) =>
            setNotice({
              tone: "error",
              message: getAccountsErrorMessage(error),
            })
          }
        />
      )}
    </div>
  );
}
