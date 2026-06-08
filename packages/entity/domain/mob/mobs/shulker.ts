import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Shulker: stationary End hostile mob that attacks with levitation projectiles.
// Shell state, armor bonus, teleport, and projectile helpers live in shulker-behavior.ts.
export const ShulkerDefinition: MobDefinition = {
  type: EntityType.Shulker,
  behavior: 'hostile',
  maxHealth: 30,
  attackDamage: 4,
  speed: 0,
  detectionRange: 16,
  attackRange: 16,
  fleeHealthThreshold: 0,
  drops: [{ blockType: 'SHULKER_SHELL', count: 1 }],
  xpReward: 5,
}
