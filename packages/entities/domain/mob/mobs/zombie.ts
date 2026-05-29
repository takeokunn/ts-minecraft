import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const ZombieDefinition: MobDefinition = {
  type: EntityType.Zombie,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 3,
  speed: 1.25,
  detectionRange: 16,
  attackRange: 1.6,
  fleeHealthThreshold: 0.1,
  drops: [{ blockType: 'ROTTEN_FLESH', count: 1 }],
  xpReward: 5,
}
