import type { Salutation } from '../../generated/prisma/client'

export function mapDriver<
  T extends { name: string; salutation: Salutation | null },
>(driver: T) {
  return {
    ...driver,
    displayName: `${driver.salutation === 'MR' ? 'Mr. ' : driver.salutation === 'MS' ? 'Ms. ' : ''}${driver.name}`,
  }
}
