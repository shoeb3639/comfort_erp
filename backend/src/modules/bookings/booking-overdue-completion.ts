import { prisma } from '../../config/prisma'
import { logger } from '../../config/logger'
import { tenantBusinessDate } from '../../shared/date/tenant-business-date'

function startOfBusinessDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

/**
 * Marks duties whose last booked day has passed as completed. Draft and
 * confirmed bookings are deliberately excluded because a duty was not started.
 */
export async function completeOverdueBookings(instant: Date = new Date()) {
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, timeZone: true },
  })

  let completed = 0
  for (const tenant of tenants) {
    const cutoff = startOfBusinessDate(
      tenantBusinessDate(tenant.timeZone, instant),
    )
    const result = await prisma.booking.updateMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        closure: null,
        endDate: { lt: cutoff },
        status: { in: ['ASSIGNED', 'RUNNING'] },
      },
      data: {
        status: 'COMPLETED',
        dutyCompletedAt: instant,
      },
    })
    completed += result.count
  }

  if (completed) logger.info('Overdue bookings marked completed', { completed })
  return completed
}

export function startOverdueBookingCompletion() {
  void completeOverdueBookings().catch((error: unknown) =>
    logger.error('Unable to complete overdue bookings', { error }),
  )
  const timer = setInterval(
    () => {
      void completeOverdueBookings().catch((error: unknown) =>
        logger.error('Unable to complete overdue bookings', { error }),
      )
    },
    60 * 60 * 1000,
  )
  timer.unref()
  return () => clearInterval(timer)
}
