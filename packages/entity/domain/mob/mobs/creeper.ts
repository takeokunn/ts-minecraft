import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Creeper: iconic hostile mob — approaches silently then detonates.
// Explosion mechanic (area damage + self-destruct) is Phase 13+ scope.
// Until then, models as a contact-melee mob with vanilla-equivalent proximity damage (7).
export const CreeperDefinition: MobDefinition = {
  type: EntityType.Creeper,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 7,
  speed: 1.3,
  detectionRange: 16,
  attackRange: 1.5,
  fleeHealthThreshold: 0,
  drops: [{ blockType: 'GUNPOWDER', count: 1 }],
  xpReward: 5,
}
