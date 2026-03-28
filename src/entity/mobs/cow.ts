import { createStack } from '@/domain/item-stack'
import { EntityType } from '@/entity/entity'
import type { MobDefinition } from '@/entity/mobs/mob-definition'

export const CowDefinition: MobDefinition = {
  type: EntityType.Cow,
  behavior: 'passive',
  maxHealth: 10,
  attackDamage: 0,
  speed: 1.0,
  detectionRange: 12,
  attackRange: 0,
  fleeHealthThreshold: 0.6,
  drops: [createStack('GRASS', 1)],
}
