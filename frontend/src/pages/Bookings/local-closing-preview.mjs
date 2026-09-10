export function localClosingPreview(booking, values) {
  const match = /^local_(\d+)_(\d+)$/.exec(
    booking?.duty_package || booking?.bookingPackage || "",
  );
  const includedHours = match
    ? Number(match[1])
    : (booking?.includedHours ?? null);
  const includedKm = match ? Number(match[2]) : (booking?.includedKm ?? null);
  const timestamp = (date, time) => {
    const day = String(date || "").slice(0, 10);
    const clock = String(time || "");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(clock)
    )
      return NaN;
    return Date.parse(`${day}T${clock.slice(0, 5)}:00Z`);
  };
  const elapsedMinutes =
    (timestamp(values.closingDate, values.closingTime) -
      timestamp(
        booking?.startDate || booking?.pickupDate,
        values.openingTime,
      )) /
    60000;
  const complete = Number.isFinite(elapsedMinutes);
  const totalMinutes = complete ? Math.max(0, elapsedMinutes) : 0;
  const extraMinutes =
    includedHours == null
      ? 0
      : Math.max(0, totalMinutes - Number(includedHours) * 60);
  return {
    includedHours,
    includedKm,
    elapsedMinutes,
    totalMinutes,
    extraMinutes,
    complete,
  };
}

export function overnightClosingDate(
  startDate,
  closingDate,
  openingTime,
  closingTime,
) {
  if (
    closingDate === startDate &&
    openingTime &&
    closingTime &&
    closingTime < openingTime
  ) {
    return new Date(Date.parse(`${startDate}T00:00:00Z`) + 86400000)
      .toISOString()
      .slice(0, 10);
  }
  return closingDate;
}
