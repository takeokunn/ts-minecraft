import { JsonValueSchema } from '@shared/schema/json'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Schema } from 'effect'

export const SettingsOptionNotFoundErrorSchema = Schema.TaggedError('SettingsOptionNotFoundError', {
  optionId: Schema.String,
})
export type SettingsOptionNotFoundError = Schema.Schema.Type<typeof SettingsOptionNotFoundErrorSchema>
export const SettingsOptionNotFoundError = makeErrorFactory(SettingsOptionNotFoundErrorSchema)

export const SettingsOptionTypeMismatchErrorSchema = Schema.TaggedError('SettingsOptionTypeMismatchError', {
  optionId: Schema.String,
  expectedType: Schema.Literal('toggle', 'slider', 'select'),
  receivedType: Schema.Literal('toggle', 'slider', 'select'),
})
export type SettingsOptionTypeMismatchError = Schema.Schema.Type<typeof SettingsOptionTypeMismatchErrorSchema>
export const SettingsOptionTypeMismatchError = makeErrorFactory(SettingsOptionTypeMismatchErrorSchema)

export const SettingsOptionValueErrorSchema = Schema.TaggedError('SettingsOptionValueError', {
  optionId: Schema.String,
  reason: Schema.String,
  value: JsonValueSchema,
})
export type SettingsOptionValueError = Schema.Schema.Type<typeof SettingsOptionValueErrorSchema>
export const SettingsOptionValueError = makeErrorFactory(SettingsOptionValueErrorSchema)
