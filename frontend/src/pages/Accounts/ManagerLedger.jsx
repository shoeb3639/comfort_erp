import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ActionNotice from "../../components/ActionNotice";
import { useAuth } from "../../auth/AuthContext";
import {
  getAccountsErrorMessage,
  listManagerLedgers,
  updateManagerLedgerStatus,
} from "../../services/accounts";
import {
  FilterBar,
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  money,
} from "./accountUtils";

function ManagerLedgerPage() {
  const { user } = useAuth();
  const canManage = user?.permissions?.includes("accounts.fund.release");
  const [data, setData] = useState({
    ledgers: [],
    summary: {},
    filters: { managers: [], locations: [] },
  });
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    managerId: "",
    locationId: "",
  });
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await listManagerLedgers(
          Object.fromEntries(
            Object.entries(filters).filter(([, value]) => value),
          ),
        ),
      );
    } catch (error) {
      setNotice({ tone: "error", message: getAccountsErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function toggleStatus(ledger) {
    const nextStatus = ledger.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const reason = window.prompt(
      `Reason to mark this ledger ${nextStatus.toLowerCase()}:`,
    );
    if (!reason) return;
    try {
      await updateManagerLedgerStatus(ledger.id, {
        status: nextStatus,
        reason,
      });
      setNotice({
        tone: "success",
        message: `Ledger marked ${nextStatus.toLowerCase()}.`,
      });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: getAccountsErrorMessage(error) });
    }
  }

  const summary = data.summary || {};
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label="Ledgers"
          value={summary.totalLedgers || 0}
          prefix=""
        />
        <SummaryCard
          label="Active"
          value={summary.activeLedgers || 0}
          prefix=""
          tone="success"
        />
        <SummaryCard
          label="Opening Balance"
          value={summary.openingBalance || 0}
        />
        <SummaryCard
          label="Credits"
          value={summary.totalCredits || 0}
          tone="success"
        />
        <SummaryCard
          label="Debits"
          value={summary.totalDebits || 0}
          tone="warning"
        />
        <SummaryCard
          label="Current Balance"
          value={summary.currentBalance || 0}
        />
      </div>

      <Section
        title="Manager Ledger List"
        actions={
          <FilterBar
            search={filters.search}
            onSearch={(search) =>
              setFilters((current) => ({ ...current, search }))
            }
          >
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={filters.managerId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  managerId: event.target.value,
                }))
              }
            >
              <option value="">All Managers</option>
              {data.filters.managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={filters.locationId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  locationId: event.target.value,
                }))
              }
            >
              <option value="">All Locations</option>
              {data.filters.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </FilterBar>
        }
      >
        <TableShell
          columns={[
            "Manager",
            "Location",
            "Opening",
            "Credits",
            "Debits",
            "Current Balance",
            "Status",
            "Actions",
          ]}
          minWidth="1050px"
          empty={!loading && data.ledgers.length === 0}
          emptyText={
            loading
              ? "Loading ledgers..."
              : "No database-backed manager ledgers found."
          }
        >
          {data.ledgers.map((ledger) => (
            <tr key={ledger.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">
                  {ledger.manager.name}
                </p>
                <p className="text-xs text-slate-500">{ledger.manager.role}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {ledger.location.name}
              </td>
              <td className="px-4 py-3 text-slate-600">
                ₹ {money(ledger.openingBalance)}
              </td>
              <td className="px-4 py-3 text-emerald-700">
                ₹ {money(ledger.totalCredits)}
              </td>
              <td className="px-4 py-3 text-rose-700">
                ₹ {money(ledger.totalDebits)}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                ₹ {money(ledger.currentBalance)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge
                  status={ledger.status === "ACTIVE" ? "Active" : "Inactive"}
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-3">
                  <Link
                    className="font-semibold text-brand-600"
                    to={`/accounts/manager-ledger/${ledger.id}`}
                  >
                    View
                  </Link>
                  {canManage && (
                    <button
                      className="font-semibold text-slate-600"
                      type="button"
                      onClick={() => toggleStatus(ledger)}
                    >
                      {ledger.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
        <p className="mt-3 text-xs font-medium text-slate-500">
          {data.formula}
        </p>
      </Section>
      <ActionNotice
        message={notice?.message}
        tone={notice?.tone}
        onDismiss={() => setNotice(null)}
      />
    </div>
  );
}

export default ManagerLedgerPage;
