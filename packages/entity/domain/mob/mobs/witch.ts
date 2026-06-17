import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const WitchDefinition: MobDefinition = {
  type: EntityType.Witch,
  behavior: 'hostile',
  maxHealth: 26,
  attackDamage: 3,
  speed: 1.1,
  detectionRange: 16,
  attackRange: 1.6,
  fleeHealthThreshold: 0,
  drops: [
    { blockType: 'REDSTONE_DUST', count: 1 },
    { blockType: 'GLOWSTONE_DUST', count: 1 },
    { blockType: 'SPIDER_EYE', count: 1 },
    { blockType: 'STICKS', count: 1 },
  ],
  xpReward: 5,
}
