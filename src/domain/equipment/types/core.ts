import { Schema } from '@effect/schema'

export const EquipmentIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(64),
  Schema.pattern(/^[a-z0-9_\-]+$/i),
  Schema.brand('EquipmentId')
)
export type EquipmentId = Schema.Schema.Type<typeof EquipmentIdSchema>

export const EquipmentSetIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(64),
  Schema.pattern(/^[a-z0-9_\-]+$/i),
  Schema.brand('EquipmentSetId')
)
export type EquipmentSetId = Schema.Schema.Type<typeof EquipmentSetIdSchema>

export const EquipmentNameSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(120),
  Schema.brand('EquipmentName')
)
export type EquipmentName = Schema.Schema.Type<typeof EquipmentNameSchema>

export const EquipmentDescriptionSchema = Schema.String.pipe(
  Schema.maxLength(512),
  Schema.brand('EquipmentDescription')
)
export type EquipmentDescription = Schema.Schema.Type<typeof EquipmentDescriptionSchema>

export const UnixTimeSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('UnixTime')
)
export type UnixTime = Schema.Schema.Type<typeof UnixTimeSchema>

export const EquipmentSetVersionSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('EquipmentSetVersion')
)
export type EquipmentSetVersion = Schema.Schema.Type<typeof EquipmentSetVersionSchema>

export const EquipmentOwnerIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.pattern(/^player_[a-z0-9]+$/i),
  Schema.brand('EquipmentOwnerId')
)
export type EquipmentOwnerId = Schema.Schema.Type<typeof EquipmentOwnerIdSchema>

export const WeightSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('WeightKg')
)
export type WeightKg = Schema.Schema.Type<typeof WeightSchema>

export type SchemaViolation = {
  readonly _tag: 'SchemaViolation'
  readonly field: string
  readonly message: string
}

export type RequirementViolation = {
  readonly _tag: 'RequirementViolation'
  readonly requirement: string
  readonly detail: string
}

export type NotFound = {
  readonly _tag: 'NotFound'
  readonly id: string
}

export type EquipmentDomainError = SchemaViolation | RequirementViolation | NotFound

export const makeSchemaViolation = (params: Omit<SchemaViolation, '_tag'>): SchemaViolation => ({
  _tag: 'SchemaViolation',
  ...params,
})

export const makeRequirementViolation = (
  params: Omit<RequirementViolation, '_tag'>
): RequirementViolation => ({
  _tag: 'RequirementViolation',
  ...params,
})

export const makeNotFound = (params: Omit<NotFound, '_tag'>): NotFound => ({
  _tag: 'NotFound',
  ...params,
})
