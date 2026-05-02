import { Schema } from 'effect'
import type { EntityDrop } from '../drop'
import { EntityTypeSchema, MobBehaviorSchema } from '../entity'

const EntityDropSchema = Schema.Struct({
  blockType: Schema.String,
  count: Schema.Number,
})

export const MobDefinitionSchema = Schema.Struct({
  type: EntityTypeSchema,
  behavior: MobBehaviorSchema,
  maxHealth: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  attackDamage: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  speed: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  detectionRange: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  attackRange: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  fleeHealthThreshold: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  drops: Schema.Array(EntityDropSchema),
})
export type MobDefinition = {
  readonly type: Schema.Schema.Type<typeof EntityTypeSchema>
  readonly behavior: Schema.Schema.Type<typeof MobBehaviorSchema>
  readonly maxHealth: number
  readonly attackDamage: number
  readonly speed: number
  readonly detectionRange: number
  readonly attackRange: number
  readonly fleeHealthThreshold: number
  readonly drops: ReadonlyArray<EntityDrop>
}
