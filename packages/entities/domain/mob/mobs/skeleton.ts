import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Skeleton: hostile undead archer — detects from far range; ranged projectile
// attack is Phase 14+ scope; modelled as long-range melee for now.
export const SkeletonDefinition: MobDefinition = {
  type: EntityType.Skeleton,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 2,
  speed: 1.0,
  detectionRange: 20,
  attackRange: 12,
  fleeHealthThreshold: 0,
  drops: [{ blockType: 'BONE', count: 1 }, { blockType: 'ARROW', count: 2 }],
  xpReward: 5,
}
