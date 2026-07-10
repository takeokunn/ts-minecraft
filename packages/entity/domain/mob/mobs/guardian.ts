import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Ocean hostile (vanilla: monument guard; here it also patrols deep open
// water). Ranged-only: the laser is an instant-hit shot on the shared ranged
// cadence, traced as a dense prismarine beam. Swims via the hover mechanic,
// so it never sinks to the seabed like a land mob would.
export const GuardianDefinition: MobDefinition = {
  type: EntityType.Guardian,
  behavior: 'hostile',
  maxHealth: 30,
  attackDamage: 6,
  speed: 2.2, // deliberate underwater pursuit (player swim speed is lower than walk)
  detectionRange: 16,
  attackRange: 12, // laser reach (vanilla beam ~15; matches skeleton bow here)
  fleeHealthThreshold: 0,
  drops: [
    { blockType: 'PRISMARINE_SHARD', count: 1, maxCount: 2 },
    { blockType: 'RAW_COD', count: 1, chance: 0.4 },
  ],
  xpReward: 10,
}
