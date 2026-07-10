import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Creeper: iconic hostile mob — approaches silently, ignites within 3 blocks,
// flashes during a 1.5s fuse, then self-destructs with explosion damage.
// Block destruction is handled separately from mob contact damage.
export const CreeperDefinition: MobDefinition = {
  type: EntityType.Creeper,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 7,
  speed: 2.5, // vanilla-scale chase speed (player walk 4.317, sprint 5.612)
  detectionRange: 16,
  attackRange: 1.5,
  fleeHealthThreshold: 0,
  drops: [{ blockType: 'GUNPOWDER', count: 1 }],
  xpReward: 5,
}
