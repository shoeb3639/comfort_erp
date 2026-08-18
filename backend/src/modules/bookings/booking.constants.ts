import { basename, join, resolve } from 'node:path'
import type { BookingStatus } from '../../generated/prisma/enums'
import type { DutyEvidence, DutyEvidenceType } from './booking.types'

export const DUTY_EVIDENCE_FIELDS: Record<
  DutyEvidenceType,
  keyof DutyEvidence
> = {
  'opening-meter': 'openingMeter',
  'closing-meter': 'closingMeter',
  'duty-slip': 'dutySlip',
  'toll-parking': 'tollParkingReceipts',
}

export const DUTY_EVIDENCE_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const backendRoot =
  basename(process.cwd()) === 'backend'
    ? process.cwd()
    : join(process.cwd(), 'backend')

export const DUTY_EVIDENCE_ROOT = resolve(
  backendRoot,
  '.local',
  'uploads',
  'duty-evidence',
)

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Assigned',
  RUNNING: 'In Transit',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}
