import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  getAccountsAudit,
  getAccountsErrorMessage,
  resolveAuditException,
} from "../../services/accounts";
import {
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  money,
} from "./accountUtils";

export default function AuditVerificationPage() {
  const [data, setData] = useState({ ledgers: [], deposits: [], exceptions: [], trail: [], summary: {} });
  const [error, setError] = useState("");
  const load = () => getAccountsAudit().then(setData).catch((requestError) => setError(getAccountsErrorMessage(requestError)));
  useEffect(() => { load(); }, []);
  async function resolve(item) {
    const resolution = window.prompt("Resolution note");
    if (!resolution) return;
    try {
      setData(await resolveAuditException({ exceptionKey: item.key, resolution }));
    } catch (requestError) {
      setError(getAccountsErrorMessage(requestError));
    }
  }
  return <div className="space-y-5">
    {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid gap-4 md:grid-cols-3"><SummaryCard label="Manager Ledgers" value={data.ledgers.length} prefix="" /><SummaryCard label="Account Transactions" value={data.summary.transactionCount || 0} prefix="" /><SummaryCard label="Open Exceptions" value={data.summary.openExceptions || 0} prefix="" tone={data.summary.openExceptions ? "danger" : "success"} /></div>
    <Section title="Manager Ledger Verification"><TableShell columns={["Manager / Location","Opening","Credits","Debits","Expected","Actual","Difference"]} minWidth="950px" empty={data.ledgers.length === 0}>{data.ledgers.map((row) => { const difference = row.actualBalance - row.expectedBalance; return <tr key={row.id}><td className="px-4 py-3 font-semibold">{row.manager}<span className="block text-xs font-normal text-slate-500">{row.location}</span></td><td className="px-4 py-3">₹ {money(row.openingBalance)}</td><td className="px-4 py-3">₹ {money(row.credits)}</td><td className="px-4 py-3">₹ {money(row.debits)}</td><td className="px-4 py-3">₹ {money(row.expectedBalance)}</td><td className="px-4 py-3">₹ {money(row.actualBalance)}</td><td className={`px-4 py-3 font-semibold ${difference ? "text-rose-700" : "text-emerald-700"}`}>₹ {money(difference)}</td></tr>; })}</TableShell></Section>
    <Section title="Booking Cash Verification"><TableShell columns={["Booking","Collected","Deposited","Verified","Reference","Status"]} minWidth="900px" empty={data.deposits.length === 0}>{data.deposits.map((row) => <tr key={row.id}><td className="px-4 py-3 font-semibold">{row.bookingNumber}</td><td className="px-4 py-3">₹ {money(row.collected)}</td><td className="px-4 py-3">₹ {money(row.deposited)}</td><td className="px-4 py-3">₹ {money(row.verified)}</td><td className="px-4 py-3">{row.reference || "-"}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td></tr>)}</TableShell></Section>
    <Section title="Exception Report"><TableShell columns={["Type","Reference","Amount","Severity","Status","Action"]} minWidth="850px" empty={data.exceptions.length === 0}>{data.exceptions.map((row) => <tr key={row.key}><td className="px-4 py-3 font-semibold">{row.type}</td><td className="px-4 py-3">{row.reference}</td><td className="px-4 py-3">₹ {money(row.amount)}</td><td className="px-4 py-3">{row.severity}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td><td className="px-4 py-3">{row.key.startsWith("DRIVER:") ? <Link className="font-semibold text-brand-700" to={`/accounts/collections?receipt=${row.key.slice(7)}`}>Review settlement</Link> : <button disabled={row.status === "RESOLVED"} onClick={() => resolve(row)} className="rounded border px-3 py-1 text-xs font-semibold disabled:opacity-50">Mark Resolved</button>}</td></tr>)}</TableShell></Section>
    <Section title="Audit Trail"><TableShell columns={["Date","User","Action","Module","Reference","Remarks"]} minWidth="950px" empty={data.trail.length === 0}>{data.trail.map((row) => <tr key={row.id}><td className="px-4 py-3">{new Date(row.date).toLocaleString()}</td><td className="px-4 py-3">{row.user}</td><td className="px-4 py-3">{row.action}</td><td className="px-4 py-3">{row.module}</td><td className="px-4 py-3">{row.reference || "-"}</td><td className="px-4 py-3">{row.remarks || "-"}</td></tr>)}</TableShell></Section>
  </div>;
}
