import { CalendarDays, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getVehiclePerformance } from "../../services/dashboard";
import { DataTableWidget, formatCurrency } from "./widgets";
const displayDate = (value) => {
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year.slice(-2)}`;
};
const ownColumns = [
  {
    key: "vehicle",
    label: "Vehicle",
    render: (row) => (
      <span>
        {row.vehicle}
        {row.excluded > 0 && (
          <span
            className="ml-1 text-xs text-amber-700"
            title={`${row.excluded} historical bookings with missing profit data excluded`}
          >
            Partial
          </span>
        )}
      </span>
    ),
  },
  ...[
    ["revenue", "Revenue"],
    ["fuelCost", "Fuel Cost"],
    ["maintenance", "Vehicle Expenses"],
    ["driverCost", "Driver Cost"],
    ["otherCost", "Other Costs"],
    ["netProfit", "Net Profit"],
  ].map(([key, label]) => ({
    key,
    label,
    render: (row) =>
      formatCurrency(row[key] + (key === "otherCost" ? row.vendorCost : 0)),
  })),
  {
    key: "profitPercent",
    label: "Profit %",
    render: (row) =>
      row.profitPercent == null ? "—" : `${row.profitPercent}%`,
  },
];
const vendorColumns = [
  ownColumns[0],
  ...[
    ["revenue", "Billing Revenue"],
    ["vendorCost", "Vendor Payable"],
    ["fuelCost", "Company-paid Fuel"],
    ["extraCost", "Additional Costs"],
    ["netProfit", "Profit / Commission"],
  ].map(([key, label]) => ({
    key,
    label,
    render: (row) => formatCurrency(row[key]),
  })),
  ownColumns[ownColumns.length - 1],
];
export default function VehiclePerformanceTable({ today }) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const [range, setRange] = useState({ start: monthStart, end: today });
  const [draft, setDraft] = useState(range);
  const [dateError, setDateError] = useState("");
  const dialog = useRef(null);
  const [ownership, setOwnership] = useState("OWN");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(null);
    getVehiclePerformance(ownership, range, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Unable to load vehicle performance.");
      });
    return () => controller.abort();
  }, [retry, ownership, range]);
  return (
    <>
      <DataTableWidget
        title={
          <>
            {`Top 10 Most Profitable ${ownership === "OWN" ? "Own" : "Vendor"} Vehicles`}
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {displayDate(range.start)} – {displayDate(range.end)}
            </span>
          </>
        }
        action={
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Filter vehicle performance by date"
              title="Filter dates"
              onClick={() => {
                setDraft(range);
                setDateError("");
                dialog.current.showModal();
              }}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            >
              <CalendarDays size={17} />
            </button>
            <div
              role="group"
              aria-label="Vehicle performance type"
              className="flex shrink-0 rounded-lg bg-slate-100 p-1"
            >
              {[
                ["OWN", "Own"],
                ["VENDOR", "Vendor"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={ownership === value}
                  onClick={() => {
                    if (value !== ownership) {
                      setData(null);
                      setError("");
                      setOwnership(value);
                    }
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${ownership === value ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
        columns={ownership === "OWN" ? ownColumns : vendorColumns}
        rows={error ? [] : (data?.items ?? [])}
        emptyMessage={
          error ? (
            <span role="alert" className="text-rose-700">
              {error}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setRetry(retry + 1)}
              >
                Retry
              </button>
            </span>
          ) : !data ? (
            "Loading vehicle performance…"
          ) : (
            "No records available"
          )
        }
      />
      <dialog
        ref={dialog}
        aria-labelledby="vehicle-date-title"
        className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 p-5 shadow-xl backdrop:bg-slate-950/30"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="vehicle-date-title" className="font-semibold">
            Vehicle Performance Dates
          </h3>
          <button
            type="button"
            aria-label="Close date filter"
            onClick={() => dialog.current.close()}
          >
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.start > draft.end) {
              setDateError("End date must be on or after start date.");
              return;
            }
            setData(null);
            setRange(draft);
            dialog.current.close();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-slate-600">
              From
              <input
                autoFocus
                required
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                value={draft.start}
                onChange={(event) =>
                  setDraft({ ...draft, start: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 p-2"
              />
            </label>
            <label className="text-sm text-slate-600">
              To
              <input
                required
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                value={draft.end}
                onChange={(event) =>
                  setDraft({ ...draft, end: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 p-2"
              />
            </label>
          </div>
          {dateError && (
            <p role="alert" className="mt-2 text-xs text-rose-600">
              {dateError}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              className="text-xs text-slate-600 underline"
              onClick={() => {
                setData(null);
                setRange({ start: monthStart, end: today });
                dialog.current.close();
              }}
            >
              Reset to this month
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Apply
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
