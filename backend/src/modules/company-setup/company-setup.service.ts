import { Prisma } from '../../generated/prisma/client'
import { AppError } from '../../shared/errors/app-error'
import { hashPassword } from '../../shared/security/password'
import {
  GST_REGISTRATION_TYPES_REQUIRING_GSTIN,
  GSTIN_PATTERN,
} from './company-setup.constants'
import { mapCompanySetupConflict } from './company-setup.mapper'
import * as repository from './company-setup.repository'
import type {
  BankAccountInput,
  CompanyProfileInput,
  GstRegistrationInput,
  InvoiceSettingsInput,
  LocationInput,
  RoleInput,
  SetupContext,
  TaxSettingsInput,
  TenantUserInput,
} from './company-setup.types'

async function validateLocationIds(tenantId: string, ids: string[]) {
  if (ids.length === 0) return
  const records = await repository.findLocations(tenantId, ids)
  if (records.length !== ids.length) {
    throw new AppError(
      'One or more locations do not belong to this tenant',
      'VALIDATION_ERROR',
      400,
    )
  }
}

async function validatePermissionIds(ids: string[]) {
  if (ids.length === 0) return
  const records = await repository.findPermissions(ids)
  if (records.length !== ids.length) {
    throw new AppError(
      'One or more permissions were not found',
      'VALIDATION_ERROR',
      400,
    )
  }
}

export async function getCompanyProfile(context: SetupContext) {
  const tenant = await repository.getCompanyProfile(context.tenantId)
  if (!tenant) throw new AppError('Tenant was not found', 'NOT_FOUND', 404)
  return tenant
}

export async function updateCompanyProfile(
  context: SetupContext,
  input: CompanyProfileInput,
) {
  const { billingAddress, ...profile } = input
  const data: Prisma.TenantUncheckedUpdateInput = {
    ...profile,
    ...(billingAddress !== undefined
      ? {
          billingAddress:
            billingAddress === null
              ? Prisma.JsonNull
              : (billingAddress as Prisma.InputJsonValue),
        }
      : {}),
  }
  try {
    return await repository.updateTenantSettings(
      context.tenantId,
      data,
      context.userId,
      'COMPANY_PROFILE',
      'COMPANY_PROFILE',
    )
  } catch (error) {
    return mapCompanySetupConflict(error)
  }
}

export async function getTaxSettings(context: SetupContext) {
  const tenant = await getCompanyProfile(context)
  return {
    gstin: tenant.gstin,
    pan: tenant.pan,
    companyRegistrationNumber: tenant.companyRegistrationNumber,
    stateCode: tenant.stateCode,
    taxRegistrationType: tenant.taxRegistrationType,
    taxSettings: tenant.taxSettings ?? {},
  }
}

export function updateTaxSettings(
  context: SetupContext,
  input: TaxSettingsInput,
) {
  return repository.updateTenantSettings(
    context.tenantId,
    {
      ...input,
      taxSettings: input.taxSettings as Prisma.InputJsonValue,
    },
    context.userId,
    'TAX_SETTINGS',
    null,
  )
}

export async function getInvoiceSettings(context: SetupContext) {
  const tenant = await getCompanyProfile(context)
  return {
    invoicePrefix: tenant.invoicePrefix,
    invoiceNumberLength: tenant.invoiceNumberLength,
    invoiceSettings: tenant.invoiceSettings ?? {},
  }
}

export function updateInvoiceSettings(
  context: SetupContext,
  input: InvoiceSettingsInput,
) {
  return repository.updateTenantSettings(
    context.tenantId,
    {
      ...input,
      invoiceSettings: input.invoiceSettings as Prisma.InputJsonValue,
    },
    context.userId,
    'INVOICE_SETTINGS',
    'INVOICE_SETTINGS',
  )
}

export function getOnboarding(context: SetupContext) {
  return repository.getOnboarding(context.tenantId)
}

export function listLocations(context: SetupContext) {
  return repository.listLocations(context.tenantId)
}

export async function createLocation(
  context: SetupContext,
  input: Required<Pick<LocationInput, 'name'>> & LocationInput,
) {
  try {
    return await repository.createLocation(
      context.tenantId,
      {
        ...input,
        createdById: context.userId,
        updatedById: context.userId,
      },
      context.userId,
    )
  } catch (error) {
    return mapCompanySetupConflict(error)
  }
}

export async function updateLocation(
  context: SetupContext,
  id: string,
  input: LocationInput,
) {
  try {
    const record = await repository.updateLocation(
      context.tenantId,
      id,
      { ...input, updatedById: context.userId },
      context.userId,
    )
    if (!record) throw new AppError('Location was not found', 'NOT_FOUND', 404)
    return record
  } catch (error) {
    if (error instanceof AppError) throw error
    return mapCompanySetupConflict(error)
  }
}

export function listBankAccounts(context: SetupContext) {
  return repository.listBankAccounts(context.tenantId)
}

export async function createBankAccount(
  context: SetupContext,
  input: Required<
    Pick<
      BankAccountInput,
      'accountName' | 'bankName' | 'accountNumber' | 'ifscCode'
    >
  > &
    BankAccountInput,
) {
  try {
    return await repository.createBankAccount(
      context.tenantId,
      {
        ...input,
        createdById: context.userId,
        updatedById: context.userId,
      },
      context.userId,
    )
  } catch (error) {
    return mapCompanySetupConflict(error)
  }
}

export async function updateBankAccount(
  context: SetupContext,
  id: string,
  input: BankAccountInput,
) {
  try {
    const record = await repository.updateBankAccount(
      context.tenantId,
      id,
      { ...input, updatedById: context.userId },
      context.userId,
    )
    if (!record) {
      throw new AppError('Bank account was not found', 'NOT_FOUND', 404)
    }
    return record
  } catch (error) {
    if (error instanceof AppError) throw error
    return mapCompanySetupConflict(error)
  }
}

export function listGstRegistrations(context: SetupContext) {
  return repository.listGstRegistrations(context.tenantId)
}

function validateGstin(input: GstRegistrationInput) {
  if (
    GST_REGISTRATION_TYPES_REQUIRING_GSTIN.has(input.registrationType ?? '') &&
    !input.gstin
  ) {
    throw new AppError(
      'GSTIN is required for this registration type',
      'VALIDATION_ERROR',
      400,
    )
  }
  if (input.gstin && !GSTIN_PATTERN.test(input.gstin)) {
    throw new AppError('GSTIN format is invalid', 'VALIDATION_ERROR', 400)
  }
  if (
    input.effectiveFrom &&
    input.effectiveTo &&
    input.effectiveTo < input.effectiveFrom
  ) {
    throw new AppError(
      'effectiveTo must be on or after effectiveFrom',
      'VALIDATION_ERROR',
      400,
    )
  }
}

export async function createGstRegistration(
  context: SetupContext,
  input: Required<
    Pick<
      GstRegistrationInput,
      | 'registrationName'
      | 'legalName'
      | 'registrationType'
      | 'state'
      | 'stateCode'
    >
  > &
    GstRegistrationInput,
) {
  validateGstin(input)
  const locationIds = input.locationIds ?? []
  await validateLocationIds(context.tenantId, locationIds)
  const data = { ...input }
  delete data.locationIds
  try {
    return await repository.createGstRegistration(
      context.tenantId,
      {
        ...data,
        createdById: context.userId,
        updatedById: context.userId,
      },
      locationIds,
      context.userId,
    )
  } catch (error) {
    return mapCompanySetupConflict(error)
  }
}

export async function updateGstRegistration(
  context: SetupContext,
  id: string,
  input: GstRegistrationInput,
) {
  validateGstin(input)
  if (input.locationIds) {
    await validateLocationIds(context.tenantId, input.locationIds)
  }
  const { locationIds, ...data } = input
  try {
    const record = await repository.updateGstRegistration(
      context.tenantId,
      id,
      { ...data, updatedById: context.userId },
      locationIds,
      context.userId,
    )
    if (!record) {
      throw new AppError('GST registration was not found', 'NOT_FOUND', 404)
    }
    return record
  } catch (error) {
    if (error instanceof AppError) throw error
    return mapCompanySetupConflict(error)
  }
}

export function listUsers(context: SetupContext) {
  return repository.listUsers(context.tenantId)
}

export async function createUser(
  context: SetupContext,
  input: Required<
    Pick<TenantUserInput, 'name' | 'email' | 'password' | 'roleId'>
  > &
    TenantUserInput,
) {
  const [role, capacity] = await Promise.all([
    repository.findRole(context.tenantId, input.roleId),
    repository.getUserCapacity(context.tenantId),
  ])
  if (!role || role.deletedAt) {
    throw new AppError('Role was not found', 'NOT_FOUND', 404)
  }
  if (capacity.userLimit !== null && capacity.userCount >= capacity.userLimit) {
    throw new AppError(
      'Subscription user limit has been reached',
      'SUBSCRIPTION_LIMIT_REACHED',
      409,
    )
  }
  const locationIds = input.locationIds ?? []
  await validateLocationIds(context.tenantId, locationIds)
  const passwordHash = await hashPassword(input.password)
  try {
    return await repository.createUser(
      context.tenantId,
      {
        name: input.name,
        email: input.email,
        roleId: input.roleId,
        passwordHash,
        isPrimaryOwner: false,
        status: input.status ?? 'ACTIVE',
        createdById: context.userId,
        updatedById: context.userId,
        ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
        ...(input.designation !== undefined
          ? { designation: input.designation }
          : {}),
      },
      locationIds,
      context.userId,
    )
  } catch (error) {
    return mapCompanySetupConflict(error)
  }
}

export async function updateUser(
  context: SetupContext,
  id: string,
  input: TenantUserInput,
) {
  const existing = await repository.findUser(context.tenantId, id)
  if (!existing || existing.deletedAt) {
    throw new AppError('Tenant user was not found', 'NOT_FOUND', 404)
  }
  if (
    existing.isPrimaryOwner &&
    (input.roleId ||
      ['INACTIVE', 'SUSPENDED', 'LOCKED'].includes(input.status ?? ''))
  ) {
    throw new AppError(
      'The primary owner role and active status cannot be changed here',
      'PRIMARY_OWNER_PROTECTED',
      409,
    )
  }
  if (input.roleId) {
    const role = await repository.findRole(context.tenantId, input.roleId)
    if (!role || role.deletedAt) {
      throw new AppError('Role was not found', 'NOT_FOUND', 404)
    }
  }
  if (input.locationIds) {
    await validateLocationIds(context.tenantId, input.locationIds)
  }
  const { password, locationIds, ...data } = input
  const passwordHash = password ? await hashPassword(password) : undefined
  try {
    return await repository.updateUser(
      context.tenantId,
      id,
      {
        ...data,
        ...(passwordHash
          ? { passwordHash, passwordChangedAt: new Date() }
          : {}),
        updatedById: context.userId,
      },
      locationIds,
      context.userId,
    )
  } catch (error) {
    return mapCompanySetupConflict(error)
  }
}

export function listRoles(context: SetupContext) {
  return repository.listRoles(context.tenantId)
}

export function listPermissions() {
  return repository.listPermissions()
}

export async function createRole(
  context: SetupContext,
  input: Required<Pick<RoleInput, 'name' | 'code'>> & RoleInput,
) {
  const permissionIds = input.permissionIds ?? []
  await validatePermissionIds(permissionIds)
  try {
    return await repository.createRole(
      context.tenantId,
      {
        name: input.name,
        code: input.code,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        status: input.status ?? 'ACTIVE',
        isSystemRole: false,
        createdById: context.userId,
        updatedById: context.userId,
      },
      permissionIds,
      context.userId,
    )
  } catch (error) {
    return mapCompanySetupConflict(error)
  }
}

export async function updateRole(
  context: SetupContext,
  id: string,
  input: RoleInput,
) {
  const existing = await repository.findRole(context.tenantId, id)
  if (!existing || existing.deletedAt) {
    throw new AppError('Role was not found', 'NOT_FOUND', 404)
  }
  if (existing.isSystemRole) {
    throw new AppError(
      'System roles cannot be modified',
      'SYSTEM_ROLE_PROTECTED',
      409,
    )
  }
  const data: RoleInput = { ...input }
  delete data.permissionIds
  delete data.code
  const role = await repository.updateRole(
    context.tenantId,
    id,
    { ...data, updatedById: context.userId },
    context.userId,
  )
  return role!
}

export async function replaceRolePermissions(
  context: SetupContext,
  id: string,
  permissionIds: string[],
) {
  const role = await repository.findRole(context.tenantId, id)
  if (!role || role.deletedAt) {
    throw new AppError('Role was not found', 'NOT_FOUND', 404)
  }
  if (role.isSystemRole) {
    throw new AppError(
      'System role permissions cannot be modified',
      'SYSTEM_ROLE_PROTECTED',
      409,
    )
  }
  await validatePermissionIds(permissionIds)
  return repository.replaceRolePermissions(
    context.tenantId,
    id,
    permissionIds,
    context.userId,
  )
}
