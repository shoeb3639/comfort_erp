import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileBarChart,
  Filter,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  generateReport,
  getReportCatalog,
  getReportOptions,
} from "../../services/reports";

const moneyKeys = new Set([
  "bookingRevenue",
  "invoicedRevenue",
  "collected",
  "outstanding",
  "expenses",
  "revenue",
  "vendorPayable",
  "margin",
  "taxableAmount",
  "gst",
  "netPayable",
  "totalAmount",
]);

const columns = {
  "booking-register": [
    ["bookingNumber", "Booking"],
    ["serviceDate", "Service Date"],
    ["customer", "Customer"],
    ["route", "Route"],
    ["assignmentSource", "Source"],
    ["vehicle", "Vehicle"],
    ["driver", "Driver"],
    ["status", "Status"],
    ["revenue", "Revenue", "money"],
  ],
  "invoice-register": [
    ["invoiceNumber", "Invoice"],
    ["invoiceDate", "Invoice Date"],
    ["bookingNumber", "Booking"],
    ["customer", "Customer"],
    ["taxableAmount", "Taxable", "money"],
    ["gst", "GST", "money"],
    ["netPayable", "Net Payable", "money"],
    ["collected", "Collected", "money"],
    ["status", "Status"],
  ],
  "outstanding-invoices": [
    ["invoiceNumber", "Invoice"],
    ["invoiceDate", "Invoice Date"],
    ["bookingNumber", "Booking"],
    ["customer", "Customer"],
    ["netPayable", "Net Payable", "money"],
    ["collected", "Collected", "money"],
    ["outstanding", "Outstanding", "money"],
  ],
  "expense-register": [
    ["transactionDate", "Date"],
    ["manager", "Manager"],
    ["location", "Location"],
    ["category", "Category"],
    ["description", "Description"],
    ["paymentMode", "Payment Mode"],
    ["referenceNumber", "Reference"],
    ["amount", "Amount", "money"],
  ],
  "vehicle-utilization": [
    ["registrationNumber", "Vehicle"],
    ["vehicleType", "Type"],
    ["status", "Status"],
    ["duties", "Duties"],
    ["completedDuties", "Completed"],
    ["runningKm", "Running KM", "number"],
    ["revenue", "Revenue", "money"],
    ["utilizationRate", "Utilization", "percent"],
  ],
  "vendor-duty": [
    ["bookingNumber", "Booking"],
    ["serviceDate", "Service Date"],
    ["vendor", "Vendor"],
    ["customer", "Customer"],
    ["route", "Route"],
    ["vehicle", "Vehicle"],
    ["status", "Status"],
    ["revenue", "Revenue", "money"],
    ["vendorPayable", "Payable", "money"],
    ["margin", "Margin", "money"],
  ],
};

const initialFilters = {
  dateFrom: "",
  dateTo: "",
  status: "",
  customerId: "",
  vendorId: "",
  vehicleId: "",
  assignmentSource: "",
  search: "",
  page: 1,
  limit: 100,
};

const statusOptions = {
  "booking-register": [
    "DRAFT",
    "CONFIRMED",
    "ASSIGNED",
    "RUNNING",
    "COMPLETED",
    "CLOSED",
    "CANCELLED",
  ],
  "invoice-register": ["DRAFT", "GENERATED", "CANCELLED"],
  "vendor-duty": [
    "DRAFT",
    "CONFIRMED",
    "ASSIGNED",
    "RUNNING",
    "COMPLETED",
    "CLOSED",
    "CANCELLED",
  ],
};

const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function label(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function display(value, type) {
  if (type === "money") return money(value);
  if (type === "number") return Number(value || 0).toLocaleString("en-IN");
  if (type === "percent") return `${Number(value || 0)}%`;
  return label(value) || "-";
}

function cellLink(reportKey, row, key, value) {
  if (key === "bookingNumber" && row.id)
    return `/bookings/${encodeURIComponent(value)}`;
  if (key === "invoiceNumber" && row.id) return `/invoices/${row.id}/preview`;
  if (reportKey === "vehicle-utilization" && key === "registrationNumber")
    return "/vehicles";
  return "";
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(report, reportColumns) {
  const header = reportColumns.map((column) => csvCell(column[1])).join(",");
  const body = report.rows.map((row) =>
    reportColumns.map(([key]) => csvCell(row[key])).join(","),
  );
  const blob = new Blob(["\uFEFF", [header, ...body].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${report.report.key}-${report.generatedAt.slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

export default function ReportsPage() {
  const [catalog, setCatalog] = useState([]);
  const [options, setOptions] = useState({
    customers: [],
    vendors: [],
    vehicles: [],
  });
  const [reportKey, setReportKey] = useState("business-summary");
  const [filters, setFilters] = useState(initialFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = async (key = reportKey, nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(
        Object.entries(nextFilters).filter(([, value]) => value !== ""),
      );
      setReport(await generateReport(key, params));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to generate report.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([getReportCatalog(), getReportOptions()])
      .then(([reportCatalog, reportOptions]) => {
        if (!active) return;
        setCatalog(reportCatalog);
        setOptions(reportOptions);
        return loadReport("business-summary", initialFilters);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError.response?.data?.message ||
            "Unable to open the Reports module.",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const reportColumns = useMemo(() => columns[reportKey] || [], [reportKey]);
  const selectedDefinition = catalog.find((item) => item.key === reportKey);

  function selectReport(key) {
    const nextFilters = { ...initialFilters };
    setReportKey(key);
    setFilters(nextFilters);
    loadReport(key, nextFilters);
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  function changePage(page) {
    const next = { ...filters, page };
    setFilters(next);
    loadReport(reportKey, next);
  }

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
          <div className="flex items-center gap-2 px-3 py-2">
            <FileBarChart className="text-brand-600" size={20} />
            <h2 className="font-semibold text-slate-950">Report Catalog</h2>
          </div>
          <nav className="mt-2 space-y-1">
            {catalog.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => selectReport(item.key)}
                className={`w-full rounded-xl px-3 py-3 text-left transition ${
                  reportKey === item.key
                    ? "bg-brand-50 text-brand-800"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-semibold">{item.name}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {item.description}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {selectedDefinition?.name || "Reports"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedDefinition?.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {reportKey !== "business-summary" && (
                  <button
                    type="button"
                    disabled={!report?.rows?.length}
                    onClick={() => exportCsv(report, reportColumns)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                  >
                    <Download size={16} /> Export CSV
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  <Printer size={16} /> Print
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label>
                <span className="text-xs font-semibold text-slate-600">
                  From
                </span>
                <input
                  type="date"
                  className={fieldClass}
                  value={filters.dateFrom}
                  onChange={(event) =>
                    updateFilter("dateFrom", event.target.value)
                  }
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">To</span>
                <input
                  type="date"
                  min={filters.dateFrom || undefined}
                  className={fieldClass}
                  value={filters.dateTo}
                  onChange={(event) =>
                    updateFilter("dateTo", event.target.value)
                  }
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">
                  Customer
                </span>
                <select
                  className={fieldClass}
                  value={filters.customerId}
                  onChange={(event) =>
                    updateFilter("customerId", event.target.value)
                  }
                >
                  <option value="">All customers</option>
                  {options.customers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.billingName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">
                  Vendor
                </span>
                <select
                  className={fieldClass}
                  value={filters.vendorId}
                  onChange={(event) =>
                    updateFilter("vendorId", event.target.value)
                  }
                >
                  <option value="">All vendors</option>
                  {options.vendors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">
                  Vehicle
                </span>
                <select
                  className={fieldClass}
                  value={filters.vehicleId}
                  onChange={(event) =>
                    updateFilter("vehicleId", event.target.value)
                  }
                >
                  <option value="">All vehicles</option>
                  {options.vehicles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.registrationNumber} · {label(item.ownershipType)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">
                  Assignment
                </span>
                <select
                  className={fieldClass}
                  value={filters.assignmentSource}
                  onChange={(event) =>
                    updateFilter("assignmentSource", event.target.value)
                  }
                >
                  <option value="">Own and vendor</option>
                  <option value="OWN">Own</option>
                  <option value="VENDOR">Vendor</option>
                </select>
              </label>
              {statusOptions[reportKey] && (
                <label>
                  <span className="text-xs font-semibold text-slate-600">
                    Status
                  </span>
                  <select
                    className={fieldClass}
                    value={filters.status}
                    onChange={(event) =>
                      updateFilter("status", event.target.value)
                    }
                  >
                    <option value="">All statuses</option>
                    {statusOptions[reportKey].map((status) => (
                      <option key={status} value={status}>
                        {label(status)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="md:col-span-2">
                <span className="text-xs font-semibold text-slate-600">
                  Search
                </span>
                <span className="relative block">
                  <Search
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={17}
                  />
                  <input
                    className={`${fieldClass} pl-9`}
                    placeholder="Booking, invoice, customer, description or reference"
                    value={filters.search}
                    onChange={(event) =>
                      updateFilter("search", event.target.value)
                    }
                  />
                </span>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setFilters(initialFilters);
                  loadReport(reportKey, initialFilters);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <RefreshCw size={16} /> Reset
              </button>
              <button
                type="button"
                onClick={() => loadReport()}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
              >
                <Filter size={16} /> Generate Report
              </button>
            </div>
          </section>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {error}
            </div>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-950">
                  {report?.report?.name || selectedDefinition?.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {report?.generatedAt
                    ? `Generated ${new Date(report.generatedAt).toLocaleString("en-IN")}`
                    : "Generating report…"}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Tenant-scoped authoritative records
              </p>
            </div>

            {loading ? (
              <div className="py-16 text-center text-sm text-slate-500">
                Generating report…
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Object.entries(report?.summary || {}).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {label(key)}
                      </p>
                      <p className="mt-2 text-xl font-bold text-slate-950">
                        {moneyKeys.has(key)
                          ? money(value)
                          : Number(value || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>

                {reportColumns.length > 0 && (
                  <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {reportColumns.map(([key, heading]) => (
                            <th
                              key={key}
                              className="whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-700"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {report?.rows?.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            {reportColumns.map(([key, , type]) => {
                              const to = cellLink(
                                reportKey,
                                row,
                                key,
                                row[key],
                              );
                              return (
                                <td
                                  key={key}
                                  className="whitespace-nowrap px-4 py-3 text-slate-700"
                                >
                                  {to ? (
                                    <Link
                                      className="font-semibold text-brand-700 hover:underline"
                                      to={to}
                                    >
                                      {display(row[key], type)}
                                    </Link>
                                  ) : (
                                    display(row[key], type)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {!report?.rows?.length && (
                          <tr>
                            <td
                              colSpan={reportColumns.length}
                              className="px-4 py-12 text-center text-slate-500"
                            >
                              No records match the selected filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {report?.pagination?.pages > 1 && (
                  <div className="mt-4 flex items-center justify-between text-sm print:hidden">
                    <span className="text-slate-500">
                      Page {report.pagination.page} of {report.pagination.pages}{" "}
                      · {report.pagination.total} records
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={report.pagination.page <= 1}
                        onClick={() => changePage(report.pagination.page - 1)}
                        className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={
                          report.pagination.page >= report.pagination.pages
                        }
                        onClick={() => changePage(report.pagination.page + 1)}
                        className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
