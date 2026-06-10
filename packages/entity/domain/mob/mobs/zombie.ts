import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const ZombieDefinition: MobDefinition = {
  type: EntityType.Zombie,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 3,
  speed: 1.25,
  detectionRange: 16,
  attackRange: 1.6,
  fleeHealthThreshold: 0.1,
  // ROTTEN_FLESH always; CARROT is a rare drop (vanilla ~2.5%) — the only survival
  // source of carrots, which in turn are the pig's breeding item.
  drops: [
    { blockType: 'ROTTEN_FLESH', count: 1 },
    { blockType: 'CARROT', count: 1, chance: 0.025 },
  ],
  xpReward: 5,
}
