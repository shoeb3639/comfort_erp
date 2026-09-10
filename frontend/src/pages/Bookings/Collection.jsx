import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { IndianRupee, Trash2 } from "lucide-react";
import DriverSettlement from "../../components/DriverSettlement";
import {
  addBookingCollection,
  getBooking,
  getBookingErrorMessage,
  verifyBookingCollection,
  voidBookingCollection,
} from "../../services/bookings";

const cashDepositStatuses = ["Pending", "Deposited", "Verified"];
const directDepositStatuses = ["Directly Received", "Verified"];

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const readOnlyClass =
  "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800";

function toNumber(value) {
  return Number(value || 0);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function getTotalBillAmount(booking, invoice) {
  if (booking?.closeDetails?.totalBillAmount)
    return toNumber(booking.closeDetails.totalBillAmount);
  if (invoice?.totals?.netPayable) return toNumber(invoice.totals.netPayable);
  if (invoice?.total)
    return toNumber(String(invoice.total).replace(/[^0-9.]/g, ""));
  return toNumber(booking?.fixedAmount || booking?.amount);
}

function getPaymentStatus(
  totalBillAmount,
  totalCollected,
  cashPendingDeposit,
  depositedAmount,
  verifiedAmount,
) {
  if (totalCollected <= 0) return "Unpaid";
  if (cashPendingDeposit > 0) return "Cash With Manager";
  if (verifiedAmount >= totalBillAmount && totalBillAmount > 0)
    return "Verified";
  if (depositedAmount >= totalBillAmount && totalBillAmount > 0)
    return "Deposited";
  if (totalCollected >= totalBillAmount && totalBillAmount > 0) return "Paid";
  return "Partially Paid";
}

function SummaryCard({ label, value, tone = "default" }) {
  const toneClass =
    tone === "danger"
      ? "text-rose-700"
      : tone === "success"
        ? "text-emerald-700"
        : "text-slate-950";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-xl font-bold ${toneClass}`}>₹ {money(value)}</p>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={readOnlyClass}>{value || "-"}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BookingCollectionPage() {
  const params = useParams();
  const bookingId = params.id || params.bookingId;
  const [booking, setBooking] = useState(null);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const invoice = booking?.invoice;
  const customer = booking
    ? { billingName: booking.customer, displayName: booking.customer }
    : null;
  const traveller = booking?.travellerName
    ? { name: booking.travellerName }
    : null;

  useEffect(() => {
    getBooking(bookingId)
      .then((record) => {
        setBooking(record);
        setCollections(record.collections || []);
      })
      .catch((error) => setNotice(getBookingErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const totalBillAmount = getTotalBillAmount(booking, invoice);
  const totalCollected = collections.reduce(
    (sum, item) => sum + toNumber(item.amount),
    0,
  );
  const cashPendingDeposit = collections
    .filter(
      (item) =>
        item.paymentMode === "Cash" &&
        item.paymentHolder !== "DRIVER" &&
        !["Deposited", "Verified"].includes(item.depositStatus),
    )
    .reduce((sum, item) => sum + toNumber(item.amount), 0);
  const verifiedAmount = collections
    .filter((item) =>
      ["Verified", "Directly Received"].includes(item.depositStatus),
    )
    .reduce((sum, item) => sum + toNumber(item.amount), 0);
  const depositedAmount = collections
    .filter((item) =>
      ["Deposited", "Verified", "Directly Received"].includes(
        item.depositStatus,
      ),
    )
    .reduce((sum, item) => sum + toNumber(item.amount), 0);
  const balanceAmount = Math.max(0, totalBillAmount - totalCollected);
  const paymentStatus = getPaymentStatus(
    totalBillAmount,
    totalCollected,
    cashPendingDeposit,
    depositedAmount,
    verifiedAmount,
  );

  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      collectionDate: new Date().toISOString().slice(0, 10),
      amount: "",
      paymentMode: "Cash",
      collectedBy: "Driver",
      receiverName: "",
      referenceNumber: "",
      remarks: "",
      isCashDeposited: "No",
      depositDate: "",
      depositMode: "Cash Deposit",
      depositReferenceNumber: "",
      depositedBy: "",
      verifiedBy: "",
      depositStatus: "Pending",
    },
  });

  const values = useWatch({ control });
  const isCashPayment = values.paymentMode === "Cash";

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading collections…
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Booking not found.{" "}
        <Link className="font-semibold text-brand-600" to="/bookings">
          Back to bookings
        </Link>
      </div>
    );
  }

  async function addCollection(formValues) {
    const depositStatus =
      formValues.paymentMode === "Cash"
        ? formValues.isCashDeposited === "Yes"
          ? cashDepositStatuses.includes(formValues.depositStatus)
            ? formValues.depositStatus
            : "Deposited"
          : "Pending"
        : directDepositStatuses.includes(formValues.depositStatus)
          ? formValues.depositStatus
          : "Directly Received";

    try {
      const updated = await addBookingCollection(booking.id, {
        ...formValues,
        depositStatus,
      });
      setBooking(updated);
      setCollections(updated.collections || []);
      setNotice("Collection recorded successfully.");
    } catch (error) {
      setNotice(getBookingErrorMessage(error));
      return;
    }
    reset({
      collectionDate: new Date().toISOString().slice(0, 10),
      amount: "",
      paymentMode: "Cash",
      collectedBy: "Driver",
      receiverName: "",
      referenceNumber: "",
      remarks: "",
      isCashDeposited: "No",
      depositDate: "",
      depositMode: "Cash Deposit",
      depositReferenceNumber: "",
      depositedBy: "",
      verifiedBy: "",
      depositStatus: "Pending",
    });
  }

  async function deleteCollection(collectionId) {
    try {
      const updated = await voidBookingCollection(booking.id, collectionId);
      setBooking(updated);
      setCollections(updated.collections || []);
      setNotice("Collection voided successfully.");
    } catch (error) {
      setNotice(getBookingErrorMessage(error));
    }
  }

  async function markVerified(collectionId) {
    try {
      const updated = await verifyBookingCollection(
        booking.id,
        collectionId,
        values.verifiedBy,
      );
      setBooking(updated);
      setCollections(updated.collections || []);
      setNotice("Collection verified successfully.");
    } catch (error) {
      setNotice(getBookingErrorMessage(error));
    }
  }

  return (
    <div className="space-y-5">
      {notice && (
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
          {notice}
        </div>
      )}
      <Section title="Booking Summary">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyField label="Booking ID" value={booking.id} />
          <ReadOnlyField
            label="Customer Name"
            value={
              customer?.billingName || customer?.displayName || booking.customer
            }
          />
          <ReadOnlyField
            label="Traveller Name"
            value={traveller?.name || booking.customer}
          />
          <ReadOnlyField
            label="Vehicle"
            value={[booking.vehicleType, booking.vehicleRegistrationNo]
              .filter(Boolean)
              .join(" ")}
          />
          <ReadOnlyField
            label="Total Bill Amount"
            value={`₹ ${money(totalBillAmount)}`}
          />
          <ReadOnlyField
            label="Amount Received"
            value={`₹ ${money(totalCollected)}`}
          />
          <ReadOnlyField
            label="Balance Amount"
            value={`₹ ${money(balanceAmount)}`}
          />
          <ReadOnlyField label="Payment Status" value={paymentStatus} />
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
        <form className="space-y-5" onSubmit={handleSubmit(addCollection)}>
          <Section title="Add Collection">
            <div className="grid gap-4 md:grid-cols-3">
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Collection Date
                </span>
                <input
                  className={fieldClass}
                  type="date"
                  {...register("collectionDate", {
                    required: "Collection date is required",
                  })}
                />
                {errors.collectionDate && (
                  <p className="mt-1 text-xs font-medium text-rose-600">
                    {errors.collectionDate.message}
                  </p>
                )}
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Amount
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  {...register("amount", {
                    required: "Amount is required",
                    min: { value: 1, message: "Amount must be greater than 0" },
                  })}
                />
                {errors.amount && (
                  <p className="mt-1 text-xs font-medium text-rose-600">
                    {errors.amount.message}
                  </p>
                )}
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Payment Mode
                </span>
                <select className={fieldClass} {...register("paymentMode")}>
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                  <option>Card</option>
                  <option>Cheque</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Collected By
                </span>
                <select className={fieldClass} {...register("collectedBy")}>
                  <option>Driver</option>
                  <option>Manager</option>
                  <option>Admin</option>
                  <option>Direct Company Account</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Receiver Name
                </span>
                <input className={fieldClass} {...register("receiverName")} />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Reference Number
                </span>
                <input
                  className={fieldClass}
                  {...register("referenceNumber")}
                />
              </label>
              <label className="md:col-span-3">
                <span className="text-sm font-medium text-slate-700">
                  Remarks
                </span>
                <textarea
                  className={`${fieldClass} min-h-20 resize-y`}
                  {...register("remarks")}
                />
              </label>
            </div>
          </Section>

          <Section title="Deposit Tracking">
            {isCashPayment ? (
              <div className="grid gap-4 md:grid-cols-3">
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Is Cash Deposited to Company Account?
                  </span>
                  <select
                    className={fieldClass}
                    {...register("isCashDeposited")}
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Deposit Date
                  </span>
                  <input
                    className={fieldClass}
                    type="date"
                    disabled={values.isCashDeposited !== "Yes"}
                    {...register("depositDate")}
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Deposit Mode
                  </span>
                  <select
                    className={fieldClass}
                    disabled={values.isCashDeposited !== "Yes"}
                    {...register("depositMode")}
                  >
                    <option>Cash Deposit</option>
                    <option>UPI</option>
                    <option>Bank Transfer</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Deposit Reference Number
                  </span>
                  <input
                    className={fieldClass}
                    disabled={values.isCashDeposited !== "Yes"}
                    {...register("depositReferenceNumber")}
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Deposited By
                  </span>
                  <input
                    className={fieldClass}
                    disabled={values.isCashDeposited !== "Yes"}
                    {...register("depositedBy")}
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Verified By
                  </span>
                  <input
                    className={fieldClass}
                    disabled={values.isCashDeposited !== "Yes"}
                    {...register("verifiedBy")}
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Deposit Status
                  </span>
                  <select
                    className={fieldClass}
                    disabled={values.isCashDeposited !== "Yes"}
                    {...register("depositStatus")}
                  >
                    <option>Pending</option>
                    <option>Deposited</option>
                    <option>Verified</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Deposit Status
                  </span>
                  <select className={fieldClass} {...register("depositStatus")}>
                    <option>Directly Received</option>
                    <option>Verified</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Verified By
                  </span>
                  <input className={fieldClass} {...register("verifiedBy")} />
                </label>
              </div>
            )}
            <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Booking payment collections are separate from manager expense
              fund. Cash booking payments should not be used for expenses.
            </div>
          </Section>

          <div className="flex justify-end">
            <button className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              <IndianRupee size={16} />
              Add Collection
            </button>
          </div>
        </form>

        <Section title="Payment Summary">
          <div className="grid gap-3">
            <SummaryCard label="Total Bill Amount" value={totalBillAmount} />
            <SummaryCard
              label="Total Collected"
              value={totalCollected}
              tone="success"
            />
            <SummaryCard
              label="Pending Balance"
              value={balanceAmount}
              tone={balanceAmount > 0 ? "danger" : "success"}
            />
            <SummaryCard
              label="Cash Pending Deposit"
              value={cashPendingDeposit}
              tone={cashPendingDeposit > 0 ? "danger" : "default"}
            />
            <SummaryCard
              label="Verified Amount"
              value={verifiedAmount}
              tone="success"
            />
          </div>
        </Section>
      </div>

      <Section title="Collection History">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[900px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Date
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Payment Mode
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Collected By
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Deposit Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Reference
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {collections.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-slate-600">
                    {item.collectionDate}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    ₹ {money(item.amount)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.paymentMode}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.collectedBy}
                    {item.receiverName ? ` - ${item.receiverName}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {item.depositStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.referenceNumber || item.depositReferenceNumber || "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      {item.depositStatus !== "Verified" &&
                        !item.driverBalance && (
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => markVerified(item.id)}
                          >
                            Verify
                          </button>
                        )}
                      {!item.fuelAmount && !item.returnedAmount && (
                        <button
                          type="button"
                          aria-label="Delete collection"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"
                          onClick={() => deleteCollection(item.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {collections.length === 0 && (
            <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">
              No collections recorded yet.
            </div>
          )}
        </div>
      </Section>
      {collections
        .filter((item) => item.paymentHolder === "DRIVER")
        .map((item) => (
          <DriverSettlement
            key={item.id}
            collection={item}
            onUpdated={async () => {
              const updated = await getBooking(bookingId);
              setBooking(updated);
              setCollections(updated.collections || []);
            }}
          />
        ))}
    </div>
  );
}

export default BookingCollectionPage;
