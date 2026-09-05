import type { BookingStatus } from '../../generated/prisma/enums'

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Assigned',
  RUNNING: 'In Transit',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}
