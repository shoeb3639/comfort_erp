import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBooking } from "../../services/bookings";

const readOnlyClass =
  "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800";

function formatLabel(value) {
  return value ? String(value).replaceAll("_", " ") : "-";
}

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function dateTime(value) {
  return value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={readOnlyClass}>
        {value === null || value === undefined || value === "" ? "-" : value}
      </p>
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

function BookingViewPage() {
  const params = useParams();
  const bookingId = params.id || params.bookingId;
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBooking(bookingId)
      .then(setBooking)
      .finally(() => setLoading(false));
  }, [bookingId]);

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
        Booking not found.{" "}
        <Link className="font-semibold text-brand-600" to="/bookings">
          Back to bookings
        </Link>
      </div>
    );
  }

  const invoice = booking.invoice;
  const route = [
    booking.travellingFrom || booking.pickupReportingAddress,
    booking.travellingTo || booking.routeStops,
  ]
    .filter(Boolean)
    .join(" to ");
  const billAmount =
    booking.closeDetails?.totalBillAmount ||
    invoice?.totals?.netPayable ||
    booking.fixedAmount ||
    booking.amount;
  const assignmentType =
    booking.closeDetails?.assignmentType ||
    booking.assignmentType ||
    booking.assignment_type ||
    "own_vehicle";
  const isVendorVehicle = assignmentType === "vendor_vehicle";

  return (
    <div className="space-y-5">
      {booking.vehicleId && booking.driverId && (
        <div className="flex justify-end">
          <Link
            to={`/bookings/${booking.id}/duty-slip`}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Generate Duty Slip
          </Link>
        </div>
      )}
      <Section title="Booking Summary">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyField label="Booking ID" value={booking.id} />
          <ReadOnlyField label="Status" value={booking.status} />
          <ReadOnlyField label="Customer" value={booking.customer} />
          <ReadOnlyField
            label="Traveller"
            value={booking.travellerName || booking.customer}
          />
          <ReadOnlyField
            label="Trip Type"
            value={formatLabel(booking.trip_type || booking.booking_type)}
          />
          <ReadOnlyField
            label="Duty Package"
            value={formatLabel(booking.duty_package || booking.pricing_basis)}
          />
          <ReadOnlyField
            label="Type of Vehicle"
            value={
              booking.requestedVehicleType || booking.vehicleRequirement || "-"
            }
          />
          <ReadOnlyField
            label="Service City"
            value={booking.serviceCity || "-"}
          />
          <ReadOnlyField
            label="Start Date"
            value={booking.startDate || booking.pickupDate}
          />
          <ReadOnlyField
            label="End Date"
            value={booking.endDate || booking.startDate || booking.pickupDate}
          />
          <ReadOnlyField
            label="Pickup / Reporting Time"
            value={booking.pickupTime || booking.reportingTime || "-"}
          />
          <ReadOnlyField label="Route" value={route} />
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Assignment">
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField
              label="Assignment Source"
              value={isVendorVehicle ? "Vendor Vehicle" : "Own Vehicle"}
            />
            <ReadOnlyField label="Vendor" value={booking.vendor} />
            <ReadOnlyField
              label="Vehicle"
              value={[booking.vehicleType, booking.vehicleRegistrationNo]
                .filter(Boolean)
                .join(" ")}
            />
            <ReadOnlyField label="Driver" value={booking.driver} />
            <ReadOnlyField
              label="Assignment Status"
              value={booking.assignment_status}
            />
            {isVendorVehicle && (
              <ReadOnlyField
                label="Vendor Rate Type"
                value={booking.vendorRateType || "-"}
              />
            )}
            {isVendorVehicle && (
              <ReadOnlyField
                label="Vendor Payable"
                value={`₹ ${money(booking.closeDetails?.finalVendorPayable || booking.vendorPayableAmount)}`}
              />
            )}
          </div>
        </Section>

        <Section title="Billing">
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField
              label="Bill Amount"
              value={`₹ ${money(billAmount)}`}
            />
            <ReadOnlyField
              label="Invoice"
              value={invoice?.invoiceNumber || invoice?.id || "Not generated"}
            />
            <ReadOnlyField
              label="Closing Status"
              value={booking.closeDetails ? "Closed" : "Open"}
            />
          </div>
        </Section>
      </div>

      <Section title="Duty Execution">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyField
            label="Confirmed At"
            value={dateTime(booking.confirmedAt)}
          />
          <ReadOnlyField
            label="Assigned At"
            value={dateTime(booking.assignedAt)}
          />
          <ReadOnlyField
            label="Duty Started At"
            value={dateTime(booking.dutyStartedAt)}
          />
          <ReadOnlyField
            label="Duty Completed At"
            value={dateTime(booking.dutyCompletedAt)}
          />
          <ReadOnlyField
            label="Opening Odometer"
            value={booking.openingOdometer}
          />
          <ReadOnlyField
            label="Closing Odometer"
            value={booking.closingOdometer}
          />
          <ReadOnlyField
            label="Distance Travelled"
            value={
              booking.actualDistance === null
                ? "-"
                : `${booking.actualDistance} KM`
            }
          />
          <ReadOnlyField
            label="Cancellation"
            value={
              booking.cancellationReason
                ? `${booking.cancellationReason} — ${dateTime(booking.cancelledAt)}`
                : "-"
            }
          />
        </div>
        {(booking.dutyStartRemarks || booking.dutyCompletionRemarks) && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ReadOnlyField
              label="Start Remarks"
              value={booking.dutyStartRemarks}
            />
            <ReadOnlyField
              label="Completion Remarks"
              value={booking.dutyCompletionRemarks}
            />
          </div>
        )}
      </Section>

      <Section title="Notes">
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {booking.closeDetails?.remarks || booking.notes || "No notes added."}
        </p>
      </Section>
    </div>
  );
}

export default BookingViewPage;
