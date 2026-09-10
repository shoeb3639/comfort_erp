import { AppError } from '../../shared/errors/app-error'
export function localPackageBilling(input: {
  bookingPackage: string | null
  startDate: string
  openingTime: string
  closingDate?: string | undefined
  closingTime?: string | undefined
  actualKm: number
  packageBased: boolean
  extraKmRate?: number | undefined
  extraHourRate?: number | undefined
}) {
  const fail = (message: string): never => {
    throw new AppError(message, 'INVALID_LOCAL_CLOSING', 400)
  }
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  if (!input.closingDate || !input.closingTime)
    fail('Closing date and time are required for local bookings')
  if (
    !validDate(input.startDate) ||
    !validDate(input.closingDate!) ||
    !validTime(input.openingTime) ||
    !validTime(input.closingTime!)
  )
    fail('Enter valid opening and closing dates and times')
  const totalMinutes =
    (Date.parse(`${input.closingDate}T${input.closingTime}:00Z`) -
      Date.parse(`${input.startDate}T${input.openingTime}:00Z`)) /
    60000
  if (totalMinutes < 0) fail('Closing time cannot be before the trip start')
  const match = /^local_(\d+)_(\d+)$/.exec(input.bookingPackage ?? '')
  const includedHours = match ? Number(match[1]) : null
  const includedKm = match ? Number(match[2]) : null
  const extraKm =
    includedKm === null
      ? 0
      : Math.max(0, Math.round((input.actualKm - includedKm) * 100) / 100)
  const extraMinutes =
    includedHours === null ? 0 : Math.max(0, totalMinutes - includedHours * 60)
  if (extraKm > 0 && input.packageBased && input.extraKmRate === undefined)
    fail('Enter the extra kilometre rate (or 0 to waive it)')
  if (extraMinutes > 0 && input.extraHourRate === undefined)
    fail('Enter the extra hour rate (or 0 to waive it)')
  for (const rate of [input.extraKmRate, input.extraHourRate])
    if (rate !== undefined && (!Number.isFinite(rate) || rate < 0))
      fail('Extra rates cannot be negative')
  const extraKmRate = input.packageBased ? (input.extraKmRate ?? 0) : 0
  const extraHourRate = input.extraHourRate ?? 0
  return {
    startDate: input.startDate,
    openingTime: input.openingTime,
    closingDate: input.closingDate!,
    closingTime: input.closingTime!,
    includedHours,
    includedKm,
    totalMinutes,
    extraMinutes,
    extraKm,
    extraHours: Math.round((extraMinutes / 60) * 10000) / 10000,
    extraKmRate,
    extraHourRate,
    extraKmCharge: Math.round(extraKm * extraKmRate * 100) / 100,
    extraHourCharge:
      Math.round((extraMinutes / 60) * extraHourRate * 100) / 100,
  }
}
