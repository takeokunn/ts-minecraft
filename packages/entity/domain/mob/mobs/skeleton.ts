import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Skeleton: hostile undead archer. Damage uses a ranged-shot path; physical
// arrow entities/projectile ballistics remain a later fidelity step.
export const SkeletonDefinition: MobDefinition = {
  type: EntityType.Skeleton,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 4, // vanilla arrow damage (normal difficulty)
  speed: 2.4, // vanilla-scale chase speed (player walk 4.317, sprint 5.612)
  detectionRange: 20,
  attackRange: 12,
  fleeHealthThreshold: 0,
  drops: [
    { blockType: 'BONE', count: 1, maxCount: 2 },
    { blockType: 'ARROW', count: 2 },
    { blockType: 'BOW', count: 1, chance: 0.085 },
  ],
  xpReward: 5,
}
