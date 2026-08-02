import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import ActionNotice from "../../components/ActionNotice";
import {
  createFundRelease,
  getAccountsErrorMessage,
  listFundReleases,
} from "../../services/accounts";
import {
  FilterBar,
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  fieldClass,
  formatLabel,
  money,
} from "./accountUtils";

function ManagerLedgerFormPage() {
  const [data, setData] = useState({
    releases: [],
    summary: {},
    ledgers: [],
  });
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      releaseDate: new Date().toISOString().slice(0, 10),
      ledgerId: "",
      amount: "",
      paymentMode: "BANK_TRANSFER",
      referenceNumber: "",
      description: "",
      remarks: "",
      attachmentName: "",
    },
  });

  const load = useCallback(async () => {
    try {
      setData(await listFundReleases(search ? { search } : {}));
    } catch (error) {
      setNotice({ tone: "error", message: getAccountsErrorMessage(error) });
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function releaseAmount(values) {
    setSaving(true);
    try {
      const release = await createFundRelease({
        ...values,
        amount: Number(values.amount),
      });
      setNotice({
        tone: "success",
        message: `${release.referenceNumber} posted. Manager ledger credited ₹ ${money(release.amount)}.`,
      });
      reset({
        releaseDate: new Date().toISOString().slice(0, 10),
        ledgerId: "",
        amount: "",
        paymentMode: "BANK_TRANSFER",
        referenceNumber: "",
        description: "",
        remarks: "",
        attachmentName: "",
      });
      await load();
    } catch (error) {
      setNotice({ tone: "error", message: getAccountsErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const summary = data.summary || {};
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          label="Releases"
          value={summary.totalReleases || 0}
          prefix=""
        />
        <SummaryCard label="Total Released" value={summary.totalAmount || 0} />
        <SummaryCard
          label="Verified Amount"
          value={summary.verifiedAmount || 0}
          tone="success"
        />
        <SummaryCard
          label="Pending"
          value={summary.pendingCount || 0}
          prefix=""
          tone="warning"
        />
      </div>

      <form
        id="manager-ledger-release-form"
        className="space-y-5"
        onSubmit={handleSubmit(releaseAmount)}
      >
        <Section title="Company Fund Release">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label>
              <span className="text-sm font-medium text-slate-700">
                Release Date
              </span>
              <input
                className={fieldClass}
                type="date"
                {...register("releaseDate", {
                  required: "Release date is required",
                })}
              />
              {errors.releaseDate && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.releaseDate.message}
                </p>
              )}
            </label>
            <label>
              <span className="text-sm font-medium text-slate-700">
                Manager Ledger
              </span>
              <select
                className={fieldClass}
                {...register("ledgerId", {
                  required: "Manager ledger is required",
                })}
              >
                <option value="">Select active ledger</option>
                {data.ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.manager.name} — {ledger.location.name} — ₹{" "}
                    {money(ledger.currentBalance)}
                  </option>
                ))}
              </select>
              {errors.ledgerId && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.ledgerId.message}
                </p>
              )}
            </label>
            <label>
              <span className="text-sm font-medium text-slate-700">Amount</span>
              <input
                className={fieldClass}
                type="number"
                min="0.01"
                step="0.01"
                {...register("amount", {
                  required: "Amount is required",
                  min: { value: 0.01, message: "Amount must be positive" },
                })}
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.amount.message}
                </p>
              )}
            </label>
            <label>
              <span className="text-sm font-medium text-slate-700">
                Payment Mode
              </span>
              <select className={fieldClass} {...register("paymentMode")}>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-medium text-slate-700">
                Reference Number
              </span>
              <input
                className={fieldClass}
                {...register("referenceNumber", {
                  required: "Reference number is required",
                  minLength: {
                    value: 3,
                    message: "Enter at least 3 characters",
                  },
                })}
              />
              {errors.referenceNumber && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.referenceNumber.message}
                </p>
              )}
            </label>
            <label>
              <span className="text-sm font-medium text-slate-700">
                Attachment
              </span>
              <input
                className="mt-2 block w-full text-sm text-slate-600"
                type="file"
                onChange={(event) =>
                  setValue(
                    "attachmentName",
                    event.target.files?.[0]?.name || "",
                  )
                }
              />
            </label>
            <label className="md:col-span-2 xl:col-span-3">
              <span className="text-sm font-medium text-slate-700">
                Description
              </span>
              <input
                className={fieldClass}
                {...register("description", {
                  required: "Description is required",
                  minLength: {
                    value: 3,
                    message: "Enter at least 3 characters",
                  },
                })}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.description.message}
                </p>
              )}
            </label>
            <label className="md:col-span-2 xl:col-span-3">
              <span className="text-sm font-medium text-slate-700">
                Remarks
              </span>
              <textarea
                className={`${fieldClass} min-h-20 resize-y`}
                {...register("remarks")}
              />
            </label>
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500">
            The authenticated user is stored as Released By and verifier. Saving
            posts one verified credit atomically to the selected ledger.
          </p>
          <button
            className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            type="submit"
            disabled={saving}
          >
            {saving ? "Posting…" : "Release and Post"}
          </button>
        </Section>
      </form>

      <Section
        title="Fund Release Register"
        actions={<FilterBar search={search} onSearch={setSearch} />}
      >
        <TableShell
          columns={[
            "Date",
            "Manager",
            "Location",
            "Amount",
            "Mode",
            "Reference",
            "Released By",
            "Status",
          ]}
          minWidth="1000px"
          empty={data.releases.length === 0}
        >
          {data.releases.map((release) => (
            <tr key={release.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-600">
                {release.releaseDate}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                {release.ledger.manager.name}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {release.ledger.location.name}
              </td>
              <td className="px-4 py-3 font-semibold text-emerald-700">
                ₹ {money(release.amount)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {formatLabel(release.paymentMode)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {release.referenceNumber}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {release.releasedBy.name}
              </td>
              <td className="px-4 py-3">
                <StatusBadge
                  status={
                    release.status === "VERIFIED"
                      ? "Verified"
                      : formatLabel(release.status)
                  }
                />
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

export default ManagerLedgerFormPage;
