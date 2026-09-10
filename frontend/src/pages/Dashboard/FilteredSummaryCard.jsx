import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { getCardMetric } from "../../services/dashboard";
import { formatCurrency } from "./widgets";

export const summaryMetrics = [
  {
    key: "bookings",
    label: "Bookings",
    help: "Non-cancelled bookings starting in this range.",
  },
  {
    key: "revenue",
    label: "Revenue",
    help: "Invoice totals dated in this range, including drafts.",
  },
  {
    key: "collections",
    label: "Collections",
    help: "Customer payments received in this range, including driver-held money.",
  },
  {
    key: "expenses",
    label: "Expenses",
    help: "Posted expenses and fuel paid from customer collections in this range.",
  },
  {
    key: "profit",
    label: "Business Profit",
    help: "Own vehicles profit + vendor profit / commission for closed bookings.",
  },
  {
    key: "pending",
    label: "Pending Collections",
    balance: true,
    help: "All unpaid invoice balances as of the end date, including older invoices.",
  },
  {
    key: "cash",
    label: "Cash Pending Deposit",
    help: "Cash collected in this range still awaiting deposit or verification, after recorded fuel spending and returns.",
  },
  {
    key: "manager",
    label: "Manager Ledger Balance",
    balance: true,
    help: "Opening balances plus ledger credits minus debits through the end date.",
  },
];
const dateLabel = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const shift = (date, days) =>
  new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);

export default function FilteredSummaryCard({ card, metric, today }) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const [range, setRange] = useState({ start: monthStart, end: today });
  const [draft, setDraft] = useState(range);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  const [retry, setRetry] = useState(0);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 767px)").matches,
  );
  const popup = useRef(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const overlay = (content) =>
    mobile ? createPortal(content, document.body) : content;
  const container = useRef(null);
  const trigger = useRef(null);
  const firstInput = useRef(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getCardMetric({ metric: metric.key, ...range }, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure.response?.data?.message || "Unable to load this total.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [metric.key, range, retry]);
  useEffect(() => {
    if (!open) return;
    firstInput.current?.focus();
    const outside = (event) => {
      if (
        !container.current?.contains(event.target) &&
        !popup.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const select = (start, end) => {
    setRange({ start, end });
    close();
  };
  const Icon = card.icon;
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <section
      ref={container}
      className={`relative min-w-0 snap-start rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4 ${open ? "z-20" : helpOpen ? "z-10" : ""}`}
      aria-label={metric.label}
      aria-busy={loading}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="relative shrink-0"
            onMouseEnter={() => setHelpOpen(true)}
            onMouseLeave={() => setHelpOpen(false)}
          >
            <button
              type="button"
              aria-label={`About ${metric.label}`}
              aria-describedby={helpOpen ? `help-${metric.key}` : undefined}
              onFocus={() => setHelpOpen(true)}
              onBlur={() => setHelpOpen(false)}
              onClick={() => setHelpOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setHelpOpen(false);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 ${tones[card.tone]}`}
            >
              <Icon size={18} />
            </button>
            {helpOpen &&
              overlay(
                <div
                  className={
                    mobile
                      ? "fixed inset-x-4 bottom-24 z-[80]"
                      : "absolute left-0 top-full z-30 w-56 max-w-[calc(100vw-4rem)] pt-2"
                  }
                >
                  <div
                    id={`help-${metric.key}`}
                    role="tooltip"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs leading-5 text-white shadow-lg"
                  >
                    {metric.help}
                    {metric.key === "profit" &&
                      !loading &&
                      !error &&
                      result && (
                        <dl className="mt-2 space-y-1 border-t border-white/20 pt-2 text-xs text-slate-200">
                          <div className="flex items-center justify-between gap-2">
                            <dt>Own Vehicle Profit</dt>
                            <dd className="font-semibold tabular-nums text-white">
                              {formatCurrency(result.ownProfit)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt>Vendor Profit / Commission</dt>
                            <dd className="font-semibold tabular-nums text-white">
                              {formatCurrency(result.vendorProfit)}
                            </dd>
                          </div>
                        </dl>
                      )}
                  </div>
                </div>,
              )}
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {metric.label}
          </h3>
        </div>
        <div className="shrink-0">
          <button
            ref={trigger}
            type="button"
            title={`Filter ${metric.label}`}
            aria-label={`Filter ${metric.label}`}
            aria-expanded={open}
            aria-controls={`filter-${metric.key}`}
            onClick={() => {
              setDraft(range);
              setValidation("");
              setOpen(!open);
            }}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <CalendarDays size={17} />
          </button>
        </div>
      </div>
      <p
        className="mt-2 text-[22px] font-semibold text-slate-950 md:mt-3 md:text-2xl"
        aria-live="polite"
      >
        {loading
          ? "…"
          : error
            ? "Unavailable"
            : metric.key === "bookings"
              ? result?.value.toLocaleString("en-IN")
              : formatCurrency(result?.value)}
      </p>
      <p className="mt-2 text-xs font-medium text-slate-600">
        {metric.balance
          ? `As of ${dateLabel(range.end)}`
          : range.start === range.end
            ? dateLabel(range.start)
            : `${dateLabel(range.start)} – ${dateLabel(range.end)}`}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setRetry(retry + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {open &&
        overlay(
          <div
            ref={popup}
            id={`filter-${metric.key}`}
            role="dialog"
            aria-label={`${metric.label} date filter`}
            className={
              mobile
                ? "fixed inset-x-3 bottom-3 z-[80] max-h-[80dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
                : "absolute right-0 top-14 z-30 w-[min(20rem,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            }
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                {metric.balance ? "Balance as of" : "Date range"}
              </h4>
              <button
                type="button"
                aria-label="Close filter"
                onClick={close}
                className="rounded p-1 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {[
                ["Today", today, today],
                ["Yesterday", shift(today, -1), shift(today, -1)],
                ["This month", `${today.slice(0, 7)}-01`, today],
                ["This year", `${today.slice(0, 4)}-01-01`, today],
              ].map(([label, start, end]) => (
                <button
                  type="button"
                  key={label}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs hover:bg-brand-50"
                  onClick={() => select(start, end)}
                >
                  {label}
                </button>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.start > draft.end) {
                  setValidation("End date must be on or after start date.");
                  return;
                }
                select(draft.start, draft.end);
              }}
            >
              {!metric.balance && (
                <label className="mb-3 block text-xs text-slate-600">
                  From
                  <input
                    ref={firstInput}
                    required
                    type="date"
                    min="1900-01-01"
                    max="2100-12-31"
                    value={draft.start}
                    onChange={(event) =>
                      setDraft({ ...draft, start: event.target.value })
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              )}
              <label className="block text-xs text-slate-600">
                {metric.balance ? "As of date" : "To"}
                <input
                  ref={metric.balance ? firstInput : undefined}
                  required
                  type="date"
                  min="1900-01-01"
                  max="2100-12-31"
                  value={draft.end}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      end: event.target.value,
                      ...(metric.balance ? { start: event.target.value } : {}),
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              {validation && (
                <p role="alert" className="mt-2 text-xs text-rose-700">
                  {validation}
                </p>
              )}
              <div className="mt-4 flex justify-between">
                <button
                  type="button"
                  className="text-xs text-slate-600 underline"
                  onClick={() => select(monthStart, today)}
                >
                  Reset to this month
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Apply
                </button>
              </div>
            </form>
          </div>,
        )}
    </section>
  );
}
