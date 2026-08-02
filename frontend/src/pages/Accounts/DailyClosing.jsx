import { useEffect, useState } from "react";
import {
  getAccountsErrorMessage,
  getDailyClosing,
  listManagerLedgers,
  setDailyClosingStatus,
} from "../../services/accounts";
import {
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  fieldClass,
  money,
} from "./accountUtils";

export default function DailyClosingPage() {
  const [ledgers, setLedgers] = useState([]);
  const [ledgerId, setLedgerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [closing, setClosing] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    listManagerLedgers({ status: "ACTIVE" })
      .then((data) => {
        setLedgers(data.ledgers);
        setLedgerId((current) => current || data.ledgers[0]?.id || "");
      })
      .catch((requestError) => setError(getAccountsErrorMessage(requestError)));
  }, []);
  useEffect(() => {
    if (!ledgerId || !date) return;
    getDailyClosing({ ledgerId, date })
      .then(setClosing)
      .catch((requestError) => setError(getAccountsErrorMessage(requestError)));
  }, [ledgerId, date]);
  async function changeStatus(status) {
    try {
      setClosing(await setDailyClosingStatus({ ledgerId, date, status }));
      setError("");
    } catch (requestError) {
      setError(getAccountsErrorMessage(requestError));
    }
  }
  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-2"><label>Date<input className={fieldClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><label>Manager Ledger<select className={fieldClass} value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>{ledgers.map((row) => <option key={row.id} value={row.id}>{row.manager.name} · {row.location.name}</option>)}</select></label></div></section>
      {closing && <>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6"><SummaryCard label="Opening Balance" value={closing.openingBalance} /><SummaryCard label="Credits Today" value={closing.credits} tone="success" /><SummaryCard label="Debits Today" value={closing.debits} tone="warning" /><SummaryCard label="Carry Forward" value={closing.closingBalance} tone={closing.closingBalance >= 0 ? "success" : "danger"} /><SummaryCard label="Pending Cash Deposit" value={closing.pendingCashDeposit} tone={closing.pendingCashDeposit ? "danger" : "success"} /><div className="rounded-2xl border bg-white p-5"><p className="text-xs font-semibold uppercase text-slate-500">Status</p><div className="mt-3"><StatusBadge status={closing.status} /></div></div></div>
        <Section title="Ledger Activity"><TableShell columns={["Date","Type","Description","Reference","Credit","Debit","Running Balance"]} minWidth="950px" empty={closing.entries.length === 0}>{closing.entries.map((row) => <tr key={row.id}><td className="px-4 py-3">{row.entryDate}</td><td className="px-4 py-3">{row.entryType.replaceAll("_"," ")}</td><td className="px-4 py-3">{row.description}</td><td className="px-4 py-3">{row.referenceNumber || "-"}</td><td className="px-4 py-3 text-emerald-700">₹ {money(row.credit)}</td><td className="px-4 py-3 text-rose-700">₹ {money(row.debit)}</td><td className="px-4 py-3 font-semibold">₹ {money(row.runningBalance)}</td></tr>)}</TableShell></Section>
        <Section title="Booking Cash Monitoring" subtitle="Customer cash remains separate from the manager ledger."><TableShell columns={["Booking","Collected","Deposited","Status","Reference"]} minWidth="750px" empty={closing.deposits.length === 0}>{closing.deposits.map((row) => <tr key={row.id}><td className="px-4 py-3 font-semibold">{row.bookingNumber}</td><td className="px-4 py-3">₹ {money(row.amountCollected)}</td><td className="px-4 py-3">₹ {money(row.depositedAmount)}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td><td className="px-4 py-3">{row.reference || "-"}</td></tr>)}</TableShell></Section>
        <Section title="Closing Actions" actions={<div className="flex gap-2"><button disabled={closing.status === "CLOSED"} onClick={() => changeStatus("CLOSED")} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Close Day</button><button disabled={closing.status === "OPEN"} onClick={() => changeStatus("OPEN")} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Reopen Day</button></div>}><p className="text-sm text-slate-600">Closing snapshots and every close/reopen action are persisted with an audit event.</p></Section>
      </>}
    </div>
  );
}
