import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionNotice from "../../components/ActionNotice";
import {
  createManagerLedger,
  getAccountsErrorMessage,
  listManagerLedgers,
} from "../../services/accounts";
import { Section, fieldClass } from "./accountUtils";

function ManagerLedgerCreatePage() {
  const navigate = useNavigate();
  const [options, setOptions] = useState({ managers: [], locations: [] });
  const [form, setForm] = useState({
    managerId: "",
    locationId: "",
    openingBalance: "0",
    remarks: "",
  });
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listManagerLedgers()
      .then((data) => setOptions(data.filters))
      .catch((error) =>
        setNotice({ tone: "error", message: getAccountsErrorMessage(error) }),
      );
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const ledger = await createManagerLedger({
        ...form,
        openingBalance: Number(form.openingBalance),
      });
      navigate(`/accounts/manager-ledger/${ledger.id}`, { replace: true });
    } catch (error) {
      setNotice({ tone: "error", message: getAccountsErrorMessage(error) });
      setSaving(false);
    }
  }

  return (
    <form
      id="manager-ledger-create-form"
      className="space-y-5"
      onSubmit={submit}
    >
      <Section title="Ledger Linkage">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Manager
            <select
              className={fieldClass}
              required
              value={form.managerId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  managerId: event.target.value,
                }))
              }
            >
              <option value="">Select manager</option>
              {options.managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name} — {manager.role}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Location
            <select
              className={fieldClass}
              required
              value={form.locationId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  locationId: event.target.value,
                }))
              }
            >
              <option value="">Select location</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                  {location.code ? ` — ${location.code}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Opening Balance
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="0.01"
              required
              value={form.openingBalance}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  openingBalance: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Remarks
            <textarea
              className={fieldClass}
              rows="3"
              value={form.remarks}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  remarks: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-500">
          One ledger is allowed per manager and location. Opening Balance +
          Credits - Debits = Current Balance.
        </p>
      </Section>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Creating…" : "Create Ledger"}
      </button>
      <ActionNotice
        message={notice?.message}
        tone={notice?.tone}
        onDismiss={() => setNotice(null)}
      />
    </form>
  );
}

export default ManagerLedgerCreatePage;
