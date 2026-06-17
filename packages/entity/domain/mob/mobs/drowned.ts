import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const DrownedDefinition: MobDefinition = {
  type: EntityType.Drowned,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 3,
  speed: 1.1,
  detectionRange: 16,
  attackRange: 1.6,
  fleeHealthThreshold: 0,
  drops: [
    { blockType: 'ROTTEN_FLESH', count: 1 },
    { blockType: 'RAW_COD', count: 1, chance: 0.11 },
  ],
  xpReward: 5,
}
