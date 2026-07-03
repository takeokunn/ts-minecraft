import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Ghast: the nether's ranged artillery. Fireballs ride the same ranged-damage
// path as the Blaze (instant-hit + ignite); v1 drifts along the ground plane
// like other mobs (hover-flight is deferred, same as the Blaze).
export const GhastDefinition: MobDefinition = {
  type: EntityType.Ghast,
  behavior: 'hostile',
  maxHealth: 10,
  attackDamage: 4,
  speed: 0.7,
  detectionRange: 24,
  attackRange: 16,
  fleeHealthThreshold: 0,
  drops: [{ blockType: 'GUNPOWDER', count: 1 }],
  xpReward: 5,
}
