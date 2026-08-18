import { Prisma } from '../../generated/prisma/client'
import { AppError } from '../../shared/errors/app-error'

export function mapCompanySetupConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new AppError(
      'A record with the same unique value already exists',
      'CONFLICT',
      409,
    )
  }
  throw error
}
