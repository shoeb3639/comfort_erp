import { randomUUID } from 'node:crypto'
import { Prisma } from '../../generated/prisma/client'
import type {
  CustomerStatus,
  CustomerType,
  Salutation,
} from '../../generated/prisma/enums'
import { AppError } from '../../shared/errors/app-error'
import type { PageRequest } from '../../shared/pagination'
import { pageResult } from '../../shared/pagination'
import { titleCaseOptional, toTitleCase } from '../../shared/text/title-case'
import * as repository from './customer.repository'

export interface CustomerContext {
  tenantId: string
  userId: string
}

export interface CustomerContactInput {
  salutation?: Salutation | null
  name: string
  role?: string | null
  phone?: string | null
  email?: string | null
  isPrimary?: boolean
}

export interface CustomerInput {
  type?: CustomerType
  salutation?: Salutation | null
  name?: string
  billingName?: string
  email?: string | null
  phone?: string
  city?: string | null
  gstin?: string | null
  billingAddress?: string | null
  creditLimit?: number
  status?: CustomerStatus
  contacts?: CustomerContactInput[]
}

export interface TravellerInput {
  travellerType: string
  salutation?: Salutation | null
  name: string
  phone?: string | null
  email?: string | null
  department?: string | null
  employeeId?: string | null
  notes?: string | null
  status?: CustomerStatus
}

function mapCustomer<
  T extends {
    name: string
    salutation: Salutation | null
    creditLimit: Prisma.Decimal
    outstanding: Prisma.Decimal
  },
>(customer: T) {
  return {
    ...customer,
    displayName: `${customer.salutation === 'MR' ? 'Mr. ' : customer.salutation === 'MS' ? 'Ms. ' : ''}${customer.name}`,
    creditLimit: customer.creditLimit.toNumber(),
    outstanding: customer.outstanding.toNumber(),
    bookings: [],
    invoices: [],
    payments: [],
    rateCards: [],
    documents: [],
  }
}

function mapConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new AppError(
      'A customer with the same unique value already exists',
      'CONFLICT',
      409,
    )
  }
  throw error
}

function validateGstin(gstin: string | null | undefined) {
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin)) {
    throw new AppError('GSTIN format is invalid', 'VALIDATION_ERROR', 400)
  }
}

function contacts(
  input: CustomerContactInput[] | undefined,
  fallback?: Pick<CustomerInput, 'salutation' | 'name' | 'phone' | 'email'>,
) {
  const values =
    input ??
    (fallback?.name
      ? [
          {
            salutation: fallback.salutation,
            name: fallback.name,
            role: 'Primary',
            phone: fallback.phone,
            email: fallback.email,
            isPrimary: true,
          },
        ]
      : undefined)
  return values?.map((contact, index) => ({
    salutation: contact.salutation ?? null,
    name: toTitleCase(contact.name),
    role: titleCaseOptional(contact.role ?? null),
    phone: contact.phone ?? null,
    email: contact.email ?? null,
    isPrimary: contact.isPrimary ?? index === 0,
  }))
}

function normalizeCustomer(input: CustomerInput): CustomerInput {
  return {
    ...input,
    ...(input.name !== undefined ? { name: toTitleCase(input.name) } : {}),
    ...(input.billingName !== undefined
      ? { billingName: toTitleCase(input.billingName) }
      : {}),
    ...(input.city !== undefined
      ? { city: input.city ? toTitleCase(input.city) : null }
      : {}),
    ...(input.billingAddress !== undefined
      ? {
          billingAddress: input.billingAddress
            ? toTitleCase(input.billingAddress)
            : null,
        }
      : {}),
  }
}

export async function listCustomers(
  context: CustomerContext,
  filters: {
    search?: string
    type?: CustomerType
    status?: CustomerStatus
  } & PageRequest,
) {
  const [records, total] = await repository.listCustomers(
    context.tenantId,
    filters,
  )
  return pageResult(records.map(mapCustomer), total, filters)
}

export async function getCustomer(
  context: CustomerContext,
  customerId: string,
) {
  const customer = await repository.findCustomer(context.tenantId, customerId)
  if (!customer) throw new AppError('Customer was not found', 'NOT_FOUND', 404)
  return mapCustomer(customer)
}

export async function createCustomer(
  context: CustomerContext,
  input: Required<
    Pick<CustomerInput, 'type' | 'name' | 'billingName' | 'phone'>
  > &
    CustomerInput,
) {
  validateGstin(input.gstin)
  const normalized = normalizeCustomer(input)
  const { contacts: contactInput, ...data } = normalized
  try {
    const customer = await repository.createCustomer(
      context.tenantId,
      {
        type: input.type,
        salutation: data.salutation ?? null,
        name: normalized.name ?? input.name,
        billingName: normalized.billingName ?? input.billingName,
        email: input.email ?? null,
        phone: input.phone,
        city: normalized.city ?? null,
        gstin: data.gstin ?? null,
        billingAddress: normalized.billingAddress ?? null,
        customerCode: `CUST-${randomUUID().slice(0, 8).toUpperCase()}`,
        creditLimit: data.creditLimit ?? 0,
        status: data.status ?? 'ACTIVE',
        createdById: context.userId,
        updatedById: context.userId,
      },
      contacts(contactInput, normalized) ?? [],
      context.userId,
    )
    return mapCustomer(customer)
  } catch (error) {
    return mapConflict(error)
  }
}

export async function updateCustomer(
  context: CustomerContext,
  customerId: string,
  input: CustomerInput,
) {
  validateGstin(input.gstin)
  const normalized = normalizeCustomer(input)
  const { contacts: contactInput, ...data } = normalized
  try {
    const customer = await repository.updateCustomer(
      context.tenantId,
      customerId,
      { ...data, updatedById: context.userId },
      contacts(contactInput),
      context.userId,
    )
    if (!customer) {
      throw new AppError('Customer was not found', 'NOT_FOUND', 404)
    }
    return mapCustomer(customer)
  } catch (error) {
    if (error instanceof AppError) throw error
    return mapConflict(error)
  }
}

export async function createTraveller(
  context: CustomerContext,
  customerId: string,
  input: TravellerInput,
) {
  const traveller = await repository.createTraveller(
    context.tenantId,
    customerId,
    {
      ...input,
      travellerType: toTitleCase(input.travellerType),
      name: toTitleCase(input.name),
      ...(input.department !== undefined
        ? { department: titleCaseOptional(input.department) }
        : {}),
      ...(input.notes !== undefined
        ? { notes: titleCaseOptional(input.notes) }
        : {}),
      status: input.status ?? 'ACTIVE',
      createdById: context.userId,
      updatedById: context.userId,
    },
    context.userId,
  )
  if (!traveller) {
    throw new AppError('Customer was not found', 'NOT_FOUND', 404)
  }
  return traveller
}

export async function getTraveller(
  context: CustomerContext,
  customerId: string,
  travellerId: string,
) {
  const traveller = await repository.findTraveller(
    context.tenantId,
    customerId,
    travellerId,
  )
  if (!traveller) {
    throw new AppError('Employee was not found', 'NOT_FOUND', 404)
  }
  return traveller
}

export async function updateTraveller(
  context: CustomerContext,
  customerId: string,
  travellerId: string,
  input: Partial<TravellerInput>,
) {
  const traveller = await repository.updateTraveller(
    context.tenantId,
    customerId,
    travellerId,
    {
      ...input,
      ...(input.travellerType !== undefined
        ? { travellerType: toTitleCase(input.travellerType) }
        : {}),
      ...(input.name !== undefined ? { name: toTitleCase(input.name) } : {}),
      ...(input.department !== undefined
        ? { department: titleCaseOptional(input.department) }
        : {}),
      ...(input.notes !== undefined
        ? { notes: titleCaseOptional(input.notes) }
        : {}),
      updatedById: context.userId,
    },
    context.userId,
  )
  if (!traveller) {
    throw new AppError('Employee was not found', 'NOT_FOUND', 404)
  }
  return traveller
}
