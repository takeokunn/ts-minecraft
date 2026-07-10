import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const DrownedDefinition: MobDefinition = {
  type: EntityType.Drowned,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 3,
  speed: 2.4, // vanilla-scale chase speed (player walk 4.317, sprint 5.612)
  detectionRange: 16,
  attackRange: 1.6,
  fleeHealthThreshold: 0,
  drops: [
    { blockType: 'ROTTEN_FLESH', count: 1 },
    { blockType: 'RAW_COD', count: 1, chance: 0.11 },
  ],
  xpReward: 5,
}
