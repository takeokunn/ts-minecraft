import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Blaze: hostile nether-fortress guardian. Damage uses the same ranged-shot
// path as the Skeleton (no physical fireball entity yet); a landed shot also
// ignites the player briefly (see BLAZE_IGNITE_SECS in entity-manager-combat).
// Spawns only in the nether, near fortress sites.
export const BlazeDefinition: MobDefinition = {
  type: EntityType.Blaze,
  behavior: 'hostile',
  maxHealth: 20,
  attackDamage: 3,
  speed: 0.8,
  detectionRange: 24,
  attackRange: 12,
  fleeHealthThreshold: 0,
  drops: [{ blockType: 'BLAZE_ROD', count: 1, chance: 0.5 }],
  xpReward: 10,
}
