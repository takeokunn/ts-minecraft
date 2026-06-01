import { Schema } from 'effect'
import { InventoryItemSchema } from '@ts-minecraft/core'
import { EntityTypeSchema, MobBehaviorSchema } from '../entity'

const EntityDropSchema = Schema.Struct({
  blockType: InventoryItemSchema,
  // Drop counts are always whole, positive stacks (e.g. 1 bone, 2 arrows).
  count: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

export const MobDefinitionSchema = Schema.Struct({
  type: EntityTypeSchema,
  behavior: MobBehaviorSchema,
  maxHealth: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  attackDamage: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  speed: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  detectionRange: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  // Passive mobs do not attack, so attackRange is legitimately 0 (matching
  // attackDamage). nonNegative — not positive — to admit those definitions.
  attackRange: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  fleeHealthThreshold: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  drops: Schema.Array(EntityDropSchema),
  // XP granted to the player when this mob is killed (vanilla Java Edition values).
  xpReward: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
})
export type MobDefinition = Schema.Schema.Type<typeof MobDefinitionSchema>
