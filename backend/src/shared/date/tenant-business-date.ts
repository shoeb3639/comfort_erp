import { AppError } from '../errors/app-error'

export function tenantBusinessDate(
  timeZone: string,
  instant: Date = new Date(),
) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(instant)
    const value = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    )
    return `${value.year}-${value.month}-${value.day}`
  } catch {
    throw new AppError(
      'Tenant timezone configuration is invalid',
      'INVALID_TENANT_TIMEZONE',
      500,
    )
  }
}
