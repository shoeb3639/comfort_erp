export function formatBookingNumber(bookingDate: string, sequence: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bookingDate)
  if (!match || !Number.isSafeInteger(sequence) || sequence < 1)
    throw new Error('Invalid booking-number components')
  return `${match[1]!.slice(-2)}-${match[2]}${match[3]}${String(sequence).padStart(3, '0')}`
}

export function bookingDateValue(bookingDate: string) {
  return new Date(`${bookingDate}T00:00:00.000Z`)
}
