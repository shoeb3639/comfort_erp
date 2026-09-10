import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import DriverSettlement from "../../components/DriverSettlement";
import { getDriverLedger } from "../../services/drivers";
import { getAccountsErrorMessage } from "../../services/accounts";
import { verifyBookingCollection } from "../../services/bookings";

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
const label = (value) => String(value || "—").replaceAll("_", " ");

export default function DriverLedgerPage() {
  const { driverId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const canVerify = user?.permissions?.includes("accounts.deposit.manage");
  const canViewCollections = user?.permissions?.includes(
    "accounts.collection.view",
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getDriverLedger(driverId));
    } catch (failure) {
      setError(getAccountsErrorMessage(failure));
    } finally {
      setLoading(false);
    }
  }, [driverId]);
  useEffect(() => {
    setData(null);
    setSelectedId(null);
    load();
  }, [load]);
  const selected = data?.collections.find((row) => row.id === selectedId);
  async function verify() {
    if (!selected || verifying) return;
    setVerifying(true);
    try {
      await verifyBookingCollection(
        selected.booking.bookingId,
        selected.id,
        user?.name,
      );
      await load();
    } catch (failure) {
      setError(getAccountsErrorMessage(failure));
    } finally {
      setVerifying(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to="/drivers" className="text-sm font-semibold text-brand-700">
            ← Drivers
          </Link>
          <h2 className="mt-2 text-xl font-bold">
            {data?.driver.displayName || data?.driver.name || "Driver"} —
            Accounts
          </h2>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={load}
          className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Customer payments", data.summary.customerPayments],
              ["Fuel spent", data.summary.fuelSpent],
              ["Returned to company", data.summary.returnedToCompany],
              ["Still with driver", data.summary.heldByDriver],
            ].map(([title, value]) => (
              <div key={title} className="rounded-xl border bg-white p-4">
                <p className="text-sm text-slate-600">{title}</p>
                <p
                  className={`mt-2 text-xl font-bold ${title === "Still with driver" ? "text-amber-700" : "text-slate-950"}`}
                >
                  {money(value)}
                </p>
              </div>
            ))}
          </div>
          <section className="overflow-x-auto rounded-xl border bg-white p-4">
            <h3 className="font-bold">
              Booking collections and driver balances
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Customer payments held by this driver, less fuel spent and money
              returned to the company.
            </p>
            <table className="mt-4 w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Date / Receipt",
                    "Booking",
                    "Payment",
                    "Fuel",
                    "Returned",
                    "With driver",
                    "Status",
                    "Action",
                  ].map((title) => (
                    <th className="p-3" key={title}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.collections.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3">
                      {row.collectionDate}
                      <span className="block text-xs text-slate-500">
                        {row.receiptNumber}
                      </span>
                    </td>
                    <td className="p-3">{row.booking.bookingId}</td>
                    <td className="p-3">
                      {money(row.amount)}
                      <span className="block text-xs text-slate-500">
                        {row.paymentModeLabel}
                      </span>
                    </td>
                    <td className="p-3">{money(row.fuelAmount)}</td>
                    <td className="p-3">{money(row.returnedAmount)}</td>
                    <td className="p-3 font-semibold text-amber-700">
                      {money(row.driverBalance)}
                    </td>
                    <td className="p-3">{row.statusLabel}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className="font-semibold text-brand-700"
                      >
                        View settlement
                      </button>
                    </td>
                  </tr>
                ))}
                {!data.collections.length && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      No customer payments are linked to this driver.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          {selected && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-bold">
                  Booking {selected.booking.bookingId}
                </h3>
                {canViewCollections && (
                  <Link
                    className="text-sm font-semibold text-brand-700"
                    to={`/accounts/collections?receipt=${selected.id}`}
                  >
                    Receipt and audit history
                  </Link>
                )}
                {canVerify &&
                  selected.driverBalance === 0 &&
                  selected.status !== "VERIFIED" && (
                    <button
                      disabled={verifying}
                      onClick={verify}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {verifying ? "Verifying…" : "Verify settlement"}
                    </button>
                  )}
                <button
                  type="button"
                  className="ml-auto text-sm"
                  onClick={() => setSelectedId(null)}
                >
                  Close details
                </button>
              </div>
              <DriverSettlement
                key={selected.id}
                collection={selected}
                onUpdated={load}
              />
            </section>
          )}
          <section className="overflow-x-auto rounded-xl border bg-white p-4">
            <h3 className="font-bold">
              Advances, recoveries and other account entries
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Company advances: {money(data.summary.advances)} · Recoveries:{" "}
              {money(data.summary.recoveries)} · Advances less recoveries:{" "}
              {money(data.summary.advanceBalance)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              These operating-account entries are shown separately from customer
              money held by the driver.
            </p>
            <table className="mt-4 w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Date",
                    "Type / Category",
                    "Description",
                    "Mode",
                    "Amount",
                    "Reference",
                  ].map((title) => (
                    <th key={title} className="p-3">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((row) => (
                  <tr className="border-t" key={row.id}>
                    <td className="p-3">{row.date}</td>
                    <td className="p-3">
                      {label(row.type)}
                      {row.category && (
                        <span className="block text-xs">
                          {label(row.category)}
                        </span>
                      )}
                    </td>
                    <td className="p-3">{row.description}</td>
                    <td className="p-3">{label(row.paymentMode)}</td>
                    <td className="p-3">{money(row.amount)}</td>
                    <td className="p-3">{row.referenceNumber}</td>
                  </tr>
                ))}
                {!data.transactions.length && (
                  <tr>
                    <td className="p-6 text-center text-slate-500" colSpan={6}>
                      No account entries are linked to this driver.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
