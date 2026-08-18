import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
import * as service from './company-setup.service'
import type {
  BankAccountInput,
  CompanyProfileInput,
  GstRegistrationInput,
  InvoiceSettingsInput,
  LocationInput,
  RoleInput,
  TaxSettingsInput,
  TenantUserInput,
} from './company-setup.types'
import type { SetupContext } from './company-setup.types'

function context(request: Parameters<RequestHandler>[0]): SetupContext {
  if (!request.auth?.tenantId || !request.tenant) {
    throw new AppError('Tenant context is required', 'UNAUTHORIZED', 401)
  }
  return { tenantId: request.auth.tenantId, userId: request.auth.userId }
}

function recordId(request: Parameters<RequestHandler>[0]) {
  const value = request.params.recordId
  if (typeof value !== 'string') {
    throw new AppError('Invalid record ID', 'VALIDATION_ERROR', 400)
  }
  return value
}

function send(
  response: Parameters<RequestHandler>[1],
  data: unknown,
  message: string,
  status = 200,
) {
  response.status(status).json({ success: true, data, message })
}

export const getCompanyProfile: RequestHandler = async (request, response) =>
  send(
    response,
    await service.getCompanyProfile(context(request)),
    'Company profile retrieved',
  )

export const updateCompanyProfile: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateCompanyProfile(
      context(request),
      request.body as CompanyProfileInput,
    ),
    'Company profile updated',
  )

export const getTaxSettings: RequestHandler = async (request, response) =>
  send(
    response,
    await service.getTaxSettings(context(request)),
    'Tax settings retrieved',
  )

export const updateTaxSettings: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateTaxSettings(
      context(request),
      request.body as TaxSettingsInput,
    ),
    'Tax settings updated',
  )

export const getInvoiceSettings: RequestHandler = async (request, response) =>
  send(
    response,
    await service.getInvoiceSettings(context(request)),
    'Invoice settings retrieved',
  )

export const updateInvoiceSettings: RequestHandler = async (
  request,
  response,
) =>
  send(
    response,
    await service.updateInvoiceSettings(
      context(request),
      request.body as InvoiceSettingsInput,
    ),
    'Invoice settings updated',
  )

export const getOnboarding: RequestHandler = async (request, response) =>
  send(
    response,
    await service.getOnboarding(context(request)),
    'Onboarding status retrieved',
  )

export const listLocations: RequestHandler = async (request, response) =>
  send(
    response,
    await service.listLocations(context(request)),
    'Locations retrieved',
  )
export const createLocation: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createLocation(
      context(request),
      request.body as Required<Pick<LocationInput, 'name'>> & LocationInput,
    ),
    'Location created',
    201,
  )
export const updateLocation: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateLocation(
      context(request),
      recordId(request),
      request.body as LocationInput,
    ),
    'Location updated',
  )

export const listBankAccounts: RequestHandler = async (request, response) =>
  send(
    response,
    await service.listBankAccounts(context(request)),
    'Bank accounts retrieved',
  )
export const createBankAccount: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createBankAccount(
      context(request),
      request.body as Required<
        Pick<
          BankAccountInput,
          'accountName' | 'bankName' | 'accountNumber' | 'ifscCode'
        >
      > &
        BankAccountInput,
    ),
    'Bank account created',
    201,
  )
export const updateBankAccount: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateBankAccount(
      context(request),
      recordId(request),
      request.body as BankAccountInput,
    ),
    'Bank account updated',
  )

export const listGstRegistrations: RequestHandler = async (request, response) =>
  send(
    response,
    await service.listGstRegistrations(context(request)),
    'GST registrations retrieved',
  )
export const createGstRegistration: RequestHandler = async (
  request,
  response,
) =>
  send(
    response,
    await service.createGstRegistration(
      context(request),
      request.body as Required<
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
    ),
    'GST registration created',
    201,
  )
export const updateGstRegistration: RequestHandler = async (
  request,
  response,
) =>
  send(
    response,
    await service.updateGstRegistration(
      context(request),
      recordId(request),
      request.body as GstRegistrationInput,
    ),
    'GST registration updated',
  )

export const listUsers: RequestHandler = async (request, response) =>
  send(
    response,
    await service.listUsers(context(request)),
    'Tenant users retrieved',
  )
export const createUser: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createUser(
      context(request),
      request.body as Required<
        Pick<TenantUserInput, 'name' | 'email' | 'password' | 'roleId'>
      > &
        TenantUserInput,
    ),
    'Tenant user created',
    201,
  )
export const updateUser: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateUser(
      context(request),
      recordId(request),
      request.body as TenantUserInput,
    ),
    'Tenant user updated',
  )

export const listRoles: RequestHandler = async (request, response) =>
  send(
    response,
    await service.listRoles(context(request)),
    'Tenant roles retrieved',
  )
export const createRole: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createRole(
      context(request),
      request.body as Required<Pick<RoleInput, 'name' | 'code'>> & RoleInput,
    ),
    'Tenant role created',
    201,
  )
export const updateRole: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateRole(
      context(request),
      recordId(request),
      request.body as RoleInput,
    ),
    'Tenant role updated',
  )
export const replaceRolePermissions: RequestHandler = async (
  request,
  response,
) =>
  send(
    response,
    await service.replaceRolePermissions(
      context(request),
      recordId(request),
      (request.body as { permissionIds: string[] }).permissionIds,
    ),
    'Role permissions updated',
  )

export const listPermissions: RequestHandler = async (request, response) =>
  send(
    response,
    await service.listPermissions(),
    'Permission catalog retrieved',
  )
