import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const ZOMBIE_BASE_DROPS: MobDefinition['drops'] = [
  { blockType: 'ROTTEN_FLESH', count: 1 },
  { blockType: 'CARROT', count: 1, chance: 0.025 },
  { blockType: 'IRON_INGOT', count: 1, chance: 0.025 },
]

export const ZOMBIE_BASE_STATS = {
  maxHealth: 20,
  attackDamage: 3,
  speed: 1.25,
  detectionRange: 16,
  attackRange: 1.6,
  fleeHealthThreshold: 0.1,
  xpReward: 5,
} as const

export const ZombieDefinition: MobDefinition = {
  ...ZOMBIE_BASE_STATS,
  type: EntityType.Zombie,
  behavior: 'hostile',
  drops: ZOMBIE_BASE_DROPS,
}
