import { useEffect, useMemo, useState } from "react";
import { Pencil, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  getAllSubscriptionPlans,
  getPlatformErrorMessage,
  getTenantSubscriptions,
  updateTenantSubscription,
} from "../../services/platform";
import {
  FilterBar,
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  formatDate,
  getEffectiveSubscriptionStatus,
  money,
  fieldClass,
} from "./platformUtils";

const statusOptions = [
  "TRIAL",
  "ACTIVE",
  "GRACE_PERIOD",
  "EXPIRED",
  "SUSPENDED",
  "CANCELLED",
];

const paymentOptions = [
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "FAILED",
  "REFUNDED",
  "WAIVED",
];

function dateValue(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function SubscriptionModal({ item, plans, onClose, onSave }) {
  const [values, setValues] = useState({
    planId: item.plan.id,
    status: item.status,
    billingCycle: item.billingCycle,
    startsAt: dateValue(item.startsAt),
    expiresAt: dateValue(item.expiresAt),
    trialEndsAt: dateValue(item.trialEndsAt),
    graceEndsAt: dateValue(item.graceEndsAt),
    userLimit: item.userLimit ?? "",
    vehicleLimit: item.vehicleLimit ?? "",
    bookingLimit: item.bookingLimit ?? "",
    storageLimitMb: item.storageLimitMb ?? "",
    currency: item.currency,
    amount: Number(item.amount),
    discountAmount: Number(item.discountAmount),
    taxAmount: Number(item.taxAmount),
    paymentStatus: item.paymentStatus,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const finalAmount = Math.max(
    0,
    Number(values.amount || 0) -
      Number(values.discountAmount || 0) +
      Number(values.taxAmount || 0),
  );
  const set = (name, value) =>
    setValues((current) => ({ ...current, [name]: value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const nullableNumber = (value) => (value === "" ? null : Number(value));
    try {
      await onSave(item.id, {
        ...values,
        startsAt: new Date(`${values.startsAt}T00:00:00.000Z`).toISOString(),
        expiresAt: new Date(`${values.expiresAt}T23:59:59.999Z`).toISOString(),
        trialEndsAt: values.trialEndsAt
          ? new Date(`${values.trialEndsAt}T23:59:59.999Z`).toISOString()
          : null,
        graceEndsAt: values.graceEndsAt
          ? new Date(`${values.graceEndsAt}T23:59:59.999Z`).toISOString()
          : null,
        userLimit: nullableNumber(values.userLimit),
        vehicleLimit: nullableNumber(values.vehicleLimit),
        bookingLimit: nullableNumber(values.bookingLimit),
        storageLimitMb: nullableNumber(values.storageLimitMb),
        amount: Number(values.amount),
        discountAmount: Number(values.discountAmount),
        taxAmount: Number(values.taxAmount),
        finalAmount,
      });
    } catch (requestError) {
      setError(getPlatformErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold">Edit / Renew Subscription</h3>
            <p className="text-sm text-slate-500">
              {item.tenant.tradeName || item.tenant.legalName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="rounded-lg border p-2"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <form className="space-y-5 p-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-3">
            <Select
              label="Plan"
              value={values.planId}
              onChange={(value) => set("planId", value)}
              options={plans.map((plan) => [
                plan.id,
                `${plan.name}${plan.isActive ? "" : " (Inactive)"}`,
              ])}
            />
            <Select
              label="Subscription Status"
              value={values.status}
              onChange={(value) => set("status", value)}
              options={statusOptions.map((value) => [
                value,
                value.replaceAll("_", " "),
              ])}
            />
            <Select
              label="Payment Status"
              value={values.paymentStatus}
              onChange={(value) => set("paymentStatus", value)}
              options={paymentOptions.map((value) => [
                value,
                value.replaceAll("_", " "),
              ])}
            />
            <Field
              label="Starts On"
              type="date"
              required
              value={values.startsAt}
              onChange={(value) => set("startsAt", value)}
            />
            <Field
              label="Expires On"
              type="date"
              required
              value={values.expiresAt}
              onChange={(value) => set("expiresAt", value)}
            />
            <Field
              label="Trial Ends On"
              type="date"
              value={values.trialEndsAt}
              onChange={(value) => set("trialEndsAt", value)}
            />
            <Field
              label="Grace Ends On"
              type="date"
              value={values.graceEndsAt}
              onChange={(value) => set("graceEndsAt", value)}
            />
            <Field
              label="User Limit"
              type="number"
              min="1"
              value={values.userLimit}
              onChange={(value) => set("userLimit", value)}
            />
            <Field
              label="Vehicle Limit"
              type="number"
              min="1"
              value={values.vehicleLimit}
              onChange={(value) => set("vehicleLimit", value)}
            />
            <Field
              label="Booking Limit"
              type="number"
              min="1"
              value={values.bookingLimit}
              onChange={(value) => set("bookingLimit", value)}
            />
            <Field
              label="Storage Limit (MB)"
              type="number"
              min="1"
              value={values.storageLimitMb}
              onChange={(value) => set("storageLimitMb", value)}
            />
            <Field
              label="Currency"
              maxLength="3"
              required
              value={values.currency}
              onChange={(value) => set("currency", value.toUpperCase())}
            />
            <Field
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={values.amount}
              onChange={(value) => set("amount", value)}
            />
            <Field
              label="Discount"
              type="number"
              min="0"
              step="0.01"
              required
              value={values.discountAmount}
              onChange={(value) => set("discountAmount", value)}
            />
            <Field
              label="Tax"
              type="number"
              min="0"
              step="0.01"
              required
              value={values.taxAmount}
              onChange={(value) => set("taxAmount", value)}
            />
            <label>
              <span className="text-sm font-medium text-slate-700">
                Final Amount
              </span>
              <input
                readOnly
                className={`${fieldClass} bg-slate-50`}
                value={finalAmount.toFixed(2)}
              />
            </label>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              disabled={saving}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Subscription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, onChange, ...props }) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        className={fieldClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubscriptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") || "ALL";
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [editing, setEditing] = useState(null);

  async function loadSubscriptions() {
    const [subscriptionRecords, planRecords] = await Promise.all([
      getTenantSubscriptions(),
      getAllSubscriptionPlans(),
    ]);
    setSubscriptions(subscriptionRecords);
    setPlans(planRecords);
  }

  async function saveSubscription(id, payload) {
    await updateTenantSubscription(id, payload);
    await loadSubscriptions();
    setEditing(null);
  }

  useEffect(() => {
    loadSubscriptions().catch((requestError) =>
      setError(getPlatformErrorMessage(requestError)),
    );
  }, []);

  const rows = useMemo(() => {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 86400000);
    return subscriptions.filter((item) => {
      const effectiveStatus = getEffectiveSubscriptionStatus(item, now);
      const matchesView =
        view === "ALL" ||
        effectiveStatus === view ||
        (view === "EXPIRING_SOON" &&
          ["ACTIVE", "TRIAL", "GRACE_PERIOD"].includes(effectiveStatus) &&
          new Date(item.expiresAt) >= now &&
          new Date(item.expiresAt) <= sevenDays) ||
        (view === "EXPIRED_BLOCKED" &&
          ["EXPIRED", "SUSPENDED", "CANCELLED"].includes(effectiveStatus));
      return (
        matchesView &&
        [
          item.tenant.tradeName,
          item.tenant.legalName,
          item.tenant.code,
          item.plan.name,
          item.status,
          item.paymentStatus,
          effectiveStatus,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      );
    });
  }, [search, subscriptions, view]);

  async function updateStatus(item, status) {
    setError("");
    setUpdatingId(item.id);
    try {
      await updateTenantSubscription(item.id, { status });
      await loadSubscriptions();
    } catch (requestError) {
      setError(getPlatformErrorMessage(requestError));
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Subscriptions" value={subscriptions.length} />
        <SummaryCard
          label="Active"
          value={
            subscriptions.filter(
              (item) => getEffectiveSubscriptionStatus(item) === "ACTIVE",
            ).length
          }
          tone="success"
        />
        <SummaryCard
          label="Trial"
          value={
            subscriptions.filter(
              (item) => getEffectiveSubscriptionStatus(item) === "TRIAL",
            ).length
          }
          tone="warning"
        />
        <SummaryCard
          label="Blocked"
          value={
            subscriptions.filter((item) =>
              ["EXPIRED", "SUSPENDED", "CANCELLED"].includes(
                getEffectiveSubscriptionStatus(item),
              ),
            ).length
          }
          tone="danger"
        />
      </div>
      {error && (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
      <Section
        title="Tenant Subscription List"
        subtitle="Database-backed subscription lifecycle and ERP access status."
        actions={
          <FilterBar
            search={search}
            onSearch={setSearch}
            placeholder="Search subscriptions"
          >
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={view}
              onChange={(event) =>
                setSearchParams(
                  event.target.value === "ALL"
                    ? {}
                    : { view: event.target.value },
                )
              }
            >
              <option value="ALL">All subscriptions</option>
              <option value="ACTIVE">Active</option>
              <option value="TRIAL">Trial</option>
              <option value="EXPIRING_SOON">Expiring soon</option>
              <option value="EXPIRED_BLOCKED">Expired / blocked</option>
              <option value="GRACE_PERIOD">Grace period</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </FilterBar>
        }
      >
        <TableShell
          columns={[
            "Tenant",
            "Plan",
            "Period",
            "Amount",
            "Payment",
            "Subscription",
            "Trial/Grace End",
            "Actions",
          ]}
          minWidth="1150px"
          empty={rows.length === 0}
        >
          {rows.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-950">
                  {item.tenant.tradeName || item.tenant.legalName}
                </p>
                <p className="text-xs text-slate-500">{item.tenant.code}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{item.plan.name}</td>
              <td className="px-4 py-3 text-slate-700">
                {formatDate(item.startsAt)} to {formatDate(item.expiresAt)}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                ₹ {money(Number(item.finalAmount))}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={item.paymentStatus} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={getEffectiveSubscriptionStatus(item)} />
              </td>
              <td className="px-4 py-3 text-slate-700">
                {formatDate(item.graceEndsAt || item.trialEndsAt)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <select
                    disabled={updatingId === item.id}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    value={item.status}
                    onChange={(event) => updateStatus(item, event.target.value)}
                  >
                    {statusOptions.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold"
                    onClick={() => setEditing(item)}
                  >
                    <Pencil size={13} /> Edit
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      </Section>
      {editing && (
        <SubscriptionModal
          item={editing}
          plans={plans}
          onClose={() => setEditing(null)}
          onSave={saveSubscription}
        />
      )}
    </div>
  );
}

export default SubscriptionsPage;
