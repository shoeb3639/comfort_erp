import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, Share2 } from "lucide-react";
import {
  closeBooking as closeBookingApi,
  getBooking,
  getBookingErrorMessage,
} from "../../services/bookings";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const readOnlyClass =
  "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800";

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function toNumber(value) {
  return Number(value || 0);
}

function hasAmount(value) {
  return toNumber(value) !== 0;
}

function today() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function countInclusiveDays(startDate, endDate) {
  if (!startDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate || startDate);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  )
    return 1;

  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function SummaryItem({ label, value, strong = false, tone = "default" }) {
  const toneClass =
    tone === "profit" && value >= 0
      ? "text-emerald-700"
      : tone === "profit"
        ? "text-rose-700"
        : "text-slate-950";

  return (
    <div
      className={`flex items-center justify-between gap-4 py-1.5 ${strong ? "border-t border-slate-200 pt-3 text-base font-bold" : "text-sm"}`}
    >
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${toneClass}`}>₹ {money(value)}</span>
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

function BillingPaperRow({ label, value, strong = false }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 border-b border-dashed border-amber-300/80 py-2 ${strong ? "text-base font-extrabold" : "text-sm font-semibold"}`}
    >
      <span className="text-slate-700">{label}</span>
      <span className="text-right text-slate-950">{value}</span>
    </div>
  );
}

function Section({ title, children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CollapsibleSection({ title, collapsed, onToggle, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <h4 className="text-base font-semibold text-slate-900">{title}</h4>
        <ChevronDown
          size={20}
          className={`shrink-0 text-slate-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
        />
      </button>
      {!collapsed && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </section>
  );
}

function CloseBookingPage() {
  const params = useParams();
  const bookingId = params.id || params.bookingId;
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const customer = booking
    ? { billingName: booking.customer, displayName: booking.customer }
    : null;
  const traveller = booking?.travellerName
    ? { name: booking.travellerName }
    : null;
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const assignmentType =
    booking?.assignmentType || booking?.assignment_type || "own_vehicle";
  const isVendorVehicle = assignmentType === "vendor_vehicle";

  const bookingDays = countInclusiveDays(
    booking?.startDate || booking?.pickupDate,
    booking?.endDate,
  );
  const minimumKm = toNumber(booking?.dailyMinimumKm)
    ? toNumber(booking.dailyMinimumKm) * bookingDays
    : toNumber(booking?.includedKm);
  const defaultTripType =
    booking?.pricing_basis === "rate_per_km" ||
    booking?.billing_model === "rate_per_km"
      ? "KM Based"
      : "Package Based";
  const defaultRatePerKm =
    booking?.ratePerKm ||
    (defaultTripType === "KM Based" ? booking?.amount : "");
  const defaultTotalKm = booking?.estimatedKm || minimumKm || "";

  const {
    control,
    register,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      startKm: "",
      endKm: "",
      totalKm: defaultTotalKm,
      ratePerKm: defaultRatePerKm,
      packageAmount:
        booking?.fixedAmount ||
        (defaultTripType === "Package Based" ? booking?.amount : ""),
      billingTripType: defaultTripType,
      tollTax: 0,
      parking: 0,
      driverAllowance: 0,
      otherRecoverableCharges: 0,
      gst: 0,
      dieselCost: 0,
      directVehicleExpense: 0,
      driverCost: 0,
      vendorPayableAmount: booking?.vendorPayableAmount || 0,
      vendorExtraCharges: 0,
      vendorDeduction: 0,
      paymentAmount: 0,
      paymentMode: "",
      paymentDate: today(),
      paymentReference: "",
      collectedBy: "",
      remarks: "",
    },
  });

  const values = useWatch({ control });
  const actualRunningKm =
    values.endKm && values.startKm
      ? Math.max(0, toNumber(values.endKm) - toNumber(values.startKm))
      : toNumber(values.totalKm);
  const billingKm = Math.max(actualRunningKm, minimumKm);
  const baseFare =
    values.billingTripType === "KM Based"
      ? billingKm * toNumber(values.ratePerKm)
      : toNumber(values.packageAmount);
  const tollTax = toNumber(values.tollTax);
  const parking = toNumber(values.parking);
  const driverAllowance = toNumber(values.driverAllowance);
  const otherRecoverableCharges = toNumber(values.otherRecoverableCharges);
  const gst = toNumber(values.gst);
  const totalBillAmount =
    baseFare +
    tollTax +
    parking +
    driverAllowance +
    otherRecoverableCharges +
    gst;
  const receivedAmount = toNumber(values.paymentAmount);
  const paymentStatus =
    receivedAmount <= 0
      ? "Unpaid"
      : receivedAmount < totalBillAmount
        ? "Partially Paid"
        : "Paid";
  const vehicleRevenue = isVendorVehicle ? 0 : baseFare;
  const netVehicleProfit = isVendorVehicle
    ? 0
    : vehicleRevenue -
      toNumber(values.dieselCost) -
      toNumber(values.directVehicleExpense) -
      toNumber(values.driverCost);
  const vendorRecoverableCharges = tollTax + parking + driverAllowance;
  const vendorBookingRevenue = baseFare + vendorRecoverableCharges;
  const finalVendorPayable = Math.max(
    0,
    toNumber(values.vendorPayableAmount) +
      vendorRecoverableCharges +
      toNumber(values.vendorExtraCharges) -
      toNumber(values.vendorDeduction),
  );
  const vendorBookingProfit = isVendorVehicle
    ? vendorBookingRevenue - finalVendorPayable
    : 0;
  const fixedBillingLabel =
    booking?.booking_type === "local"
      ? "Local Package"
      : booking?.booking_type === "airport_transfer"
        ? "Airport Transfer"
        : booking?.booking_type === "railway_station_transfer"
          ? "Railway Transfer"
          : booking?.booking_type === "package"
            ? "Package Amount"
            : "Fixed Amount";

  useEffect(() => {
    getBooking(bookingId)
      .then(setBooking)
      .catch((error) => setLoadError(getBookingErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    if (!booking) return;
    const dutyDetails = booking.dutyCompletionDetails || {};
    reset({
      startKm: booking.openingOdometer ?? "",
      endKm: booking.closingOdometer ?? "",
      totalKm: booking.actualDistance || defaultTotalKm,
      ratePerKm: defaultRatePerKm,
      packageAmount:
        booking.fixedAmount ||
        (defaultTripType === "Package Based" ? booking.amount : ""),
      billingTripType: defaultTripType,
      tollTax: dutyDetails.tollTax || 0,
      parking: dutyDetails.parking || 0,
      driverAllowance: dutyDetails.driverAllowance || 0,
      otherRecoverableCharges: dutyDetails.otherRecoverableCharges || 0,
      gst: 0,
      dieselCost: 0,
      directVehicleExpense: 0,
      driverCost: 0,
      vendorPayableAmount: booking.vendorPayableAmount || 0,
      vendorExtraCharges: 0,
      vendorDeduction: 0,
      paymentAmount: dutyDetails.paymentAmount || 0,
      paymentMode: dutyDetails.paymentMode || "",
      paymentDate: dutyDetails.paymentDate
        ? String(dutyDetails.paymentDate).slice(0, 10)
        : today(),
      paymentReference: dutyDetails.paymentReference || "",
      collectedBy: dutyDetails.collectedBy || "",
      remarks: "",
    });
  }, [booking, defaultRatePerKm, defaultTotalKm, defaultTripType, reset]);

  useEffect(() => {
    const timerId = window.setTimeout(() => setIsSummaryCollapsed(true), 2000);
    return () => window.clearTimeout(timerId);
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading booking…
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        {loadError || "Booking not found."}{" "}
        <Link className="font-semibold text-brand-600" to="/bookings">
          Back to bookings
        </Link>
      </div>
    );
  }

  async function closeBooking(formValues) {
    try {
      await closeBookingApi(booking.id, formValues);
      navigate("/bookings", {
        state: { notice: `Booking ${booking.id} closed successfully.` },
      });
    } catch (error) {
      setLoadError(getBookingErrorMessage(error));
    }
  }

  function shareBillingSummary() {
    const lines = [
      `Booking Billing Summary`,
      `Booking: ${booking.id}`,
      `Customer: ${customer?.billingName || customer?.displayName || booking.customer || "-"}`,
      `Traveller: ${traveller?.name || booking.customer || "-"}`,
      `Route: ${[booking.travellingFrom || booking.pickupReportingAddress, booking.travellingTo || booking.routeStops].filter(Boolean).join(" to ") || "-"}`,
    ];

    if (values.billingTripType === "KM Based") {
      lines.push(`Total/Billing KM: ${money(billingKm)}`);
      lines.push(`Rate Per KM: x ₹ ${money(values.ratePerKm)}/km`);
    } else if (hasAmount(baseFare)) {
      lines.push(`${fixedBillingLabel}: ₹ ${money(baseFare)}`);
    }

    if (hasAmount(tollTax)) lines.push(`Toll Tax: ₹ ${money(tollTax)}`);
    if (hasAmount(driverAllowance))
      lines.push(`Driver Night: ₹ ${money(driverAllowance)}`);
    if (hasAmount(parking)) lines.push(`Parking: ₹ ${money(parking)}`);
    if (hasAmount(otherRecoverableCharges))
      lines.push(`Other Charges: ₹ ${money(otherRecoverableCharges)}`);
    lines.push(`Total Bill Amount: ₹ ${money(totalBillAmount)}`);

    window.open(
      `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <form
      id="close-booking-form"
      className="space-y-5"
      onSubmit={handleSubmit(closeBooking)}
    >
      {loadError && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {loadError}
        </div>
      )}
      <CollapsibleSection
        title="Booking Summary"
        collapsed={isSummaryCollapsed}
        onToggle={() => setIsSummaryCollapsed((currentValue) => !currentValue)}
      >
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
          <ReadOnlyField label="Driver" value={booking.driver} />
          <ReadOnlyField
            label="Assignment Source"
            value={isVendorVehicle ? "Vendor Vehicle" : "Own Vehicle"}
          />
          {isVendorVehicle && (
            <ReadOnlyField label="Vendor" value={booking.vendor} />
          )}
          <ReadOnlyField
            label="Trip Type"
            value={
              booking.trip_type?.replace("_", " ") ||
              booking.booking_type?.replace("_", " ")
            }
          />
          <ReadOnlyField
            label="Duty Package"
            value={
              booking.dutyPackageLabel ||
              booking.duty_package?.replaceAll("_", " ")
            }
          />
          <ReadOnlyField
            label="Included KM"
            value={
              booking.includedKm ||
              (booking.dailyMinimumKm ? `${booking.dailyMinimumKm} / day` : "-")
            }
          />
          <ReadOnlyField
            label="Service City"
            value={booking.serviceCity || "-"}
          />
          <ReadOnlyField
            label="Travelling From"
            value={booking.travellingFrom}
          />
          <ReadOnlyField
            label="Travelling To"
            value={booking.travellingTo || booking.routeStops}
          />
          <ReadOnlyField
            label="Pickup / Reporting Address"
            value={booking.pickupReportingAddress}
          />
          <ReadOnlyField
            label="Start Date"
            value={booking.startDate || booking.pickupDate}
          />
          <ReadOnlyField
            label="End Date"
            value={booking.endDate || booking.startDate || booking.pickupDate}
          />
        </div>
      </CollapsibleSection>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Section title="Trip Running Details">
            <div className="grid gap-4 md:grid-cols-3">
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Trip Type
                </span>
                <select className={fieldClass} {...register("billingTripType")}>
                  <option>KM Based</option>
                  <option>Package Based</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Start KM
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  {...register("startKm")}
                />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  End KM
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  {...register("endKm")}
                />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Actual Running KM
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  value={actualRunningKm || ""}
                  readOnly
                />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Minimum Billing KM
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  value={minimumKm || ""}
                  readOnly
                />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Rate Per KM
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  disabled={values.billingTripType !== "KM Based"}
                  {...register("ratePerKm")}
                />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Package Amount
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  disabled={values.billingTripType !== "Package Based"}
                  {...register("packageAmount")}
                />
              </label>
            </div>
          </Section>

          <Section title="Recoverable Charges">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Toll Tax
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  {...register("tollTax")}
                />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Parking
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  {...register("parking")}
                />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Driver Allowance / Night
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  {...register("driverAllowance")}
                />
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Other Recoverable Charges
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  {...register("otherRecoverableCharges")}
                />
              </label>
            </div>
          </Section>

          {!isVendorVehicle && (
            <Section title="Vehicle Profit Inputs">
              <div className="grid gap-4 md:grid-cols-3">
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Diesel Cost
                  </span>
                  <input
                    className={fieldClass}
                    type="number"
                    step="0.01"
                    {...register("dieselCost")}
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Direct Vehicle Expense
                  </span>
                  <input
                    className={fieldClass}
                    type="number"
                    step="0.01"
                    {...register("directVehicleExpense")}
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Driver Cost
                  </span>
                  <input
                    className={fieldClass}
                    type="number"
                    step="0.01"
                    {...register("driverCost")}
                  />
                </label>
              </div>
            </Section>
          )}

          {isVendorVehicle && (
            <Section title="Vendor Cost Inputs">
              <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
                Toll, parking and driver allowance are automatically added to
                the vendor payable as pass-through charges.
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Vendor Payable Amount
                  </span>
                  <input
                    className={fieldClass}
                    type="number"
                    step="0.01"
                    {...register("vendorPayableAmount")}
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Vendor Extra Charges
                  </span>
                  <input
                    className={fieldClass}
                    type="number"
                    step="0.01"
                    {...register("vendorExtraCharges")}
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Vendor Deduction
                  </span>
                  <input
                    className={fieldClass}
                    type="number"
                    step="0.01"
                    {...register("vendorDeduction")}
                  />
                </label>
              </div>
            </Section>
          )}

          <Section title="Closing Notes">
            <div>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Remarks
                </span>
                <textarea
                  className={`${fieldClass} min-h-28 resize-y`}
                  {...register("remarks", {
                    maxLength: {
                      value: 500,
                      message: "Remarks must be 500 characters or less",
                    },
                  })}
                />
                {errors.remarks && (
                  <p className="mt-1 text-xs font-medium text-rose-600">
                    {errors.remarks.message}
                  </p>
                )}
              </label>
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Customer Billing Summary">
            <div className="rounded-xl border border-amber-300 bg-[#fff8df] p-4 shadow-inner">
              <div className="mb-3 flex items-start justify-between gap-3 border-b-2 border-amber-400 pb-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                    Rough Billing Note
                  </p>
                  <p className="text-sm font-extrabold text-slate-950">
                    {booking.id}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                  onClick={shareBillingSummary}
                >
                  <Share2 size={14} />
                  WhatsApp
                </button>
              </div>

              {values.billingTripType === "KM Based" && (
                <>
                  <BillingPaperRow
                    label="Total / Billing KM"
                    value={`${money(billingKm)} KM`}
                  />
                  <BillingPaperRow
                    label="Rate Per KM"
                    value={`x ₹ ${money(values.ratePerKm)}/km`}
                  />
                </>
              )}
              {values.billingTripType !== "KM Based" && hasAmount(baseFare) && (
                <BillingPaperRow
                  label={fixedBillingLabel}
                  value={`₹ ${money(baseFare)}`}
                />
              )}
              {hasAmount(tollTax) && (
                <BillingPaperRow
                  label="Toll Tax"
                  value={`₹ ${money(tollTax)}`}
                />
              )}
              {hasAmount(driverAllowance) && (
                <BillingPaperRow
                  label="Driver Night"
                  value={`₹ ${money(driverAllowance)}`}
                />
              )}
              {hasAmount(parking) && (
                <BillingPaperRow
                  label="Parking"
                  value={`₹ ${money(parking)}`}
                />
              )}
              {hasAmount(otherRecoverableCharges) && (
                <BillingPaperRow
                  label="Other Recoverable Charges"
                  value={`₹ ${money(otherRecoverableCharges)}`}
                />
              )}
              <div className="mt-3 rounded-lg border-2 border-slate-900 bg-white/70 px-3 py-2">
                <BillingPaperRow
                  label="Total Bill Amount"
                  value={`₹ ${money(totalBillAmount)}`}
                  strong
                />
              </div>
            </div>
          </Section>

          <Section title="Payment at Closing">
            <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-600">
                Payment Status
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  paymentStatus === "Paid"
                    ? "bg-emerald-100 text-emerald-700"
                    : paymentStatus === "Partially Paid"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-rose-100 text-rose-700"
                }`}
              >
                {paymentStatus}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Received Amount
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  min="0"
                  max={totalBillAmount}
                  step="0.01"
                  {...register("paymentAmount", {
                    min: { value: 0, message: "Amount cannot be negative" },
                    max: {
                      value: totalBillAmount,
                      message: "Amount cannot exceed the final bill",
                    },
                  })}
                />
                {errors.paymentAmount && (
                  <p className="mt-1 text-xs font-medium text-rose-600">
                    {errors.paymentAmount.message}
                  </p>
                )}
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Payment Mode
                </span>
                <select
                  className={fieldClass}
                  disabled={!hasAmount(receivedAmount)}
                  {...register("paymentMode", {
                    required: hasAmount(receivedAmount)
                      ? "Payment mode is required"
                      : false,
                  })}
                >
                  <option value="">Select payment mode</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Card</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
                {errors.paymentMode && (
                  <p className="mt-1 text-xs font-medium text-rose-600">
                    {errors.paymentMode.message}
                  </p>
                )}
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Payment Date
                </span>
                <input
                  className={fieldClass}
                  type="date"
                  disabled={!hasAmount(receivedAmount)}
                  {...register("paymentDate", {
                    required: hasAmount(receivedAmount)
                      ? "Payment date is required"
                      : false,
                  })}
                />
                {errors.paymentDate && (
                  <p className="mt-1 text-xs font-medium text-rose-600">
                    {errors.paymentDate.message}
                  </p>
                )}
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Reference Number
                </span>
                <input
                  className={fieldClass}
                  disabled={!hasAmount(receivedAmount)}
                  placeholder="UPI, bank, card or cheque reference"
                  {...register("paymentReference")}
                />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Collected By
                </span>
                <input
                  className={fieldClass}
                  disabled={!hasAmount(receivedAmount)}
                  placeholder="Name of the person who received payment"
                  {...register("collectedBy", {
                    required: hasAmount(receivedAmount)
                      ? "Collector name is required"
                      : false,
                  })}
                />
                {errors.collectedBy && (
                  <p className="mt-1 text-xs font-medium text-rose-600">
                    {errors.collectedBy.message}
                  </p>
                )}
              </label>
            </div>
            {hasAmount(receivedAmount) && (
              <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Received now</span>
                  <span>₹ {money(receivedAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>Balance outstanding</span>
                  <span>
                    ₹ {money(Math.max(0, totalBillAmount - receivedAmount))}
                  </span>
                </div>
              </div>
            )}
          </Section>

          {!isVendorVehicle && (
            <Section title="Vehicle Profit Calculation">
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Recoverable charges are customer pass-throughs and are not
                included in vehicle profit.
              </div>
              <div className="mt-3">
                <SummaryItem label="Vehicle Revenue" value={vehicleRevenue} />
                <SummaryItem
                  label="Diesel Cost"
                  value={toNumber(values.dieselCost)}
                />
                <SummaryItem
                  label="Direct Vehicle Expense"
                  value={toNumber(values.directVehicleExpense)}
                />
                <SummaryItem
                  label="Driver Cost"
                  value={toNumber(values.driverCost)}
                />
                <SummaryItem
                  label="Net Vehicle Profit"
                  value={netVehicleProfit}
                  strong
                  tone="profit"
                />
              </div>
            </Section>
          )}

          {isVendorVehicle && (
            <Section title="Vendor Booking Profit">
              <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
                This margin is earned from vendor-hired booking and is not mixed
                with own vehicle profit.
              </div>
              <div className="mt-3">
                <SummaryItem
                  label="Customer Revenue for Vendor Settlement"
                  value={vendorBookingRevenue}
                />
                <SummaryItem
                  label="Vendor Payable Amount"
                  value={toNumber(values.vendorPayableAmount)}
                />
                <SummaryItem
                  label="Toll + Parking + Driver Allowance"
                  value={vendorRecoverableCharges}
                />
                <SummaryItem
                  label="Vendor Extra Charges"
                  value={toNumber(values.vendorExtraCharges)}
                />
                <SummaryItem
                  label="Vendor Deduction"
                  value={toNumber(values.vendorDeduction)}
                />
                <SummaryItem
                  label="Final Vendor Payable"
                  value={finalVendorPayable}
                />
                <SummaryItem
                  label="Vendor Booking Profit"
                  value={vendorBookingProfit}
                  strong
                  tone="profit"
                />
              </div>
            </Section>
          )}
        </div>
      </div>
    </form>
  );
}

export default CloseBookingPage;
