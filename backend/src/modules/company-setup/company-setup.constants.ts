export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/

export const GST_REGISTRATION_TYPES_REQUIRING_GSTIN = new Set([
  'Regular',
  'Composition',
])
