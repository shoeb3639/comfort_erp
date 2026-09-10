function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function tripDates(startValue, endValue) {
  const start = new Date(`${String(startValue).slice(0, 10)}T00:00:00`);
  const end = new Date(
    `${String(endValue || startValue).slice(0, 10)}T00:00:00`,
  );
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return [formatDate(startValue)];
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 31) {
    dates.push(formatDate(cursor.toISOString().slice(0, 10)));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function text(document, value, x, y, options = {}) {
  document.text(String(value || "-"), x, y, {
    maxWidth: options.maxWidth,
    align: options.align,
  });
}

function detailRow(document, y, leftLabel, leftValue, rightLabel, rightValue) {
  const x = 15;
  const width = 180;
  const height = 11;
  const middle = 102;
  document.rect(x, y, width, height);
  document.line(48, y, 48, y + height);
  document.line(middle, y, middle, y + height);
  document.line(131, y, 131, y + height);
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  text(document, leftLabel, x + 2, y + 7);
  text(document, leftValue, 50, y + 7, { maxWidth: 50 });
  text(document, rightLabel, middle + 2, y + 7);
  text(document, rightValue, 133, y + 7, { maxWidth: 60 });
}

function logTable(document, dates, startY) {
  const x = 15;
  const widths = [26, 27, 25, 27, 25, 26, 24];
  const headings = [
    "Date",
    "Start Time",
    "Start Km",
    "End Time",
    "End Km",
    "Total Km",
    "Signature",
  ];
  const rowHeight = 10;
  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  text(document, "Log Sheet", 105, startY - 5, { align: "center" });
  let cursorX = x;
  headings.forEach((heading, index) => {
    document.rect(cursorX, startY, widths[index], rowHeight);
    document.setFontSize(8.5);
    text(document, heading, cursorX + widths[index] / 2, startY + 6.5, {
      align: "center",
    });
    cursorX += widths[index];
  });
  document.setFont("helvetica", "normal");
  dates.forEach((date, rowIndex) => {
    const y = startY + rowHeight * (rowIndex + 1);
    cursorX = x;
    widths.forEach((width, columnIndex) => {
      document.rect(cursorX, y, width, rowHeight);
      if (columnIndex === 0) text(document, date, cursorX + 2, y + 6.5);
      cursorX += width;
    });
  });
}

export async function createDutySlipPdf(booking, profile) {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await optionalImageDataUrl(profile.logoUrl);
  const companyName = profile.tradeName || profile.legalName || "Company";
  const contact = [profile.mobile, profile.alternateNumber]
    .filter(Boolean)
    .join(", ");
  const startDate = booking.startDate || booking.pickupDate;
  const endDate = booking.endDate || startDate;
  const guestName = booking.travellerName || booking.customer;
  const guestContact = booking.customerPhone || "";
  const vehicle =
    booking.vehicleRegistrationNo || booking.requestedVehicleType || "-";
  const driver = [booking.driver, booking.driverNumber]
    .filter((value) => value && value !== "Unassigned")
    .join("  ");
  const reporting = [
    booking.pickupReportingAddress,
    booking.pickupTime || booking.reportingTime,
  ]
    .filter(Boolean)
    .join(" ");
  const routing =
    [booking.travellingFrom, booking.travellingTo]
      .filter(Boolean)
      .join(" to ") ||
    booking.routeStops ||
    booking.serviceCity;

  document.setDrawColor(15, 23, 42);
  document.setLineWidth(0.35);
  document.rect(15, 15, 180, 24);
  document.line(102, 15, 102, 39);
  document.line(102, 27, 195, 27);
  if (logo) document.addImage(logo, 17, 17, 28, 18, undefined, "FAST");
  const companyTextX = logo ? 48 : 17;
  const companyTextWidth = logo ? 51 : 82;
  document.setFont("helvetica", "bold");
  document.setFontSize(20);
  text(document, companyName.toUpperCase(), companyTextX, 24, {
    maxWidth: companyTextWidth,
  });
  document.setFontSize(14);
  text(document, "DUTY SLIP", companyTextX, 31);
  document.setFont("helvetica", "normal");
  document.setFontSize(8.5);
  text(document, contact, companyTextX, 36, { maxWidth: companyTextWidth });
  document.setFontSize(10);
  text(document, `Sr. No : DS-${booking.id}`, 105, 23, { maxWidth: 87 });
  text(document, `Booking Id : ${booking.id}`, 105, 35, { maxWidth: 87 });

  detailRow(
    document,
    39,
    "Start Date",
    formatDate(startDate),
    "End Date",
    formatDate(endDate),
  );
  detailRow(document, 50, "Vehicle Details", vehicle, "Driver Name", driver);
  detailRow(
    document,
    61,
    "Guest Name",
    guestName,
    "Guest Contact",
    guestContact,
  );

  document.rect(15, 72, 180, 14);
  document.line(48, 72, 48, 86);
  document.setFontSize(10);
  text(document, "Reporting", 17, 77);
  text(document, "Add. & Time", 17, 82);
  text(document, reporting, 50, 80, { maxWidth: 142 });

  document.rect(15, 86, 180, 20);
  document.line(48, 86, 48, 106);
  text(document, "Routing", 17, 98);
  text(document, routing, 50, 98, { maxWidth: 142 });

  logTable(document, tripDates(startDate, endDate), 124);
  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  text(document, "Thank You", 105, 278, { align: "center" });
  return document;
}

export function dutySlipFileName(booking) {
  return `Duty-Slip-${booking.id}.pdf`;
}
async function optionalImageDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
