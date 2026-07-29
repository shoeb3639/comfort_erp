import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getPlatformAuditLogs,
  getPlatformErrorMessage,
  getTenantSubscriptions,
  getTenants,
} from "../../services/platform";
import {
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  formatDate,
  getEffectiveSubscriptionStatus,
  money,
  toNumber,
} from "./platformUtils";

function monthlyValue(subscription) {
  const amount = toNumber(subscription.finalAmount);
  const divisor = {
    MONTHLY: 1,
    QUARTERLY: 3,
    HALF_YEARLY: 6,
    ANNUAL: 12,
  }[subscription.billingCycle];
  return divisor ? amount / divisor : amount;
}

function PlatformDashboardPage() {
  const [tenants, setTenants] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      getTenants(),
      getTenantSubscriptions(),
      getPlatformAuditLogs(),
    ])
      .then(([tenantRecords, subscriptionRecords, activityRecords]) => {
        if (!active) return;
        setTenants(tenantRecords);
        setSubscriptions(subscriptionRecords);
        setAuditLogs(activityRecords);
      })
      .catch(
        (requestError) =>
          active && setError(getPlatformErrorMessage(requestError)),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 86400000);
    const activeSubscriptions = subscriptions.filter(
      (item) => getEffectiveSubscriptionStatus(item, now) === "ACTIVE",
    );
    const trialSubscriptions = subscriptions.filter(
      (item) => getEffectiveSubscriptionStatus(item, now) === "TRIAL",
    );
    const expiredSubscriptions = subscriptions.filter((item) =>
      ["EXPIRED", "SUSPENDED", "CANCELLED"].includes(
        getEffectiveSubscriptionStatus(item, now),
      ),
    );
    const expiringSoon = subscriptions.filter((item) => {
      const expiry = new Date(item.expiresAt);
      return (
        ["ACTIVE", "TRIAL", "GRACE_PERIOD"].includes(
          getEffectiveSubscriptionStatus(item, now),
        ) &&
        expiry >= now &&
        expiry <= sevenDays
      );
    });
    const outstanding = subscriptions
      .filter(
        (item) => !["PAID", "WAIVED", "REFUNDED"].includes(item.paymentStatus),
      )
      .reduce((sum, item) => sum + toNumber(item.finalAmount), 0);
    return {
      activeSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
      expiringSoon,
      suspendedTenants: tenants.filter((item) => item.status === "SUSPENDED"),
      monthlyRecurringRevenue: activeSubscriptions.reduce(
        (sum, item) => sum + monthlyValue(item),
        0,
      ),
      outstanding,
    };
  }, [subscriptions, tenants]);

  const attention = useMemo(
    () =>
      subscriptions
        .filter(
          (item) =>
            [
              "TRIAL",
              "GRACE_PERIOD",
              "EXPIRED",
              "SUSPENDED",
              "CANCELLED",
            ].includes(getEffectiveSubscriptionStatus(item)) ||
            !["PAID", "WAIVED", "REFUNDED"].includes(item.paymentStatus) ||
            new Date(item.expiresAt) < new Date(),
        )
        .sort(
          (left, right) => new Date(left.expiresAt) - new Date(right.expiresAt),
        )
        .slice(0, 8),
    [subscriptions],
  );

  return (
    <div className="space-y-5">
      {error && (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardLink to="/platform/tenants">
          <SummaryCard
            label="Total Tenants"
            value={tenants.length}
            caption={loading ? "Loading…" : "View tenant list"}
          />
        </DashboardLink>
        <DashboardLink to="/platform/subscriptions?view=ACTIVE">
          <SummaryCard
            label="Active Subscriptions"
            value={metrics.activeSubscriptions.length}
            tone="success"
            caption="View active subscriptions"
          />
        </DashboardLink>
        <DashboardLink to="/platform/subscriptions?view=TRIAL">
          <SummaryCard
            label="Trial Tenants"
            value={metrics.trialSubscriptions.length}
            tone="warning"
            caption="View trial subscriptions"
          />
        </DashboardLink>
        <DashboardLink to="/platform/tenants?status=SUSPENDED">
          <SummaryCard
            label="Suspended Tenants"
            value={metrics.suspendedTenants.length}
            tone="danger"
            caption="View suspended tenants"
          />
        </DashboardLink>
        <DashboardLink to="/platform/subscriptions?view=EXPIRING_SOON">
          <SummaryCard
            label="Expiring Soon"
            value={metrics.expiringSoon.length}
            tone="warning"
            caption="View next 7 days"
          />
        </DashboardLink>
        <DashboardLink to="/platform/subscriptions?view=EXPIRED_BLOCKED">
          <SummaryCard
            label="Expired / Blocked"
            value={metrics.expiredSubscriptions.length}
            tone="danger"
            caption="View restricted accounts"
          />
        </DashboardLink>
        <SummaryCard
          label="Estimated MRR"
          value={money(metrics.monthlyRecurringRevenue)}
          prefix="₹ "
          tone="success"
        />
        <SummaryCard
          label="Outstanding"
          value={money(metrics.outstanding)}
          prefix="₹ "
          tone="danger"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section
          title="Subscriptions Needing Attention"
          subtitle="Live trials, grace periods, expiry, suspension, and payment records."
          actions={
            <Link
              className="text-sm font-semibold text-brand-600"
              to="/platform/subscriptions"
            >
              View all
            </Link>
          }
        >
          <TableShell
            columns={["Tenant", "Status", "Payment", "End Date", "Amount"]}
            minWidth="720px"
            empty={!loading && attention.length === 0}
          >
            {attention.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    {item.tenant.tradeName || item.tenant.legalName}
                  </p>
                  <p className="text-xs text-slate-500">{item.tenant.code}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={getEffectiveSubscriptionStatus(item)} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.paymentStatus} />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(item.expiresAt)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  ₹ {money(item.finalAmount)}
                </td>
              </tr>
            ))}
          </TableShell>
        </Section>

        <Section
          title="Recent Platform Activity"
          subtitle="Database-backed tenant, subscription, and plan audit events."
          actions={
            <Link
              className="text-sm font-semibold text-brand-600"
              to="/platform/audit-logs"
            >
              Audit logs
            </Link>
          }
        >
          <div className="space-y-3">
            {auditLogs.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {item.action.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.module.replaceAll("_", " ")} •{" "}
                      {item.actor?.name || "System"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {item.remarks ||
                    item.referenceId ||
                    "Platform record updated"}
                </p>
              </div>
            ))}
            {!loading && auditLogs.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                No platform activity recorded yet.
              </p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function DashboardLink({ to, children }) {
  return (
    <Link
      className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
      to={to}
    >
      {children}
    </Link>
  );
}

export default PlatformDashboardPage;
