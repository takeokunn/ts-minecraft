import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const SquidDefinition: MobDefinition = {
  type: EntityType.Squid,
  behavior: 'passive',
  maxHealth: 10,
  attackDamage: 0,
  speed: 0.7,
  detectionRange: 10,
  attackRange: 0,
  fleeHealthThreshold: 0.7,
  drops: [{ blockType: 'INK_SAC', count: 1 }],
  xpReward: 2,
}

export const GlowSquidDefinition: MobDefinition = {
  ...SquidDefinition,
  type: EntityType.GlowSquid,
}
