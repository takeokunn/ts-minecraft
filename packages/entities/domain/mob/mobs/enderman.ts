import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Enderman: tall neutral hostile — teleportation mechanic is Phase 13+ scope.
// High HP and damage; flees when at low health (vanilla behaviour).
export const EndermanDefinition: MobDefinition = {
  type: EntityType.Enderman,
  behavior: 'hostile',
  maxHealth: 40,
  attackDamage: 7,
  speed: 1.15,
  detectionRange: 24,
  attackRange: 2.0,
  fleeHealthThreshold: 0.1,
  drops: [{ blockType: 'ENDER_PEARL', count: 1 }],
  xpReward: 5,
}
