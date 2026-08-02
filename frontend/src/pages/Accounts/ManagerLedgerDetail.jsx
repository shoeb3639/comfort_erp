import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ActionNotice from "../../components/ActionNotice";
import {
  getAccountsErrorMessage,
  getManagerLedger,
} from "../../services/accounts";
import {
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  money,
} from "./accountUtils";

function ManagerLedgerDetailPage() {
  const { ledgerId } = useParams();
  const [ledger, setLedger] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let active = true;
    getManagerLedger(ledgerId)
      .then((result) => active && setLedger(result))
      .catch(
        (error) =>
          active &&
          setNotice({ tone: "error", message: getAccountsErrorMessage(error) }),
      );
    return () => {
      active = false;
    };
  }, [ledgerId]);

  if (!ledger) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading manager ledger…{" "}
        <Link
          className="font-semibold text-brand-600"
          to="/accounts/manager-ledger"
        >
          Back to list
        </Link>
        <ActionNotice
          message={notice?.message}
          tone={notice?.tone}
          onDismiss={() => setNotice(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Manager" value={ledger.manager.name} prefix="" />
        <SummaryCard label="Location" value={ledger.location.name} prefix="" />
        <SummaryCard label="Opening" value={ledger.openingBalance} />
        <SummaryCard
          label="Credits"
          value={ledger.totalCredits}
          tone="success"
        />
        <SummaryCard label="Debits" value={ledger.totalDebits} tone="warning" />
        <SummaryCard
          label="Current Balance"
          value={ledger.currentBalance}
          tone={ledger.currentBalance >= 0 ? "success" : "danger"}
        />
      </div>
      <Section
        title="Running Manager Ledger"
        actions={
          <StatusBadge
            status={ledger.status === "ACTIVE" ? "Active" : "Inactive"}
          />
        }
      >
        <TableShell
          columns={[
            "#",
            "Date",
            "Type",
            "Description",
            "Credit",
            "Debit",
            "Balance Before",
            "Running Balance",
            "Reference",
          ]}
          minWidth="1200px"
          empty={ledger.entries.length === 0}
        >
          {ledger.entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-500">{entry.entryNumber}</td>
              <td className="px-4 py-3 text-slate-600">{entry.entryDate}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                {entry.entryTypeLabel}
              </td>
              <td className="px-4 py-3 text-slate-600">{entry.description}</td>
              <td className="px-4 py-3 text-emerald-700">
                ₹ {money(entry.credit)}
              </td>
              <td className="px-4 py-3 text-rose-700">
                ₹ {money(entry.debit)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                ₹ {money(entry.balanceBefore)}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                ₹ {money(entry.runningBalance)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {entry.referenceNumber || "-"}
              </td>
            </tr>
          ))}
        </TableShell>
        <p className="mt-3 text-xs font-medium text-slate-500">
          {ledger.formula}
        </p>
      </Section>
      <Section title="Audit Trail">
        <TableShell
          columns={["Date", "Action", "Changed By", "Remarks"]}
          minWidth="700px"
          empty={ledger.auditTrail.length === 0}
        >
          {ledger.auditTrail.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-3 text-slate-600">
                {new Date(entry.createdAt).toLocaleString("en-IN")}
              </td>
              <td className="px-4 py-3 font-semibold">{entry.action}</td>
              <td className="px-4 py-3 text-slate-600">
                {entry.actor?.name || "System"}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {entry.remarks || "-"}
              </td>
            </tr>
          ))}
        </TableShell>
      </Section>
      <ActionNotice
        message={notice?.message}
        tone={notice?.tone}
        onDismiss={() => setNotice(null)}
      />
    </div>
  );
}

export default ManagerLedgerDetailPage;
