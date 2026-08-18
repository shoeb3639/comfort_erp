import { useEffect, useState } from "react";
import { Download, MessageCircle, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getBooking } from "../../services/bookings";
import { getCompanyProfile } from "../../services/tenantSetup";
import { createDutySlipPdf, dutySlipFileName } from "./dutySlipPdf";

function date(value) {
  if (!value) return "-";
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(
    "en-IN",
    { day: "2-digit", month: "2-digit", year: "2-digit" },
  );
}

function datesBetween(startValue, endValue) {
  const start = new Date(`${String(startValue).slice(0, 10)}T00:00:00`);
  const end = new Date(
    `${String(endValue || startValue).slice(0, 10)}T00:00:00`,
  );
  const values = [];
  while (start <= end && values.length < 31) {
    values.push(date(start.toISOString().slice(0, 10)));
    start.setDate(start.getDate() + 1);
  }
  return values;
}

export default function DutySlipPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([getBooking(id), getCompanyProfile()])
      .then(([booking, profile]) => {
        if (!booking.vehicleId || !booking.driverId) {
          setError(
            "Assign both a vehicle and driver before generating the duty slip.",
          );
          return;
        }
        setData({ booking, profile });
      })
      .catch((requestError) =>
        setError(
          requestError.response?.data?.message ||
            "Unable to generate the duty slip.",
        ),
      );
  }, [id]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <p className="font-semibold">Duty slip unavailable</p>
        <p className="mt-1">{error}</p>
        <Link
          className="mt-4 inline-block font-semibold underline"
          to={`/bookings/${id}`}
        >
          Back to booking
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Generating duty slip…
      </div>
    );
  }

  const { booking, profile } = data;
  const startDate = booking.startDate || booking.pickupDate;
  const endDate = booking.endDate || startDate;
  const tripDates = datesBetween(startDate, endDate);
  const companyName = profile.tradeName || profile.legalName;
  const vehicle =
    booking.vehicleRegistrationNo || booking.requestedVehicleType || "-";
  const driver = [booking.driver, booking.driverNumber]
    .filter((value) => value && value !== "Unassigned")
    .join(" · ");
  const reporting = [
    booking.pickupReportingAddress,
    booking.pickupTime || booking.reportingTime,
  ]
    .filter(Boolean)
    .join(" · ");
  const routing =
    [booking.travellingFrom, booking.travellingTo]
      .filter(Boolean)
      .join(" → ") ||
    booking.routeStops ||
    booking.serviceCity;

  async function download() {
    const document = await createDutySlipPdf(booking, profile);
    document.save(dutySlipFileName(booking));
    setNotice("Duty slip downloaded.");
  }

  async function share() {
    const document = await createDutySlipPdf(booking, profile);
    const file = new File(
      [document.output("blob")],
      dutySlipFileName(booking),
      {
        type: "application/pdf",
      },
    );
    const shareData = {
      title: `Duty Slip ${booking.id}`,
      text: `Duty slip for booking ${booking.id}`,
      files: [file],
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        setNotice("Duty slip shared.");
        return;
      } catch (shareError) {
        if (shareError.name === "AbortError") return;
      }
    }
    document.save(dutySlipFileName(booking));
    const message = encodeURIComponent(
      `Duty slip for booking ${booking.id}. The PDF has been downloaded; please attach it in WhatsApp.`,
    );
    window.open(
      `https://wa.me/?text=${message}`,
      "_blank",
      "noopener,noreferrer",
    );
    setNotice("PDF downloaded. Attach it in the opened WhatsApp conversation.");
  }

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          body * {
            visibility: hidden;
          }

          .duty-slip-page,
          .duty-slip-page * {
            visibility: visible;
          }

          .duty-slip-page {
            position: absolute;
            left: 0;
            top: 0;
            width: auto !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 4mm !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      {notice && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 print:hidden">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <Download size={17} /> Download PDF
        </button>
        <button
          type="button"
          onClick={share}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <MessageCircle size={17} /> Share on WhatsApp
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
        >
          <Printer size={17} /> Print
        </button>
      </div>

      <article className="duty-slip-page mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-8 text-slate-950 shadow-sm">
        <div className="grid grid-cols-[3fr_2.5fr] border border-slate-950">
          <div className="border-r border-slate-950 px-2 py-1.5">
            <h1 className="text-3xl font-black tracking-wide">
              {companyName?.toUpperCase()}
            </h1>
            <h2 className="text-xl font-bold">DUTY SLIP</h2>
            <p className="mt-2 text-sm font-semibold">
              {[profile.mobile, profile.alternateNumber]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          <div className="grid grid-rows-2">
            <p className="flex items-center border-b border-slate-950 px-2 py-1.5">
              Sr. No: DS-{booking.id}
            </p>
            <p className="flex items-center px-2 py-1.5">
              Booking ID: {booking.id}
            </p>
          </div>
        </div>
        {[
          ["Start Date", date(startDate), "End Date", date(endDate)],
          ["Vehicle Details", vehicle, "Driver Name", driver || "-"],
          [
            "Guest Name",
            booking.travellerName || booking.customer,
            "Guest Contact",
            booking.customerPhone || "-",
          ],
        ].map((row) => (
          <div
            key={row[0]}
            className="grid grid-cols-[1fr_2fr_1fr_1.5fr] border-x border-b border-slate-950"
          >
            {row.map((value, index) => (
              <p
                key={`${row[0]}-${index}`}
                className={`px-2 py-1.5 ${index < 3 ? "border-r border-slate-950" : ""}`}
              >
                {value}
              </p>
            ))}
          </div>
        ))}
        <div className="grid grid-cols-[1fr_4.5fr] border-x border-b border-slate-950">
          <p className="border-r border-slate-950 px-2 py-1.5">
            Reporting Add. & Time
          </p>
          <p className="px-2 py-1.5">{reporting}</p>
        </div>
        <div className="grid min-h-16 grid-cols-[1fr_4.5fr] border-x border-b border-slate-950">
          <p className="border-r border-slate-950 px-2 py-1">Routing</p>
          <p className="px-2 py-1">{routing}</p>
        </div>
        <h3 className="my-6 text-center text-lg font-bold">Log Sheet</h3>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {[
                "Date",
                "Start Time",
                "Start Km",
                "End Time",
                "End Km",
                "Total Km",
                "Signature",
              ].map((heading) => (
                <th key={heading} className="border border-slate-950 p-2">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tripDates.map((tripDate, index) => (
              <tr key={`${tripDate}-${index}`}>
                <td className="border border-slate-950 p-2">{tripDate}</td>
                <td className="border border-slate-950 p-2">
                  {index === 0 ? booking.pickupTime || "" : ""}
                </td>
                {[0, 1, 2, 3, 4].map((column) => (
                  <td
                    key={column}
                    className="h-10 border border-slate-950 p-2"
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-16 text-center font-bold">Thank You</p>
      </article>
    </div>
  );
}
