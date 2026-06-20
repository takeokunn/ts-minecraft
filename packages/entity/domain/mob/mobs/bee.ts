import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const BeeDefinition: MobDefinition = {
  type: EntityType.Bee,
  behavior: 'passive',
  maxHealth: 10,
  attackDamage: 0,
  speed: 0.3,
  detectionRange: 10,
  attackRange: 0,
  fleeHealthThreshold: 0.8,
  drops: [],
  xpReward: 1,
}
