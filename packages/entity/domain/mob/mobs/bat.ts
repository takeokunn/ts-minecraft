import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const BatDefinition: MobDefinition = {
  type: EntityType.Bat,
  behavior: 'passive',
  maxHealth: 6,
  attackDamage: 0,
  speed: 1.2,
  detectionRange: 8,
  attackRange: 0,
  fleeHealthThreshold: 0.8,
  drops: [],
  xpReward: 0,
}
