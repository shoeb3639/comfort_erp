import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  recordDriverReturn,
  getAccountsErrorMessage,
} from "../services/accounts";
import { downloadReceipt } from "../services/files";

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const field =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

export default function DriverSettlement({ collection, onUpdated }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    amount: "",
    paymentMode: "CASH",
    returnDate: new Date().toLocaleDateString("en-CA"),
    referenceNumber: "",
    remarks: "",
  });
  if (collection.paymentHolder !== "DRIVER") return null;
  const canReceive = user?.permissions?.includes("accounts.deposit.manage");
  const canDownload = user?.permissions?.includes("files.download");
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const updated = await recordDriverReturn(collection.id, form);
      setForm((current) => ({
        ...current,
        amount: "",
        referenceNumber: "",
        remarks: "",
      }));
      await onUpdated(updated);
    } catch (failure) {
      setError(getAccountsErrorMessage(failure));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h4 className="font-bold text-slate-950">
        Driver settlement — {collection.collectedBy}
      </h4>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Customer paid", collection.amount],
          ["Fuel spent", collection.fuelAmount],
          ["Returned to company", collection.returnedAmount],
          ["Still with driver", collection.driverBalance],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-slate-600">{label}</p>
            <p className="font-bold">₹ {money(value)}</p>
          </div>
        ))}
      </div>
      {collection.fuelReceipt &&
        (canDownload ? (
          <button
            type="button"
            className="text-sm font-semibold text-brand-700"
            onClick={() =>
              downloadReceipt(collection.fuelReceipt).catch((failure) =>
                setError(getAccountsErrorMessage(failure)),
              )
            }
          >
            Download fuel receipt: {collection.fuelReceipt.name}
          </button>
        ) : (
          <p className="text-sm">Fuel receipt: {collection.fuelReceipt.name}</p>
        ))}
      {collection.driverBalance === 0 && (
        <p className="text-sm">
          Driver balance cleared.{" "}
          {collection.status === "VERIFIED" ||
          collection.depositStatus === "Verified"
            ? "Accounts has verified this collection."
            : "Accounts can review the fuel receipt and verify this collection."}
        </p>
      )}
      {canReceive && collection.driverBalance > 0 && (
        <form
          className="space-y-3 border-t border-amber-200 pt-3 print:hidden"
          onSubmit={submit}
        >
          <p className="text-sm font-semibold">
            Record money received back from the driver
          </p>
          <p className="text-xs text-slate-600">
            Record only money actually received into company cash or its bank
            account. This reduces the driver balance; it does not add another
            customer payment.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Amount received
              <input
                className={field}
                type="number"
                min="0.01"
                step="0.01"
                max={collection.driverBalance}
                required
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
              />
            </label>
            <label className="text-sm">
              Received into
              <select
                className={field}
                value={form.paymentMode}
                onChange={(event) =>
                  setForm({ ...form, paymentMode: event.target.value })
                }
              >
                <option value="CASH">Company cash</option>
                <option value="UPI">Company UPI</option>
                <option value="BANK_TRANSFER">Company bank account</option>
              </select>
            </label>
            <label className="text-sm">
              Date received
              <input
                className={field}
                type="date"
                required
                min={collection.collectionDate}
                max={new Date().toLocaleDateString("en-CA")}
                value={form.returnDate}
                onChange={(event) =>
                  setForm({ ...form, returnDate: event.target.value })
                }
              />
            </label>
            <label className="text-sm">
              Handover receipt / transaction reference
              <input
                className={field}
                required
                minLength={3}
                maxLength={150}
                value={form.referenceNumber}
                onChange={(event) =>
                  setForm({ ...form, referenceNumber: event.target.value })
                }
              />
            </label>
          </div>
          <label className="block text-sm">
            Remarks
            <input
              className={field}
              maxLength={5000}
              value={form.remarks}
              onChange={(event) =>
                setForm({ ...form, remarks: event.target.value })
              }
            />
          </label>
          <button
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Recording…" : "Confirm receipt from driver"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
    </section>
  );
}
