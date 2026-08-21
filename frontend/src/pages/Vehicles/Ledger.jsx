import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Pagination from "../../components/Pagination";
import { getVehicleLedger } from "../../services/vehicles";

const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const initialFilters = {
  dateFrom: "",
  dateTo: "",
  groupBy: "MONTH",
  page: 1,
  limit: 25,
};

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function number(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function title(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function periodLabel(period) {
  if (period.length === 7) {
    const [year, month] = period.split("-");
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, 1),
    ).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return new Date(`${period}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(vehicle, entries, filters) {
  const columns = [
    ["date", "Date"],
    ["entryType", "Entry Type"],
    ["bookingNumber", "Booking"],
    ["customer", "Customer"],
    ["description", "Description"],
    ["category", "Category"],
    ["status", "Status"],
    ["openingKm", "Opening KM"],
    ["closingKm", "Closing KM"],
    ["runningKm", "Running KM"],
    ["billedAmount", "Bill Amount"],
    ["recoverableCharges", "Recoverable Charges"],
    ["revenue", "Profit Revenue"],
    ["bookingCost", "Booking Cost"],
    ["expenseAmount", "Expense"],
    ["netProfit", "Net Profit"],
    ["profitTreatment", "P&L Treatment"],
    ["referenceNumber", "Reference"],
  ];
  const rows = [
    columns.map(([, label]) => csvCell(label)).join(","),
    ...entries.map((entry) =>
      columns.map(([key]) => csvCell(entry[key])).join(","),
    ),
  ];
  const blob = new Blob(["\uFEFF", rows.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${vehicle.registrationNumber}-vehicle-ledger-${filters.dateFrom || "all"}-${filters.dateTo || "all"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function ProfitValue({ value }) {
  const numericValue = Number(value || 0);
  return (
    <span
      className={
        numericValue < 0
          ? "font-semibold text-rose-700"
          : "font-semibold text-emerald-700"
      }
    >
      {money(numericValue)}
    </span>
  );
}

function SummaryCard({ label, value, moneyValue = false, profit = false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-xl font-bold text-slate-950">
        {profit ? (
          <ProfitValue value={value} />
        ) : moneyValue ? (
          money(value)
        ) : (
          value
        )}
      </div>
    </div>
  );
}

export default function VehicleLedgerPage() {
  const { vehicleId } = useParams();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const requestFilters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== ""),
      ),
    [filters],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getVehicleLedger(vehicleId, requestFilters)
      .then((result) => {
        if (active) setLedger(result);
      })
      .catch((requestError) => {
        if (active)
          setError(
            requestError.response?.data?.message ||
              "Unable to load the vehicle register.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [vehicleId, requestFilters]);

  function applyFilters(event) {
    event.preventDefault();
    setFilters({ ...draftFilters, page: 1 });
  }

  async function exportAll() {
    setExporting(true);
    setError("");
    try {
      const first = await getVehicleLedger(vehicleId, {
        ...requestFilters,
        page: 1,
        limit: 100,
      });
      const entries = [...first.entries];
      for (let page = 2; page <= first.pagination.pages; page += 1) {
        const result = await getVehicleLedger(vehicleId, {
          ...requestFilters,
          page,
          limit: 100,
        });
        entries.push(...result.entries);
      }
      downloadCsv(first.vehicle, entries, filters);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to export the ledger.",
      );
    } finally {
      setExporting(false);
    }
  }

  if (loading && !ledger)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading vehicle register…
      </div>
    );

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {ledger && (
        <>
          <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-950">
                  {ledger.vehicle.registrationNumber}
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {title(ledger.vehicle.ownershipType)}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {[ledger.vehicle.make, ledger.vehicle.model]
                  .filter(Boolean)
                  .join(" ") || ledger.vehicle.vehicleType?.name}
                {ledger.vehicle.vendor?.name
                  ? ` • ${ledger.vehicle.vendor.name}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilters((current) => ({ ...current }))}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <RefreshCw size={16} /> Refresh
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={exportAll}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Download size={16} /> {exporting ? "Exporting…" : "Export CSV"}
              </button>
            </div>
          </section>

          <form
            onSubmit={applyFilters}
            className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
          >
            <label className="text-sm font-medium text-slate-700">
              From Date
              <input
                type="date"
                value={draftFilters.dateFrom}
                max={draftFilters.dateTo || undefined}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    dateFrom: event.target.value,
                  }))
                }
                className={`${fieldClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              To Date
              <input
                type="date"
                value={draftFilters.dateTo}
                min={draftFilters.dateFrom || undefined}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    dateTo: event.target.value,
                  }))
                }
                className={`${fieldClass} mt-1`}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              P&amp;L View
              <select
                value={draftFilters.groupBy}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    groupBy: event.target.value,
                  }))
                }
                className={`${fieldClass} mt-1`}
              >
                <option value="DAY">Daily</option>
                <option value="MONTH">Monthly</option>
              </select>
            </label>
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Apply Filters
            </button>
          </form>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Bookings" value={ledger.summary.bookings} />
            <SummaryCard
              label="Closed Bookings"
              value={ledger.summary.closedBookings}
            />
            <SummaryCard
              label="Running KM"
              value={number(ledger.summary.runningKm)}
            />
            <SummaryCard
              label="Billed Amount"
              value={ledger.summary.billedAmount}
              moneyValue
            />
            <SummaryCard
              label="Profit Revenue"
              value={ledger.summary.revenue}
              moneyValue
            />
            <SummaryCard
              label="Booking Costs"
              value={ledger.summary.bookingCosts}
              moneyValue
            />
            <SummaryCard
              label="Additional Vehicle Expenses"
              value={ledger.summary.additionalVehicleExpenses}
              moneyValue
            />
            <SummaryCard
              label="Net Vehicle Profit"
              value={ledger.summary.netProfit}
              profit
            />
          </section>

          {ledger.summary.linkedExpensesForReview > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {money(ledger.summary.linkedExpensesForReview)} of booking-linked
              expenses requires reconciliation. It is visible below but excluded
              from net profit to avoid double-counting approved booking costs.
            </div>
          )}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="font-bold text-slate-950">
                {filters.groupBy === "DAY" ? "Daily" : "Monthly"} Profit &amp;
                Loss
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {[
                      "Period",
                      "Bookings",
                      "Running KM",
                      "Revenue",
                      "Booking Costs",
                      "Vehicle Expenses",
                      "Net Profit",
                    ].map((label) => (
                      <th key={label} className="px-4 py-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.periods.map((period) => (
                    <tr
                      key={period.period}
                      className="border-t border-slate-100"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {periodLabel(period.period)}
                      </td>
                      <td className="px-4 py-3">{period.bookings}</td>
                      <td className="px-4 py-3">{number(period.runningKm)}</td>
                      <td className="px-4 py-3">{money(period.revenue)}</td>
                      <td className="px-4 py-3">
                        {money(period.bookingCosts)}
                      </td>
                      <td className="px-4 py-3">
                        {money(period.additionalVehicleExpenses)}
                      </td>
                      <td className="px-4 py-3">
                        <ProfitValue value={period.netProfit} />
                      </td>
                    </tr>
                  ))}
                  {!ledger.periods.length && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No P&amp;L records for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="font-bold text-slate-950">
                Complete Vehicle Ledger
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1500px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {[
                      "Date",
                      "Type",
                      "Booking / Reference",
                      "Customer / Description",
                      "Status",
                      "KM",
                      "Bill",
                      "Revenue",
                      "Cost / Expense",
                      "Net Profit",
                      "P&L Treatment",
                    ].map((label) => (
                      <th key={label} className="px-4 py-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-t border-slate-100 align-top"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        {periodLabel(entry.date)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.entryType === "BOOKING" ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"}`}
                        >
                          {title(entry.entryType)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {entry.bookingId && entry.bookingNumber ? (
                          <Link
                            className="font-semibold text-brand-700 hover:underline"
                            to={`/bookings/${entry.bookingId}`}
                          >
                            {entry.bookingNumber}
                          </Link>
                        ) : (
                          entry.referenceNumber || "-"
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="font-medium text-slate-800">
                          {entry.customer || entry.description}
                        </p>
                        {entry.route && (
                          <p className="mt-1 text-xs text-slate-500">
                            {entry.route}
                          </p>
                        )}
                        {entry.category && (
                          <p className="mt-1 text-xs text-slate-500">
                            {title(entry.category)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">{title(entry.status)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {entry.entryType === "BOOKING"
                          ? number(entry.runningKm)
                          : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {entry.billedAmount ? money(entry.billedAmount) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {entry.revenue ? money(entry.revenue) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {money(entry.bookingCost || entry.expenseAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <ProfitValue value={entry.netProfit} />
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-slate-500">
                        {entry.profitTreatment}
                      </td>
                    </tr>
                  ))}
                  {!ledger.entries.length && (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No vehicle ledger records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              pagination={ledger.pagination}
              onPageChange={(page) =>
                setFilters((current) => ({ ...current, page }))
              }
              onLimitChange={(limit) => {
                setDraftFilters((current) => ({ ...current, limit }));
                setFilters((current) => ({ ...current, page: 1, limit }));
              }}
            />
          </section>

          <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <summary className="cursor-pointer font-semibold text-slate-800">
              P&amp;L calculation methodology
            </summary>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>{ledger.methodology.revenue}</li>
              <li>{ledger.methodology.bookingCosts}</li>
              <li>{ledger.methodology.additionalExpenses}</li>
              <li>{ledger.methodology.linkedExpenses}</li>
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
