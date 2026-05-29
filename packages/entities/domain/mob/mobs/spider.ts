import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Spider: neutral hostile (attacks on sight at night, neutral by day).
// Modelled as hostile for simplicity — ranged web attack is future scope.
export const SpiderDefinition: MobDefinition = {
  type: EntityType.Spider,
  behavior: 'hostile',
  maxHealth: 16,
  attackDamage: 2,
  speed: 1.45,
  detectionRange: 16,
  attackRange: 1.4,
  fleeHealthThreshold: 0,
  drops: [{ blockType: 'STRING', count: 1 }, { blockType: 'SPIDER_EYE', count: 1 }],
  xpReward: 5,
}
