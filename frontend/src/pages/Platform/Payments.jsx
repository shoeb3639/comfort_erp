import { useEffect, useMemo, useState } from "react";
import {
  getPlatformErrorMessage,
  getSubscriptionPayments,
} from "../../services/platform";
import {
  FilterBar,
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  formatDate,
  money,
  toNumber,
} from "./platformUtils";

function tenantName(payment) {
  const tenant = payment.tenantSubscription?.tenant;
  return tenant?.tradeName || tenant?.legalName || tenant?.code || "-";
}

function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSubscriptionPayments()
      .then((records) => active && setPayments(records))
      .catch((requestError) => active && setError(getPlatformErrorMessage(requestError)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(
    () =>
      payments.filter((item) =>
        [item.id, tenantName(item), item.paymentReference, item.status, item.paymentMethod]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [payments, search],
  );
  const paidAmount = payments.filter((item) => item.status === "PAID").reduce((sum, item) => sum + toNumber(item.amount), 0);
  const outstandingAmount = payments.filter((item) => item.status !== "PAID").reduce((sum, item) => sum + toNumber(item.amount), 0);

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Payment Records" value={payments.length} caption={loading ? "Loading…" : "Persisted records"} />
        <SummaryCard label="Paid Amount" value={money(paidAmount)} prefix="₹ " tone="success" />
        <SummaryCard label="Outstanding Amount" value={money(outstandingAmount)} prefix="₹ " tone="danger" />
      </div>
      <Section title="Subscription Payments" subtitle="Persisted SaaS billing records owned by Cablix." actions={<FilterBar search={search} onSearch={setSearch} placeholder="Search payments" />}>
        <TableShell columns={["Payment ID", "Tenant", "Date", "Amount", "Mode", "Reference", "Plan", "Status", "Remarks"]} minWidth="1050px" empty={!loading && rows.length === 0}>
          {rows.map((payment) => (
            <tr key={payment.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-950">{payment.id}</td>
              <td className="px-4 py-3 text-slate-700">{tenantName(payment)}</td>
              <td className="px-4 py-3 text-slate-700">{formatDate(payment.paidAt || payment.createdAt)}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">₹ {money(payment.amount)}</td>
              <td className="px-4 py-3 text-slate-700">{payment.paymentMethod || "-"}</td>
              <td className="px-4 py-3 text-slate-700">{payment.paymentReference || "-"}</td>
              <td className="px-4 py-3 text-slate-700">{payment.tenantSubscription?.plan?.name || "-"}</td>
              <td className="px-4 py-3"><StatusBadge status={payment.status} /></td>
              <td className="px-4 py-3 text-slate-700">{payment.remarks || "-"}</td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  );
}

export default PaymentsPage;
