import { useEffect, useState } from "react";
import { getVehiclePerformance } from "../../services/dashboard";
import { DataTableWidget, formatCurrency } from "./widgets";
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
export default function VehiclePerformanceTable() {
  const [ownership, setOwnership] = useState("OWN");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(null);
    getVehiclePerformance(ownership, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Unable to load vehicle performance.");
      });
    return () => controller.abort();
  }, [retry, ownership]);
  return (
    <DataTableWidget
      title={`Top 10 Most Profitable ${ownership === "OWN" ? "Own" : "Vendor"} Vehicles`}
      action={
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
  );
}
