import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const ZombieVillagerDefinition: MobDefinition = {
  type: EntityType.ZombieVillager,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 3,
  speed: 1.25,
  detectionRange: 16,
  attackRange: 1.6,
  fleeHealthThreshold: 0.1,
  drops: [
    { blockType: 'ROTTEN_FLESH', count: 1 },
    { blockType: 'CARROT', count: 1, chance: 0.025 },
  ],
  xpReward: 5,
}
