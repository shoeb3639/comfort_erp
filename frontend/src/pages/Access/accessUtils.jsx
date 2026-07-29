export const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StatusBadge({ status }) {
  const tone =
    status === "Active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : status === "Future Placeholder"
        ? "bg-amber-50 text-amber-700 ring-amber-600/20"
        : "bg-slate-100 text-slate-700 ring-slate-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}
    >
      {status || "-"}
    </span>
  );
}

export function SystemBadge({ enabled }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        enabled
          ? "bg-brand-50 text-brand-700 ring-brand-600/20"
          : "bg-slate-100 text-slate-600 ring-slate-500/20"
      }`}
    >
      {enabled ? "System" : "Custom"}
    </span>
  );
}

export function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

export function Section({ title, children, actions = null }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function TableShell({
  columns,
  children,
  empty = false,
  minWidth = "1000px",
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
          No records found.
        </div>
      )}
    </div>
  );
}

export function PermissionKey({ value }) {
  return (
    <code className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
      {value}
    </code>
  );
}
