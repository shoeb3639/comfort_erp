import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { getOutstandingCustomers } from "../../services/dashboard";
import { formatCurrency } from "./widgets";
import "./outstanding-cards.css";

const categories = [
  { type: "CORPORATE", label: "Corporate Outstanding" },
  { type: "RETAIL", label: "Individual Outstanding" },
  { type: "TRAVEL_AGENT", label: "Travel Agent Outstanding" },
];
function OutstandingCard({ category, group, loading }) {
  const [paused, setPaused] = useState(false);
  const customers = group?.customers ?? [];
  const scrolling = customers.length > 1;
  const list = (duplicate = false) => (
    <ol
      aria-hidden={duplicate || undefined}
      className="m-0 flex shrink-0 list-none p-0"
    >
      {customers.map((customer, index) => (
        <li
          key={customer.id}
          className="flex h-6 shrink-0 items-center gap-2 whitespace-nowrap pr-6 text-xs"
        >
          <span className="w-4 shrink-0 text-xs text-slate-400">
            {index + 1}
          </span>
          <span className="text-slate-700" title={customer.name}>
            {customer.name}
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-rose-700">
            {formatCurrency(customer.amount)}
          </span>
        </li>
      ))}
    </ol>
  );
  return (
    <section
      className="h-32 min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-label={category.label}
      aria-busy={loading}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {category.label}
      </h3>
      <p className="mt-2 text-2xl font-semibold text-slate-950">
        {loading ? "…" : formatCurrency(group?.total ?? 0)}
      </p>
      {!loading && customers.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div
            tabIndex={scrolling ? 0 : undefined}
            aria-label="Top unpaid customers; scrolling pauses on hover or focus"
            className={`outstanding-viewport min-w-0 flex-1 ${scrolling ? "outstanding-scrolling" : ""} ${paused ? "outstanding-paused" : ""}`}
          >
            <div className="outstanding-track">
              {list()}
              {scrolling && (
                <div className="outstanding-duplicate">{list(true)}</div>
              )}
            </div>
          </div>
          {scrolling && (
            <button
              type="button"
              aria-label={`${paused ? "Resume" : "Pause"} ${category.label} scrolling`}
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
              className="outstanding-motion-control shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
export default function OutstandingCards() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getOutstandingCustomers(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Unable to load outstanding balances.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  if (error)
    return (
      <p
        role="alert"
        className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
      >
        {error}{" "}
        <button
          type="button"
          className="underline"
          onClick={() => setRetry(retry + 1)}
        >
          Retry
        </button>
      </p>
    );
  return (
    <div className="dashboard-mobile-cards grid grid-cols-1 gap-3 md:grid-cols-3">
      {categories.map((category) => (
        <OutstandingCard
          key={category.type}
          category={category}
          group={data?.groups.find((group) => group.type === category.type)}
          loading={loading}
        />
      ))}
    </div>
  );
}
