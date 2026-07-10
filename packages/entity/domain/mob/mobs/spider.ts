import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Spider: neutral hostile (attacks on sight at night, neutral by day).
// Modelled as hostile for simplicity — ranged web attack is future scope.
export const SpiderDefinition: MobDefinition = {
  type: EntityType.Spider,
  behavior: 'hostile',
  maxHealth: 16,
  attackDamage: 2,
  speed: 2.7, // vanilla-scale chase speed (player walk 4.317, sprint 5.612)
  detectionRange: 16,
  attackRange: 1.4,
  fleeHealthThreshold: 0,
  drops: [{ blockType: 'STRING', count: 1 }, { blockType: 'SPIDER_EYE', count: 1 }],
  xpReward: 5,
}
