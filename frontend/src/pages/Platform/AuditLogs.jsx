import { useEffect, useMemo, useState } from "react";
import {
  getPlatformAuditLogs,
  getPlatformErrorMessage,
} from "../../services/platform";
import {
  FilterBar,
  Section,
  SummaryCard,
  TableShell,
  formatDate,
} from "./platformUtils";

function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPlatformAuditLogs()
      .then((records) => active && setLogs(records))
      .catch((requestError) => active && setError(getPlatformErrorMessage(requestError)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(
    () =>
      logs.filter((log) =>
        [
          log.actor?.name,
          log.actor?.email,
          log.action,
          log.module,
          log.referenceId,
          log.remarks,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [logs, search],
  );

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Audit Events" value={logs.length} caption={loading ? "Loading…" : "Latest 20 persisted events"} />
        <SummaryCard label="Tenant Events" value={logs.filter((item) => item.module.includes("TENANT")).length} />
        <SummaryCard label="Subscription Events" value={logs.filter((item) => item.module.includes("SUBSCRIPTION")).length} />
      </div>
      <Section title="Platform Audit Logs" subtitle="Persisted platform-level tenant and subscription actions." actions={<FilterBar search={search} onSearch={setSearch} placeholder="Search audit logs" />}>
        <TableShell columns={["Date", "User", "Action", "Module", "Reference", "Remarks"]} minWidth="950px" empty={!loading && rows.length === 0}>
          {rows.map((log) => (
            <tr key={log.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-700">{formatDate(log.createdAt)}</td>
              <td className="px-4 py-3 font-semibold text-slate-950">{log.actor?.name || "System"}</td>
              <td className="px-4 py-3 text-slate-700">{log.action}</td>
              <td className="px-4 py-3 text-slate-700">{log.module}</td>
              <td className="px-4 py-3 text-slate-700">{log.referenceId || "-"}</td>
              <td className="px-4 py-3 text-slate-700">{log.remarks || "-"}</td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  );
}

export default AuditLogsPage;
