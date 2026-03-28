import { createStack } from '@/domain/item-stack'
import { EntityType } from '@/entity/entity'
import type { MobDefinition } from '@/entity/mobs/mob-definition'

export const ZombieDefinition: MobDefinition = {
  type: EntityType.Zombie,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 3,
  speed: 1.25,
  detectionRange: 16,
  attackRange: 1.6,
  fleeHealthThreshold: 0.1,
  drops: [createStack('COBBLESTONE', 1)],
}
