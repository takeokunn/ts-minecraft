import { createStack } from '@/domain/item-stack'
import { EntityType } from '@/entity/entity'
import type { MobDefinition } from '@/entity/mobs/mob-definition'

export const SheepDefinition: MobDefinition = {
  type: EntityType.Sheep,
  behavior: 'passive',
  maxHealth: 8,
  attackDamage: 0,
  speed: 0.95,
  detectionRange: 10,
  attackRange: 0,
  fleeHealthThreshold: 0.7,
  drops: [createStack('LEAVES', 1)],
}
