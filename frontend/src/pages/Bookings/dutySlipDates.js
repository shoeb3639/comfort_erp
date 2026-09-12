function calendarDate(value) {
  const key = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== key)
    return null;
  return date;
}

export function formatDutySlipDate(value) {
  const date = calendarDate(value);
  if (!date) return "-";
  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return `${day}/${month}/${year.slice(-2)}`;
}

export function dutySlipDates(startValue, endValue) {
  const start = calendarDate(startValue);
  const end = calendarDate(endValue || startValue);
  if (!start || !end || end < start) return [];
  const dates = [];
  // Preserve the existing log sheet limit while keeping arithmetic in UTC.
  while (start <= end && dates.length < 31) {
    dates.push(formatDutySlipDate(start.toISOString()));
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return dates;
}
