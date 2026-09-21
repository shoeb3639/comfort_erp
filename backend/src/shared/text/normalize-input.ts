/**
 * Normalizes validated request data before it reaches a service or repository.
 *
 * This is deliberately conservative. Case-sensitive credentials and tokens are
 * never changed, and names/business text are not forced to a particular case.
 * Individual services can still apply presentation rules such as title case.
 */
const protectedKeys = new Set([
  'password',
  'refreshToken',
  'accessToken',
  'token',
  'secret',
  'signature',
  'hash',
])

const compactPhoneKeys = new Set([
  'phone',
  'mobile',
  'alternateMobile',
  'alternateNumber',
  'whatsappNumber',
  'billingMobile',
])

const upperCaseKeys = new Set([
  'gstin',
  'pan',
  'ifscCode',
  'stateCode',
  'licenceNumber',
  'license',
  'registrationNumber',
  'plate',
])

function normalizeString(value: string, key?: string): string {
  if (key && protectedKeys.has(key)) return value

  const trimmed = value.trim()
  if (key && compactPhoneKeys.has(key)) {
    return trimmed.replace(/[\s()\-]/g, '')
  }
  if (key === 'email' || key === 'billingEmail') return trimmed.toLowerCase()
  if (key && upperCaseKeys.has(key)) return trimmed.toUpperCase()
  return trimmed
}

export function normalizeValidatedInput<T>(value: T, key?: string): T {
  if (typeof value === 'string') return normalizeString(value, key) as T
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValidatedInput(item)) as T
  }
  if (!value || typeof value !== 'object' || value instanceof Date) return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(
      ([entryKey, entry]) => [
        entryKey,
        normalizeValidatedInput(entry, entryKey),
      ],
    ),
  ) as T
}
