import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Eye,
  FilePenLine,
  FileText,
  MoreVertical,
  Printer,
  Search,
  XCircle,
} from "lucide-react";
import {
  cancelInvoice,
  generateInvoice,
  listInvoices,
} from "../../services/invoices";
import { formatMoney, normalizeInvoice } from "./invoiceUtils";
import Pagination from "../../components/Pagination";

const statusStyles = {
  Draft: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Generated: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Sent: "bg-brand-50 text-brand-700 ring-brand-600/20",
  Paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Cancelled: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [openActionId, setOpenActionId] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [notice, setNotice] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 1,
    hasPrevious: false,
    hasNext: false,
  });
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(
      () =>
        listInvoices({
          page: pagination.page,
          limit: pagination.limit,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(statusFilter !== "All"
            ? { status: statusFilter.toUpperCase() }
            : {}),
          ...(sourceFilter !== "All"
            ? { source: sourceFilter.toUpperCase() }
            : {}),
        })
          .then((result) => {
            if (!active) return;
            setInvoices(result.items.map(normalizeInvoice));
            setPagination(result.pagination);
          })
          .catch((error) =>
            setNotice(
              error.response?.data?.message || "Unable to load invoices.",
            ),
          ),
      250,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [pagination.page, pagination.limit, search, sourceFilter, statusFilter]);
  const statusOptions = ["All", "Draft", "Generated", "Cancelled"];

  const filteredInvoices = invoices.filter((invoice) => {
    const query = search.trim().toLowerCase();
    const source =
      invoice.invoice_source ||
      invoice.invoiceSource ||
      (invoice.bookingId ? "booking" : "direct");
    const matchesStatus =
      statusFilter === "All" || invoice.invoiceStatus === statusFilter;
    const matchesSource =
      sourceFilter === "All" ||
      (sourceFilter === "booking" && source === "booking") ||
      (sourceFilter === "direct" && source === "direct");
    const searchableText = [
      invoice.invoiceNumber,
      invoice.bookingId,
      invoice.billingCustomer,
      invoice.invoiceDate,
      source,
    ]
      .join(" ")
      .toLowerCase();

    return (
      matchesStatus &&
      matchesSource &&
      (!query || searchableText.includes(query))
    );
  });

  return (
    <div className="space-y-5">
      {notice && (
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
          {notice}
        </div>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Invoice List
          </h3>
          <div className="grid gap-3 sm:grid-cols-[minmax(260px,360px)_180px_180px]">
            <label className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              <Search
                className="mr-2 text-slate-400"
                size={18}
                strokeWidth={2.2}
              />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
                placeholder="Search invoice, booking, customer"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "All" ? "All statuses" : status}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="All">All sources</option>
              <option value="booking">Booking Invoice</option>
              <option value="direct">Direct Invoice</option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Invoice
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Source
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Booking
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Customer
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  GST
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Net Payable
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredInvoices.map((invoice) => {
                const source =
                  invoice.invoice_source ||
                  invoice.invoiceSource ||
                  (invoice.bookingId ? "booking" : "direct");

                return (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {invoice.invoiceNumber}
                      </p>
                      <p className="text-slate-500">{invoice.invoiceDate}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                          source === "direct"
                            ? "bg-violet-50 text-violet-700 ring-violet-600/20"
                            : "bg-sky-50 text-sky-700 ring-sky-600/20"
                        }`}
                      >
                        {source === "direct" ? "Direct" : "Booking"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {source === "direct" ? "-" : invoice.bookingId || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {invoice.billingCustomer}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {invoice.gstType}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      ₹{formatMoney(invoice.totals.netPayable)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[invoice.invoiceStatus] || "bg-slate-100 text-slate-700 ring-slate-500/20"}`}
                      >
                        {invoice.invoiceStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-flex justify-end">
                        <button
                          type="button"
                          aria-expanded={openActionId === invoice.id}
                          aria-label={`Open actions for ${invoice.invoiceNumber}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                          onClick={() =>
                            setOpenActionId((currentId) =>
                              currentId === invoice.id ? "" : invoice.id,
                            )
                          }
                        >
                          <MoreVertical size={17} />
                        </button>
                        {openActionId === invoice.id && (
                          <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-xl">
                            {invoice.invoiceStatus === "Draft" && (
                              <button
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                                onClick={async () => {
                                  try {
                                    const updated = normalizeInvoice(
                                      await generateInvoice(invoice.id),
                                    );
                                    setInvoices((current) =>
                                      current.map((item) =>
                                        item.id === invoice.id ? updated : item,
                                      ),
                                    );
                                    setOpenActionId("");
                                    setNotice(
                                      "Invoice generated successfully.",
                                    );
                                  } catch (error) {
                                    setNotice(
                                      error.response?.data?.message ||
                                        "Unable to generate invoice.",
                                    );
                                  }
                                }}
                              >
                                <FilePenLine size={16} />
                                Generate Invoice
                              </button>
                            )}
                            {invoice.invoiceStatus !== "Cancelled" && (
                              <Link
                                to={`/invoices/${invoice.id}/edit`}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                onClick={() => setOpenActionId("")}
                              >
                                <FilePenLine size={16} />
                                Edit Invoice
                              </Link>
                            )}
                            <Link
                              to={`/invoices/${invoice.id}/preview`}
                              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => setOpenActionId("")}
                            >
                              <Eye size={16} />
                              Preview
                            </Link>
                            <Link
                              to={`/invoices/${invoice.id}/print`}
                              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => setOpenActionId("")}
                            >
                              <Printer size={16} />
                              Print
                            </Link>
                            <Link
                              to={`/invoices/${invoice.id}/print`}
                              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => setOpenActionId("")}
                            >
                              <FileText size={16} />
                              Download PDF
                            </Link>
                            {invoice.invoiceStatus === "Generated" && (
                              <button
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                                onClick={async () => {
                                  const reason = window.prompt(
                                    "Cancellation reason",
                                  );
                                  if (!reason) return;
                                  try {
                                    const updated = normalizeInvoice(
                                      await cancelInvoice(invoice.id, reason),
                                    );
                                    setInvoices((current) =>
                                      current.map((item) =>
                                        item.id === invoice.id ? updated : item,
                                      ),
                                    );
                                    setOpenActionId("");
                                    setNotice("Invoice cancelled.");
                                  } catch (error) {
                                    setNotice(
                                      error.response?.data?.message ||
                                        "Unable to cancel invoice.",
                                    );
                                  }
                                }}
                              >
                                <XCircle size={16} />
                                Cancel Invoice
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredInvoices.length === 0 && (
            <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">
              No invoices found.
            </div>
          )}
          <Pagination
            pagination={pagination}
            onPageChange={(page) =>
              setPagination((current) => ({ ...current, page }))
            }
            onLimitChange={(limit) =>
              setPagination((current) => ({ ...current, page: 1, limit }))
            }
          />
        </div>
      </section>
    </div>
  );
}

export default InvoicesPage;
