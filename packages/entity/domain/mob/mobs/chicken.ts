import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const ChickenDefinition: MobDefinition = {
  type: EntityType.Chicken,
  behavior: 'passive',
  maxHealth: 4,
  attackDamage: 0,
  speed: 1.0,
  detectionRange: 10,
  attackRange: 0,
  fleeHealthThreshold: 0.7,
  drops: [
    { blockType: 'FEATHER', count: 1 },
    { blockType: 'RAW_CHICKEN', count: 1 },
  ],
  xpReward: 2,
  breedingItem: 'WHEAT_SEEDS',
}
