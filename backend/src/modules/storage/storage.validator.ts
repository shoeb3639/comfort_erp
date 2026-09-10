import Joi from 'joi'
import { DOCUMENT_TYPES } from './storage.constants'
import { STORAGE_ENTITY_TYPES } from './storage.types'

export const uploadFieldsSchema = Joi.object({
  entityType: Joi.string()
    .valid(...STORAGE_ENTITY_TYPES)
    .required(),
  entityId: Joi.string().uuid().required(),
  documentType: Joi.string()
    .trim()
    .uppercase()
    .valid(...new Set(Object.values(DOCUMENT_TYPES).flat()))
    .allow('', null),
  tenantId: Joi.any().strip(),
})

export const fileParamsSchema = Joi.object({
  fileId: Joi.string().uuid().required(),
})

export const fileListSchema = Joi.object({
  entityType: Joi.string().valid(...STORAGE_ENTITY_TYPES),
  entityId: Joi.string()
    .uuid()
    .when('entityType', { is: Joi.exist(), then: Joi.required() }),
  documentType: Joi.string().trim().uppercase().max(50),
})

export const dispositionSchema = Joi.object({
  disposition: Joi.string().valid('inline', 'attachment').default('inline'),
})
