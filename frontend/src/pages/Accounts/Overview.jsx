import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeIndianRupee,
  BookOpenCheck,
  Landmark,
  LoaderCircle,
  ReceiptIndianRupee,
  SearchCheck,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import {
  getAccountsErrorMessage,
  getAccountsFoundation,
  validateAccountReference,
} from "../../services/accounts";

const iconById = {
  collections: ReceiptIndianRupee,
  "cash-deposits": Landmark,
  "manager-ledger": WalletCards,
  "fund-release": BadgeIndianRupee,
  expenses: BookOpenCheck,
  "daily-closing": SearchCheck,
  audit: ShieldCheck,
};

function label(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AccountsOverviewPage() {
  const [foundation, setFoundation] = useState(null);
  const [error, setError] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [referenceResult, setReferenceResult] = useState(null);
  const [checkingReference, setCheckingReference] = useState(false);

  useEffect(() => {
    let active = true;
    getAccountsFoundation()
      .then((data) => {
        if (active) setFoundation(data);
      })
      .catch((requestError) => {
        if (active) setError(getAccountsErrorMessage(requestError));
      });
    return () => {
      active = false;
    };
  }, []);

  const modules = useMemo(
    () =>
      (foundation?.navigation || []).filter((item) => item.id !== "overview"),
    [foundation],
  );

  async function checkReference(event) {
    event.preventDefault();
    setCheckingReference(true);
    setReferenceResult(null);
    setError("");
    try {
      setReferenceResult(await validateAccountReference(referenceNumber));
    } catch (requestError) {
      setError(getAccountsErrorMessage(requestError));
    } finally {
      setCheckingReference(false);
    }
  }

  if (!foundation && !error) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-600 shadow-sm">
        <LoaderCircle className="mr-2 animate-spin" size={18} />
        Loading Accounts permissions…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 text-emerald-600" size={24} />
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Accounts access is active
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Only modules permitted by your tenant role are shown. Customer
              collections remain separate from manager operational funds.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(foundation?.permissions || []).map((permission) => (
            <span
              key={permission}
              className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20"
            >
              {permission}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = iconById[module.id] || WalletCards;
          return (
            <Link
              key={module.id}
              to={module.path}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <Icon className="text-brand-600" size={24} />
              <h3 className="mt-4 font-bold text-slate-950">{module.label}</h3>
              <p className="mt-1 text-sm text-slate-500">
                Open the authorized {module.label.toLowerCase()} workspace.
              </p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <form
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          onSubmit={checkReference}
        >
          <h3 className="font-bold text-slate-950">
            Payment reference validation
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            References are normalized and checked only inside the authenticated
            tenant.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              value={referenceNumber}
              onChange={(event) => {
                setReferenceNumber(event.target.value);
                setReferenceResult(null);
              }}
              minLength={3}
              maxLength={150}
              placeholder="Example: UTR-2026-001"
              required
            />
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={checkingReference}
              type="submit"
            >
              {checkingReference ? "Checking…" : "Check reference"}
            </button>
          </div>
          {referenceResult && (
            <div
              className={`mt-4 rounded-lg p-3 text-sm font-semibold ${
                referenceResult.available
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {referenceResult.available
                ? `${referenceResult.normalizedReferenceNumber} is available.`
                : `${referenceResult.normalizedReferenceNumber} is already in use.`}
            </div>
          )}
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-950">Shared standards</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-slate-700">Payment modes</dt>
              <dd className="mt-1 text-slate-500">
                {(foundation?.enums.paymentModes || []).map(label).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">
                Transaction types
              </dt>
              <dd className="mt-1 text-slate-500">
                {(foundation?.enums.transactionTypes || [])
                  .map(label)
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Data policy</dt>
              <dd className="mt-1 text-slate-500">
                Tenant-scoped queries, required audit fields and soft deletion
                for financial records.
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
