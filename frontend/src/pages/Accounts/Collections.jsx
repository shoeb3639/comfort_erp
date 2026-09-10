import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  IndianRupee,
  LoaderCircle,
  Plus,
  Printer,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import ActionNotice from "../../components/ActionNotice";
import DriverSettlement from "../../components/DriverSettlement";
import {
  getAccountCollection,
  getAccountsErrorMessage,
  listAccountCollections,
} from "../../services/accounts";
import {
  addBookingCollection,
  getBookingErrorMessage,
  verifyBookingCollection,
  voidBookingCollection,
} from "../../services/bookings";

const initialFilters = {
  dateFrom: "",
  dateTo: "",
  paymentMode: "",
  status: "",
  booking: "",
  customerId: "",
  search: "",
  page: 1,
  limit: 50,
};

const initialCollection = {
  bookingId: "",
  collectionDate: new Date().toISOString().slice(0, 10),
  amount: "",
  paymentMode: "Cash",
  collectedBy: "Admin",
  receiverName: "",
  referenceNumber: "",
  remarks: "",
  depositStatus: "Directly Received",
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

function statusTone(status) {
  if (["PAID", "VERIFIED", "DIRECTLY_RECEIVED"].includes(status))
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  if (["PARTIALLY_PAID", "PENDING", "WITH_MANAGER"].includes(status))
    return "bg-amber-50 text-amber-800 ring-amber-600/20";
  if (status === "VOID") return "bg-rose-50 text-rose-700 ring-rose-600/20";
  return "bg-slate-100 text-slate-700 ring-slate-500/20";
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(status)}`}
    >
      {label(status)}
    </span>
  );
}

function SummaryCard({ label: cardLabel, value, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : "text-slate-950";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {cardLabel}
      </p>
      <p className={`mt-2 text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4 print:static print:bg-white print:p-0">
      <section
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl print:max-h-none print:shadow-none ${
          wide ? "max-w-5xl" : "max-w-2xl"
        }`}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 print:hidden">
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <div className="p-5 print:p-0">{children}</div>
      </section>
    </div>
  );
}

export default function AccountsCollectionsPage() {
  const [searchParams] = useSearchParams();
  const receiptId = searchParams.get("receipt");
  const { user } = useAuth();
  const permissions = new Set(user?.permissions || []);
  const canCreate = permissions.has("collection.create");
  const canVerify = permissions.has("accounts.deposit.manage");
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [collectionForm, setCollectionForm] = useState(initialCollection);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(appliedFilters).filter(
          ([, value]) => value !== "" && value !== null,
        ),
      );
      setData(await listAccountCollections(params));
    } catch (error) {
      setNotice({ tone: "error", message: getAccountsErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (receiptId) viewCollection(receiptId);
  }, [receiptId]);

  const selectedBooking = useMemo(
    () =>
      data?.bookingSummaries.find(
        (booking) => booking.bookingNumber === collectionForm.bookingId,
      ),
    [collectionForm.bookingId, data],
  );

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    setAppliedFilters({ ...filters, page: 1 });
  }

  async function viewCollection(collectionId) {
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await getAccountCollection(collectionId));
    } catch (error) {
      setNotice({ tone: "error", message: getAccountsErrorMessage(error) });
    } finally {
      setDetailLoading(false);
    }
  }

  async function addCollection(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await addBookingCollection(collectionForm.bookingId, {
        ...collectionForm,
        depositStatus:
          collectionForm.paymentMode === "Cash"
            ? "Pending"
            : "Directly Received",
      });
      setShowAdd(false);
      setCollectionForm(initialCollection);
      setNotice({
        tone: "success",
        message: "Collection recorded successfully.",
      });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: getBookingErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function verifyCollection() {
    if (!detail) return;
    try {
      await verifyBookingCollection(
        detail.booking.bookingId,
        detail.id,
        user?.name || "Accounts User",
      );
      setNotice({
        tone: "success",
        message: "Collection verified successfully.",
      });
      setDetail(await getAccountCollection(detail.id));
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: getBookingErrorMessage(error) });
    }
  }

  async function voidCollection() {
    if (
      !detail ||
      !window.confirm(
        "Void this collection? The audit record and reference number will be retained.",
      )
    )
      return;
    try {
      await voidBookingCollection(detail.booking.bookingId, detail.id);
      setNotice({
        tone: "success",
        message: "Collection voided successfully.",
      });
      setDetail(await getAccountCollection(detail.id));
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: getBookingErrorMessage(error) });
    }
  }

  return (
    <div className="space-y-5">
      <ActionNotice
        message={notice?.message}
        tone={notice?.tone}
        onDismiss={() => setNotice(null)}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="Total Billed"
          value={`₹ ${money(data?.summary.totalBilled)}`}
        />
        <SummaryCard
          label="Collected"
          value={`₹ ${money(data?.summary.totalCollected)}`}
          tone="success"
        />
        <SummaryCard
          label="Balance"
          value={`₹ ${money(data?.summary.outstandingBalance)}`}
          tone="warning"
        />
        <SummaryCard label="Paid" value={data?.summary.paidBookings || 0} />
        <SummaryCard
          label="Partial"
          value={data?.summary.partiallyPaidBookings || 0}
          tone="warning"
        />
        <SummaryCard label="Unpaid" value={data?.summary.unpaidBookings || 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Fuel from customer payments"
          value={`₹ ${money(data?.summary.fuelFromCollections)}`}
        />
        <SummaryCard
          label="Returned by drivers"
          value={`₹ ${money(data?.summary.driverReturns)}`}
          tone="success"
        />
        <SummaryCard
          label="Still held by drivers"
          value={`₹ ${money(data?.summary.driverBalance)}`}
          tone="warning"
        />
      </div>

      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={applyFilters}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search booking or customer"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={filters.booking}
            onChange={(event) => updateFilter("booking", event.target.value)}
          >
            <option value="">All bookings</option>
            {(data?.filters.bookings || []).map((booking) => (
              <option key={booking.id} value={booking.bookingId}>
                {booking.bookingId} — {booking.customerName}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={filters.customerId}
            onChange={(event) => updateFilter("customerId", event.target.value)}
          >
            <option value="">All customers</option>
            {(data?.filters.customers || []).map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={filters.paymentMode}
            onChange={(event) =>
              updateFilter("paymentMode", event.target.value)
            }
          >
            <option value="">All payment modes</option>
            {["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE"].map((mode) => (
              <option key={mode} value={mode}>
                {label(mode)}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="">All active statuses</option>
            {[
              "PENDING",
              "WITH_MANAGER",
              "DEPOSITED",
              "VERIFIED",
              "DIRECTLY_RECEIVED",
              "VOID",
            ].map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => updateFilter("dateFrom", event.target.value)}
            aria-label="Collection date from"
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="date"
            value={filters.dateTo}
            onChange={(event) => updateFilter("dateTo", event.target.value)}
            aria-label="Collection date to"
          />
          <div className="flex gap-2">
            <button className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Apply Filters
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
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-950">Collection Register</h2>
            <p className="text-sm text-slate-500">
              {data?.pagination.total || 0} collection records
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setShowAdd(true)}
            >
              <Plus size={16} /> Add Collection
            </button>
          )}
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-[1150px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  "Receipt",
                  "Date",
                  "Booking",
                  "Customer",
                  "Mode",
                  "Reference",
                  "Amount",
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
                  <td className="px-4 py-8 text-center" colSpan={9}>
                    <LoaderCircle
                      className="mx-auto animate-spin text-brand-600"
                      size={22}
                    />
                  </td>
                </tr>
              ) : data?.collections.length ? (
                data.collections.map((collection) => (
                  <tr key={collection.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {collection.receiptNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {collection.collectionDate}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        className="font-semibold text-brand-600"
                        to={`/bookings/${collection.booking.bookingId}`}
                      >
                        {collection.booking.bookingId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {collection.customer.name}
                    </td>
                    <td className="px-4 py-3">{collection.paymentModeLabel}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {collection.referenceNumber || "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      ₹ {money(collection.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={collection.status} />
                      {collection.paymentHolder === "DRIVER" && (
                        <p className="mt-1 text-xs text-amber-800">
                          {collection.collectedBy}: ₹{" "}
                          {money(collection.driverBalance)} held
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-semibold text-brand-600"
                        onClick={() => viewCollection(collection.id)}
                      >
                        <Eye size={15} /> View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-10 text-center text-slate-500"
                    colSpan={9}
                  >
                    No collection records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {(data?.pagination.pages || 1) > 1 && (
          <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm">
            <span className="text-slate-500">
              Page {data.pagination.page} of {data.pagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={data.pagination.page <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
                onClick={() =>
                  setAppliedFilters((current) => ({
                    ...current,
                    page: Math.max(1, current.page - 1),
                  }))
                }
              >
                Previous
              </button>
              <button
                type="button"
                disabled={data.pagination.page >= data.pagination.pages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
                onClick={() =>
                  setAppliedFilters((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                Next
              </button>
            </div>
          </footer>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-950">Booking Payment Tracking</h2>
          <p className="text-sm text-slate-500">
            Includes paid, partially paid and unpaid closed bookings.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Booking",
                  "Customer",
                  "Billed",
                  "Collected",
                  "Balance",
                  "With Driver",
                  "Payment Status",
                  "Manage",
                ].map((column) => (
                  <th key={column} className="px-4 py-3">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.bookingSummaries || []).map((booking) => (
                <tr key={booking.bookingId}>
                  <td className="px-4 py-3 font-semibold">
                    {booking.bookingNumber}
                  </td>
                  <td className="px-4 py-3">{booking.customerName}</td>
                  <td className="px-4 py-3">
                    ₹ {money(booking.totalBillAmount)}
                  </td>
                  <td className="px-4 py-3 text-emerald-700">
                    ₹ {money(booking.totalCollected)}
                  </td>
                  <td className="px-4 py-3 text-amber-700">
                    ₹ {money(booking.balance)}
                  </td>
                  <td className="px-4 py-3 text-amber-700">
                    ₹ {money(booking.driverBalance)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={booking.paymentStatus} />
                  </td>
                  <td className="px-4 py-3">
                    {canCreate ? (
                      <button
                        className="font-semibold text-brand-600"
                        type="button"
                        onClick={() => {
                          setCollectionForm({
                            ...initialCollection,
                            bookingId: booking.bookingNumber,
                            amount: booking.balance || "",
                          });
                          setShowAdd(true);
                        }}
                      >
                        Add Payment
                      </button>
                    ) : (
                      <Link
                        className="font-semibold text-brand-600"
                        to={`/bookings/${booking.bookingNumber}/collections`}
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!!data?.driverSummaries?.length && (
        <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">Driver balances</h2>
          <p className="mb-3 text-sm text-slate-500">
            Customer payments, fuel spending and returns across the selected
            bookings.
          </p>
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                {[
                  "Driver",
                  "Customer payments",
                  "Fuel spent",
                  "Returned to company",
                  "Still with driver",
                ].map((label) => (
                  <th className="p-3" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.driverSummaries.map((driver) => (
                <tr key={driver.id} className="border-t border-slate-100">
                  <td className="p-3 font-semibold">{driver.name}</td>
                  {[
                    driver.collected,
                    driver.fuel,
                    driver.returned,
                    driver.balance,
                  ].map((amount, index) => (
                    <td key={index} className="p-3">
                      ₹ {money(amount)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {showAdd && (
        <Modal
          title="Record Booking Collection"
          onClose={() => setShowAdd(false)}
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={addCollection}>
            <label className="md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Booking
              </span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                required
                value={collectionForm.bookingId}
                onChange={(event) =>
                  setCollectionForm((current) => ({
                    ...current,
                    bookingId: event.target.value,
                  }))
                }
              >
                <option value="">Select closed booking</option>
                {(data?.bookingSummaries || [])
                  .filter((booking) => booking.balance > 0)
                  .map((booking) => (
                    <option
                      key={booking.bookingId}
                      value={booking.bookingNumber}
                    >
                      {booking.bookingNumber} — {booking.customerName} — Balance
                      ₹ {money(booking.balance)}
                    </option>
                  ))}
              </select>
            </label>
            {selectedBooking && (
              <div className="md:col-span-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Pending balance:{" "}
                <strong>₹ {money(selectedBooking.balance)}</strong>
              </div>
            )}
            {[
              ["collectionDate", "Collection Date", "date"],
              ["amount", "Amount", "number"],
              ["receiverName", "Receiver Name", "text"],
              ["referenceNumber", "Payment Reference", "text"],
            ].map(([name, fieldLabel, type]) => (
              <label key={name}>
                <span className="text-sm font-semibold text-slate-700">
                  {fieldLabel}
                </span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  type={type}
                  step={type === "number" ? "0.01" : undefined}
                  max={
                    name === "amount" && selectedBooking
                      ? selectedBooking.balance
                      : undefined
                  }
                  required={["collectionDate", "amount"].includes(name)}
                  value={collectionForm[name]}
                  onChange={(event) =>
                    setCollectionForm((current) => ({
                      ...current,
                      [name]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
            <label>
              <span className="text-sm font-semibold text-slate-700">
                Payment Mode
              </span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={collectionForm.paymentMode}
                onChange={(event) =>
                  setCollectionForm((current) => ({
                    ...current,
                    paymentMode: event.target.value,
                  }))
                }
              >
                {["Cash", "UPI", "Bank Transfer", "Card", "Cheque"].map(
                  (mode) => (
                    <option key={mode}>{mode}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-700">
                Collected By
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                required
                value={collectionForm.collectedBy}
                onChange={(event) =>
                  setCollectionForm((current) => ({
                    ...current,
                    collectedBy: event.target.value,
                  }))
                }
              />
            </label>
            <label className="md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Remarks
              </span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={collectionForm.remarks}
                onChange={(event) =>
                  setCollectionForm((current) => ({
                    ...current,
                    remarks: event.target.value,
                  }))
                }
              />
            </label>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <IndianRupee size={16} />
                {saving ? "Saving…" : "Record Collection"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {(detailLoading || detail) && (
        <Modal
          title="Collection Receipt & Audit"
          wide
          onClose={() => setDetail(null)}
        >
          {detailLoading && !detail ? (
            <LoaderCircle className="mx-auto animate-spin" />
          ) : detail ? (
            <div className="space-y-5">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Collection Receipt
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-950">
                    {detail.receiptNumber}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {detail.collectionDate}
                  </p>
                </div>
                <div className="flex items-start gap-2 print:hidden">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
                    onClick={() => window.print()}
                    type="button"
                  >
                    <Printer size={16} /> Print
                  </button>
                  {canVerify &&
                    !["VERIFIED", "VOID"].includes(detail.status) &&
                    detail.driverBalance === 0 && (
                      <button
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                        onClick={verifyCollection}
                        type="button"
                      >
                        <ShieldCheck size={16} /> Verify
                      </button>
                    )}
                  {canCreate &&
                    detail.status !== "VOID" &&
                    !detail.fuelAmount &&
                    !detail.returnedAmount && (
                      <button
                        className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
                        onClick={voidCollection}
                        type="button"
                      >
                        Void
                      </button>
                    )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Booking", detail.booking.bookingId],
                  ["Customer", detail.customer.name],
                  ["Invoice", detail.invoice?.invoiceNumber || "Draft"],
                  ["Amount", `₹ ${money(detail.amount)}`],
                  ["Payment Mode", detail.paymentModeLabel],
                  ["Status", detail.statusLabel],
                  ["Payment Reference", detail.referenceNumber || "—"],
                  ["Collected By", detail.collectedBy],
                  ["Receiver", detail.receiverName || "—"],
                  ["Deposit Date", detail.depositDate || "—"],
                  ["Deposit Reference", detail.depositReferenceNumber || "—"],
                  ["Verified By", detail.verifiedBy || "—"],
                ].map(([fieldLabel, value]) => (
                  <div key={fieldLabel} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      {fieldLabel}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              <DriverSettlement
                key={detail.id}
                collection={detail}
                onUpdated={async (updated) => {
                  setDetail(updated);
                  await load();
                }}
              />

              <section>
                <h4 className="font-bold text-slate-950">Audit Trail</h4>
                <div className="mt-3 space-y-3">
                  {detail.auditTrail.length ? (
                    detail.auditTrail.map((event) => (
                      <div
                        key={event.id}
                        className="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {label(event.action)}
                          </p>
                          <p className="text-sm text-slate-500">
                            {event.actor?.name || "System"} ·{" "}
                            {new Date(event.createdAt).toLocaleString("en-IN")}
                          </p>
                          {event.action === "DRIVER_RETURN" && (
                            <p className="mt-1 text-sm text-slate-700">
                              ₹ {money(event.newValues.amount)} received via{" "}
                              {label(event.newValues.paymentMode)} on{" "}
                              {event.newValues.returnDate} · Reference:{" "}
                              {event.newValues.referenceNumber} · Driver
                              balance: ₹ {money(event.newValues.driverBalance)}
                            </p>
                          )}
                          {event.remarks && (
                            <p className="text-sm text-slate-600">
                              {event.remarks}
                            </p>
                          )}
                        </div>
                        {event.newValues?.status && (
                          <StatusBadge status={event.newValues.status} />
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      No audit events recorded.
                    </p>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
