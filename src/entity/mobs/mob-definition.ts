import { Schema } from 'effect'
import { ItemStack } from '@/domain/item-stack'
import { EntityTypeSchema, MobBehaviorSchema } from '@/entity/entity'

export const MobDefinitionSchema = Schema.Struct({
  type: EntityTypeSchema,
  behavior: MobBehaviorSchema,
  maxHealth: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  attackDamage: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  speed: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  detectionRange: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  attackRange: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  fleeHealthThreshold: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  drops: Schema.Array(ItemStack),
})
export type MobDefinition = Schema.Schema.Type<typeof MobDefinitionSchema>
