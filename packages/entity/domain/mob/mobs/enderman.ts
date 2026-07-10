import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Enderman: tall neutral hostile — teleportation mechanic is Phase 13+ scope.
// High HP and damage; flees when at low health (vanilla behaviour).
export const EndermanDefinition: MobDefinition = {
  type: EntityType.Enderman,
  behavior: 'hostile',
  maxHealth: 40,
  attackDamage: 7,
  speed: 2.9, // vanilla-scale chase speed (player walk 4.317, sprint 5.612)
  detectionRange: 24,
  attackRange: 2.0,
  fleeHealthThreshold: 0.1,
  drops: [{ blockType: 'ENDER_PEARL', count: 1 }],
  xpReward: 5,
}
