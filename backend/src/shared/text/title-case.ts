/**
 * Normalizes human-readable database text. Identifiers such as emails, GSTINs,
 * phone numbers, codes, passwords and URLs must not be passed here.
 */
export function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-IN')
    .replace(/(^|[\s\-'/([{])(\p{L})/gu, (_match, boundary, letter) => {
      return `${boundary}${String(letter).toLocaleUpperCase('en-IN')}`
    })
}

export function titleCaseOptional<T extends string | null | undefined>(
  value: T,
): T {
  return (typeof value === 'string' ? toTitleCase(value) : value) as T
}
