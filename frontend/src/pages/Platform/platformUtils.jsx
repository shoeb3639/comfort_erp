export const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function toNumber(value) {
  if (typeof value === "number") return value;
  return Number(String(value || 0).replace(/[^0-9.-]/g, "")) || 0;
}

export function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getEffectiveSubscriptionStatus(subscription, now = new Date()) {
  const storedStatus = subscription?.status;
  if (["EXPIRED", "SUSPENDED", "CANCELLED"].includes(storedStatus)) {
    return storedStatus;
  }

  const expiresAt = new Date(subscription?.expiresAt);
  if (!Number.isNaN(expiresAt.getTime()) && expiresAt < now) {
    if (storedStatus === "GRACE_PERIOD") {
      const graceEndsAt = new Date(subscription?.graceEndsAt);
      if (!subscription?.graceEndsAt || graceEndsAt < now) return "EXPIRED";
      return "GRACE_PERIOD";
    }
    return "EXPIRED";
  }

  if (storedStatus === "TRIAL" && subscription?.trialEndsAt) {
    const trialEndsAt = new Date(subscription.trialEndsAt);
    if (!Number.isNaN(trialEndsAt.getTime()) && trialEndsAt < now) {
      return "EXPIRED";
    }
  }

  return storedStatus;
}

export function StatusBadge({ status }) {
  const tone = ["ACTIVE", "PAID", "COMPLETED", "CLOSED"].includes(status)
    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
    : [
          "TRIAL",
          "GRACE_PERIOD",
          "PENDING_SETUP",
          "PENDING",
          "OWNER_INVITED",
        ].includes(status)
      ? "bg-amber-50 text-amber-700 ring-amber-600/20"
      : ["SUSPENDED", "EXPIRED", "OVERDUE", "CANCELLED"].includes(status)
        ? "bg-rose-50 text-rose-700 ring-rose-600/20"
        : "bg-slate-100 text-slate-700 ring-slate-500/20";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}
    >
      {String(status || "-").replaceAll("_", " ")}
    </span>
  );
}

export function SummaryCard({
  label,
  value,
  caption,
  tone = "default",
  prefix = "",
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "danger"
        ? "text-rose-700"
        : tone === "warning"
          ? "text-amber-700"
          : "text-slate-950";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-bold ${toneClass}`}>
        {prefix}
        {value}
      </p>
      {caption && <p className="mt-2 text-sm text-slate-500">{caption}</p>}
    </div>
  );
}

export function Section({ title, subtitle, actions = null, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function FilterBar({
  search,
  onSearch,
  placeholder = "Search records",
  children,
}) {
  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
      <input
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-72"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={placeholder}
      />
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  );
}

export function TableShell({
  columns,
  children,
  minWidth = "1000px",
  empty = false,
  emptyText = "No records found.",
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table
        className="w-full divide-y divide-slate-200 text-sm"
        style={{ minWidth }}
      >
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="px-4 py-3 text-left font-semibold text-slate-700"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
      {empty && (
        <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">
          {emptyText}
        </div>
      )}
    </div>
  );
}
