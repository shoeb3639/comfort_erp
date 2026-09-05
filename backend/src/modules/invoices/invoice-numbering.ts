export function getFinancialYear(invoiceDate: Date): string {
  const startYear =
    invoiceDate.getUTCMonth() >= 3
      ? invoiceDate.getUTCFullYear()
      : invoiceDate.getUTCFullYear() - 1
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`
}

export function formatInvoiceNumber(
  prefix: string,
  financialYear: string,
  sequence: number,
  configuredLength: number,
): string {
  const width = Math.max(4, configuredLength)
  return `${prefix}/${financialYear}/${String(sequence).padStart(width, '0')}`
}
