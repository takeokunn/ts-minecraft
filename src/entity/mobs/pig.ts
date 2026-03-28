import { createStack } from '@/domain/item-stack'
import { EntityType } from '@/entity/entity'
import type { MobDefinition } from '@/entity/mobs/mob-definition'

export const PigDefinition: MobDefinition = {
  type: EntityType.Pig,
  behavior: 'passive',
  maxHealth: 10,
  attackDamage: 0,
  speed: 1.05,
  detectionRange: 10,
  attackRange: 0,
  fleeHealthThreshold: 0.65,
  drops: [createStack('DIRT', 1)],
}
