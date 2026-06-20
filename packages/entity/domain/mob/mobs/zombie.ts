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
  // ROTTEN_FLESH always; CARROT and IRON_INGOT model the rare zombie drop pool.
  // POTATO is intentionally omitted until the item type exists in core.
  drops: [
    { blockType: 'ROTTEN_FLESH', count: 1 },
    { blockType: 'CARROT', count: 1, chance: 0.025 },
    { blockType: 'IRON_INGOT', count: 1, chance: 0.025 },
  ],
  xpReward: 5,
}
