import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Endermite: small hostile End mob that spawns from ender pearl throws.
// In vanilla: 8 HP, 2 attack damage, moderate speed, short range.
export const EndermiteDefinition: MobDefinition = {
  type: EntityType.Endermite,
  behavior: 'hostile',
  maxHealth: 8,
  attackDamage: 2,
  speed: 1.5,
  detectionRange: 8,
  attackRange: 1.5,
  fleeHealthThreshold: 0,
  drops: [],
  xpReward: 3,
}
