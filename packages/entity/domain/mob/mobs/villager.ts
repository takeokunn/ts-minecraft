import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Villagers are village-bound passive mobs: no combat, no drops (vanilla
// villagers drop nothing), spawned by village activation rather than the
// generic passive rotation. Right-clicking one opens the trading UI.
export const VillagerDefinition: MobDefinition = {
  type: EntityType.Villager,
  behavior: 'passive',
  maxHealth: 20,
  attackDamage: 0,
  speed: 0.9,
  detectionRange: 8,
  attackRange: 0,
  fleeHealthThreshold: 0.9,
  drops: [],
  xpReward: 0,
}
