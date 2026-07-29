import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  getPlatformErrorMessage,
  getSubscriptionPlans,
  getTenants,
  registerTenant,
  updateTenant,
  updateTenantOwner,
  updateTenantStatus,
} from "../../services/platform";
import {
  FilterBar,
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  fieldClass,
  formatDate,
  getEffectiveSubscriptionStatus,
} from "./platformUtils";

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function initialValues() {
  const startsAt = new Date();
  const expiresAt = new Date(startsAt);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const trialEndsAt = new Date(startsAt);
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  return {
    legalName: "",
    tradeName: "",
    code: "",
    businessType: "Car Rental",
    email: "",
    mobile: "",
    alternateNumber: "",
    website: "",
    logoUrl: "",
    gstin: "",
    pan: "",
    stateCode: "",
    taxRegistrationType: "Regular",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pinCode: "",
    country: "India",
    ownerName: "",
    ownerEmail: "",
    ownerMobile: "",
    ownerDesignation: "Owner",
    ownerPassword: "",
    timeZone: "Asia/Kolkata",
    defaultCurrency: "INR",
    financialYearStartMonth: 4,
    dateFormat: "DD/MM/YYYY",
    invoicePrefix: "",
    invoiceNumberLength: 6,
    planId: "",
    subscriptionStatus: "ACTIVE",
    startsAt: isoDate(startsAt),
    expiresAt: isoDate(expiresAt),
    trialEndsAt: isoDate(trialEndsAt),
    paymentStatus: "PENDING",
    amount: 0,
    discountAmount: 0,
    taxAmount: 0,
  };
}

function TenantModal({ plans, onClose, onSave }) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const finalAmount = Math.max(
    0,
    Number(values.amount || 0) -
      Number(values.discountAmount || 0) +
      Number(values.taxAmount || 0),
  );

  function updateField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function selectPlan(planId) {
    const plan = plans.find((item) => item.id === planId);
    setValues((current) => ({
      ...current,
      planId,
      amount: plan ? Number(plan.basePrice) : 0,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await onSave({
        tenant: {
          code: values.code,
          legalName: values.legalName,
          tradeName: values.tradeName,
          businessType: values.businessType,
          email: values.email,
          mobile: values.mobile,
          alternateNumber: values.alternateNumber,
          website: values.website,
          logoUrl: values.logoUrl,
          addressLine1: values.addressLine1,
          addressLine2: values.addressLine2,
          city: values.city,
          state: values.state,
          pinCode: values.pinCode,
          country: values.country,
          gstin: values.gstin,
          pan: values.pan,
          stateCode: values.stateCode,
          taxRegistrationType: values.taxRegistrationType,
          defaultCurrency: values.defaultCurrency,
          timeZone: values.timeZone,
          financialYearStartMonth: Number(values.financialYearStartMonth),
          dateFormat: values.dateFormat,
          invoicePrefix: values.invoicePrefix,
          invoiceNumberLength: Number(values.invoiceNumberLength),
        },
        owner: {
          name: values.ownerName,
          email: values.ownerEmail,
          mobile: values.ownerMobile,
          designation: values.ownerDesignation,
          password: values.ownerPassword,
        },
        subscription: {
          planId: values.planId,
          status: values.subscriptionStatus,
          startsAt: new Date(`${values.startsAt}T00:00:00.000Z`).toISOString(),
          expiresAt: new Date(
            `${values.expiresAt}T23:59:59.999Z`,
          ).toISOString(),
          ...(values.subscriptionStatus === "TRIAL"
            ? {
                trialEndsAt: new Date(
                  `${values.trialEndsAt}T23:59:59.999Z`,
                ).toISOString(),
              }
            : {}),
          currency: values.defaultCurrency,
          amount: Number(values.amount),
          discountAmount: Number(values.discountAmount),
          taxAmount: Number(values.taxAmount),
          finalAmount,
          paymentStatus: values.paymentStatus,
        },
      });
    } catch (requestError) {
      setError(getPlatformErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              Register Tenant
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Creates the company, primary owner, subscription, roles, and setup
              checklist in the database.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form className="space-y-6 p-5" onSubmit={handleSubmit}>
          <section>
            <h4 className="text-sm font-semibold text-slate-950">
              Company Information
            </h4>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <Field
                label="Company Legal Name"
                required
                value={values.legalName}
                onChange={(value) => updateField("legalName", value)}
              />
              <Field
                label="Trade Name"
                required
                value={values.tradeName}
                onChange={(value) => updateField("tradeName", value)}
              />
              <Field
                label="Tenant Code"
                required
                value={values.code}
                onChange={(value) => updateField("code", value.toUpperCase())}
              />
              <Field
                label="Business Type"
                value={values.businessType}
                onChange={(value) => updateField("businessType", value)}
              />
              <Field
                label="Company Email"
                type="email"
                required
                value={values.email}
                onChange={(value) => updateField("email", value)}
              />
              <Field
                label="Mobile Number"
                required
                value={values.mobile}
                onChange={(value) => updateField("mobile", value)}
              />
              <Field
                label="Alternate Number"
                value={values.alternateNumber}
                onChange={(value) => updateField("alternateNumber", value)}
              />
              <Field
                label="Website"
                value={values.website}
                onChange={(value) => updateField("website", value)}
              />
              <Field
                label="Logo URL"
                value={values.logoUrl}
                onChange={(value) => updateField("logoUrl", value)}
              />
              <Field
                label="Address Line 1"
                required
                value={values.addressLine1}
                onChange={(value) => updateField("addressLine1", value)}
              />
              <Field
                label="Address Line 2"
                value={values.addressLine2}
                onChange={(value) => updateField("addressLine2", value)}
              />
              <Field
                label="City"
                required
                value={values.city}
                onChange={(value) => updateField("city", value)}
              />
              <Field
                label="State"
                required
                value={values.state}
                onChange={(value) => updateField("state", value)}
              />
              <Field
                label="PIN Code"
                required
                value={values.pinCode}
                onChange={(value) => updateField("pinCode", value)}
              />
              <Field
                label="Country"
                value={values.country}
                onChange={(value) => updateField("country", value)}
              />
              <Field
                label="GSTIN Optional"
                value={values.gstin}
                onChange={(value) => updateField("gstin", value)}
              />
              <Field
                label="PAN"
                value={values.pan}
                onChange={(value) => updateField("pan", value)}
              />
              <Field
                label="State Code"
                value={values.stateCode}
                onChange={(value) => updateField("stateCode", value)}
              />
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-950">
              Primary Owner
            </h4>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <Field
                label="Owner Name"
                required
                value={values.ownerName}
                onChange={(value) => updateField("ownerName", value)}
              />
              <Field
                label="Owner Email / Login"
                type="email"
                required
                value={values.ownerEmail}
                onChange={(value) => updateField("ownerEmail", value)}
              />
              <Field
                label="Owner Mobile"
                required
                value={values.ownerMobile}
                onChange={(value) => updateField("ownerMobile", value)}
              />
              <Field
                label="Designation"
                value={values.ownerDesignation}
                onChange={(value) => updateField("ownerDesignation", value)}
              />
              <Field
                label="Temporary Password"
                type="password"
                required
                minLength={12}
                value={values.ownerPassword}
                onChange={(value) => updateField("ownerPassword", value)}
              />
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-950">
              Subscription
            </h4>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <label>
                <span className="text-sm font-medium text-slate-700">Plan</span>
                <select
                  required
                  className={fieldClass}
                  value={values.planId}
                  onChange={(event) => selectPlan(event.target.value)}
                >
                  <option value="">Select a plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — ₹
                      {Number(plan.basePrice).toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Subscription Status
                </span>
                <select
                  className={fieldClass}
                  value={values.subscriptionStatus}
                  onChange={(event) =>
                    updateField("subscriptionStatus", event.target.value)
                  }
                >
                  <option value="ACTIVE">Active</option>
                  <option value="TRIAL">Trial</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Payment Status
                </span>
                <select
                  className={fieldClass}
                  value={values.paymentStatus}
                  onChange={(event) =>
                    updateField("paymentStatus", event.target.value)
                  }
                >
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="WAIVED">Waived</option>
                </select>
              </label>
              <Field
                label="Starts On"
                type="date"
                required
                value={values.startsAt}
                onChange={(value) => updateField("startsAt", value)}
              />
              <Field
                label="Expires On"
                type="date"
                required
                value={values.expiresAt}
                onChange={(value) => updateField("expiresAt", value)}
              />
              {values.subscriptionStatus === "TRIAL" && (
                <Field
                  label="Trial Ends On"
                  type="date"
                  required
                  value={values.trialEndsAt}
                  onChange={(value) => updateField("trialEndsAt", value)}
                />
              )}
              <Field
                label="Amount"
                type="number"
                min="0"
                step="0.01"
                required
                value={values.amount}
                onChange={(value) => updateField("amount", value)}
              />
              <Field
                label="Discount"
                type="number"
                min="0"
                step="0.01"
                value={values.discountAmount}
                onChange={(value) => updateField("discountAmount", value)}
              />
              <Field
                label="Tax"
                type="number"
                min="0"
                step="0.01"
                value={values.taxAmount}
                onChange={(value) => updateField("taxAmount", value)}
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
          </section>

          {error && (
            <p
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting || plans.length === 0}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Registering…" : "Register Tenant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, onChange, ...inputProps }) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
    </label>
  );
}

function EditTenantModal({ tenant, onClose, onSave }) {
  const owner = tenant.users[0];
  const [values, setValues] = useState({
    legalName: tenant.legalName || "",
    tradeName: tenant.tradeName || "",
    businessType: tenant.businessType || "",
    email: tenant.email || "",
    mobile: tenant.mobile || "",
    alternateNumber: tenant.alternateNumber || "",
    website: tenant.website || "",
    addressLine1: tenant.addressLine1 || "",
    addressLine2: tenant.addressLine2 || "",
    city: tenant.city || "",
    state: tenant.state || "",
    pinCode: tenant.pinCode || "",
    country: tenant.country || "India",
    gstin: tenant.gstin || "",
    pan: tenant.pan || "",
    stateCode: tenant.stateCode || "",
    taxRegistrationType: tenant.taxRegistrationType || "",
    defaultCurrency: tenant.defaultCurrency || "INR",
    timeZone: tenant.timeZone || "Asia/Kolkata",
    invoicePrefix: tenant.invoicePrefix || "",
    ownerName: owner?.name || "",
    ownerEmail: owner?.email || "",
    ownerMobile: owner?.mobile || "",
    ownerDesignation: owner?.designation || "",
    ownerStatus: owner?.status || "ACTIVE",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (name, value) =>
    setValues((current) => ({ ...current, [name]: value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(tenant, owner, values);
    } catch (requestError) {
      setError(getPlatformErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold">Edit Tenant</h3>
            <p className="text-sm text-slate-500">
              {tenant.code} — company and primary-owner details
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
        <form className="space-y-6 p-5" onSubmit={submit}>
          <section>
            <h4 className="text-sm font-semibold">Company Information</h4>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {[
                ["legalName", "Legal Name", "text", true],
                ["tradeName", "Trade Name"],
                ["businessType", "Business Type"],
                ["email", "Company Email", "email", true],
                ["mobile", "Mobile", "text", true],
                ["alternateNumber", "Alternate Number"],
                ["website", "Website"],
                ["addressLine1", "Address Line 1"],
                ["addressLine2", "Address Line 2"],
                ["city", "City"],
                ["state", "State"],
                ["pinCode", "PIN Code"],
                ["country", "Country"],
                ["gstin", "GSTIN"],
                ["pan", "PAN"],
                ["stateCode", "State Code"],
                ["taxRegistrationType", "Tax Registration Type"],
                ["defaultCurrency", "Currency"],
                ["timeZone", "Time Zone"],
                ["invoicePrefix", "Invoice Prefix"],
              ].map(([name, label, type = "text", required = false]) => (
                <Field
                  key={name}
                  label={label}
                  type={type}
                  required={required}
                  value={values[name]}
                  onChange={(value) => set(name, value)}
                />
              ))}
            </div>
          </section>
          {owner ? (
            <section>
              <h4 className="text-sm font-semibold">Primary Owner</h4>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <Field
                  label="Owner Name"
                  required
                  value={values.ownerName}
                  onChange={(value) => set("ownerName", value)}
                />
                <Field
                  label="Owner Email / Login"
                  type="email"
                  required
                  value={values.ownerEmail}
                  onChange={(value) => set("ownerEmail", value)}
                />
                <Field
                  label="Owner Mobile"
                  value={values.ownerMobile}
                  onChange={(value) => set("ownerMobile", value)}
                />
                <Field
                  label="Designation"
                  value={values.ownerDesignation}
                  onChange={(value) => set("ownerDesignation", value)}
                />
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Owner Status
                  </span>
                  <select
                    className={fieldClass}
                    value={values.ownerStatus}
                    onChange={(event) => set("ownerStatus", event.target.value)}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PENDING_ACTIVATION">
                      Pending Activation
                    </option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="LOCKED">Locked</option>
                  </select>
                </label>
              </div>
            </section>
          ) : (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              No primary owner exists for this tenant.
            </p>
          )}
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
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TenantsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "ALL";
  const [search, setSearch] = useState("");
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingTenantId, setUpdatingTenantId] = useState("");
  const [editingTenant, setEditingTenant] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([getTenants(), getSubscriptionPlans()])
      .then(([tenantRecords, planRecords]) => {
        if (active) {
          setTenants(tenantRecords);
          setPlans(planRecords);
        }
      })
      .catch(
        (requestError) =>
          active && setError(getPlatformErrorMessage(requestError)),
      )
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(
    () =>
      tenants.filter(
        (tenant) =>
          (statusFilter === "ALL" || tenant.status === statusFilter) &&
          [
            tenant.code,
            tenant.legalName,
            tenant.tradeName,
            tenant.city,
            tenant.status,
            tenant.users[0]?.name,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [search, statusFilter, tenants],
  );

  async function createTenant(payload) {
    await registerTenant(payload);
    const tenantRecords = await getTenants();
    setTenants(tenantRecords);
    setShowCreate(false);
  }

  async function changeTenantStatus(tenant, status) {
    const action = status === "ACTIVE" ? "activation" : "suspension";
    const reason = window.prompt(`Enter the reason for tenant ${action}:`);
    if (!reason?.trim()) return;
    setError("");
    setUpdatingTenantId(tenant.id);
    try {
      await updateTenantStatus(tenant.id, status, reason.trim());
      setTenants(await getTenants());
    } catch (requestError) {
      setError(getPlatformErrorMessage(requestError));
    } finally {
      setUpdatingTenantId("");
    }
  }

  async function saveTenant(tenant, owner, values) {
    const companyPayload = {
      legalName: values.legalName,
      tradeName: values.tradeName || null,
      businessType: values.businessType || null,
      email: values.email,
      mobile: values.mobile,
      alternateNumber: values.alternateNumber || null,
      website: values.website || null,
      addressLine1: values.addressLine1 || null,
      addressLine2: values.addressLine2 || null,
      city: values.city || null,
      state: values.state || null,
      pinCode: values.pinCode || null,
      country: values.country,
      gstin: values.gstin || null,
      pan: values.pan || null,
      stateCode: values.stateCode || null,
      taxRegistrationType: values.taxRegistrationType || null,
      defaultCurrency: values.defaultCurrency.toUpperCase(),
      timeZone: values.timeZone,
      invoicePrefix: values.invoicePrefix || null,
    };
    await updateTenant(tenant.id, companyPayload);
    if (owner) {
      await updateTenantOwner(tenant.id, owner.id, {
        name: values.ownerName,
        email: values.ownerEmail,
        mobile: values.ownerMobile || null,
        designation: values.ownerDesignation || null,
        status: values.ownerStatus,
      });
    }
    setTenants(await getTenants());
    setEditingTenant(null);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Tenants" value={tenants.length} />
        <SummaryCard
          label="Active"
          value={tenants.filter((item) => item.status === "ACTIVE").length}
          tone="success"
        />
        <SummaryCard
          label="Pending Setup"
          value={
            tenants.filter((item) => item.status === "PENDING_SETUP").length
          }
          tone="warning"
        />
        <SummaryCard
          label="Suspended"
          value={tenants.filter((item) => item.status === "SUSPENDED").length}
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
        title="Tenant List"
        subtitle="Database-backed Cablix tenant records."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <FilterBar
              search={search}
              onSearch={setSearch}
              placeholder="Search tenant"
            >
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(event) =>
                  setSearchParams(
                    event.target.value === "ALL"
                      ? {}
                      : { status: event.target.value },
                  )
                }
              >
                <option value="ALL">All tenant statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING_SETUP">Pending setup</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="CLOSED">Closed</option>
              </select>
            </FilterBar>
            <button
              type="button"
              disabled={plans.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} /> Add Tenant
            </button>
          </div>
        }
      >
        <TableShell
          columns={[
            "Tenant",
            "Owner",
            "Location",
            "Subscription",
            "Onboarding",
            "Status",
            "Created",
            "Actions",
          ]}
          minWidth="1100px"
          empty={!isLoading && rows.length === 0}
        >
          {rows.map((tenant) => {
            const owner = tenant.users[0];
            const subscription = tenant.subscriptions[0];
            return (
              <tr key={tenant.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-950">
                    {tenant.tradeName || tenant.legalName}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    {tenant.code} • {tenant.legalName}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">
                    {owner?.name || "—"}
                  </p>
                  <p className="text-xs text-slate-500">{owner?.email}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {[tenant.city, tenant.state].filter(Boolean).join(", ") ||
                    "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={
                      subscription
                        ? getEffectiveSubscriptionStatus(subscription)
                        : "NO_SUBSCRIPTION"
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {subscription?.plan?.name}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={tenant.onboardingStatus} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={tenant.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(tenant.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
                      onClick={() => setEditingTenant(tenant)}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    {tenant.status !== "ACTIVE" && (
                      <button
                        disabled={updatingTenantId === tenant.id}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        onClick={() => changeTenantStatus(tenant, "ACTIVE")}
                      >
                        Activate
                      </button>
                    )}
                    {tenant.status !== "SUSPENDED" && (
                      <button
                        disabled={updatingTenantId === tenant.id}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                        onClick={() => changeTenantStatus(tenant, "SUSPENDED")}
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </TableShell>
      </Section>
      {showCreate && (
        <TenantModal
          plans={plans}
          onClose={() => setShowCreate(false)}
          onSave={createTenant}
        />
      )}
      {editingTenant && (
        <EditTenantModal
          tenant={editingTenant}
          onClose={() => setEditingTenant(null)}
          onSave={saveTenant}
        />
      )}
    </div>
  );
}

export default TenantsPage;
