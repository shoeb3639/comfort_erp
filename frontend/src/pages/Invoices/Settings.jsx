import { useState } from "react";
import {
  createInvoiceNumber,
  getInvoiceSettings,
  saveInvoiceSettings,
} from "./invoiceUtils";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function InvoiceSettingsPage() {
  const [settings, setSettings] = useState(() => getInvoiceSettings());
  const [notice, setNotice] = useState("");

  function updateField(name, value) {
    setSettings((current) => ({ ...current, [name]: value }));
  }

  function updateBankField(name, value) {
    setSettings((current) => ({
      ...current,
      bankDetails: { ...current.bankDetails, [name]: value },
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    saveInvoiceSettings(settings);
    setNotice("Invoice series settings saved.");
  }

  return (
    <form
      id="invoice-settings-form"
      className="space-y-5"
      onSubmit={handleSubmit}
    >
      {notice && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {notice}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="font-semibold text-slate-900">Series</h4>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          <label>
            <span className="text-sm font-medium text-slate-700">Prefix</span>
            <input
              className={fieldClass}
              value={settings.prefix}
              onChange={(event) => updateField("prefix", event.target.value)}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">
              Financial Year
            </span>
            <input
              className={fieldClass}
              value={settings.financialYear}
              onChange={(event) =>
                updateField("financialYear", event.target.value)
              }
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">
              Next Number
            </span>
            <input
              type="number"
              min="1"
              className={fieldClass}
              value={settings.nextNumber}
              onChange={(event) =>
                updateField("nextNumber", Number(event.target.value))
              }
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">HSN Code</span>
            <input
              className={fieldClass}
              value={settings.hsnCode}
              onChange={(event) => updateField("hsnCode", event.target.value)}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">
              Place Of Supply
            </span>
            <input
              className={fieldClass}
              value={settings.placeOfSupply}
              onChange={(event) =>
                updateField("placeOfSupply", event.target.value)
              }
            />
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Preview
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {createInvoiceNumber(settings)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="font-semibold text-slate-900">Bank Details</h4>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {[
            ["Account Name", "accountName"],
            ["Account Number", "accountNumber"],
            ["Bank Name", "bankName"],
            ["IFSC Code", "ifscCode"],
            ["UPI ID", "upiId"],
          ].map(([label, name]) => (
            <label key={name}>
              <span className="text-sm font-medium text-slate-700">
                {label}
              </span>
              <input
                className={fieldClass}
                value={settings.bankDetails[name]}
                onChange={(event) => updateBankField(name, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label>
          <span className="text-sm font-medium text-slate-700">
            Terms & Conditions
          </span>
          <textarea
            className={`${fieldClass} min-h-28 resize-y`}
            value={settings.terms}
            onChange={(event) => updateField("terms", event.target.value)}
          />
        </label>
      </section>
    </form>
  );
}

export default InvoiceSettingsPage;
