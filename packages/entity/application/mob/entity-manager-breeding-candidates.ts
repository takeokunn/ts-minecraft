import { HashMap } from 'effect'
import { BABY_GROW_TICKS } from '../../domain/mob/breeding'
import type { EntityType } from '../../domain/mob/entity'
import type { EntityId } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'

export type BreedingCandidate = {
  readonly id: EntityId
  readonly type: EntityType
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
}

export const collectBreedingCandidates = (
  entities: HashMap.HashMap<EntityId, ManagedEntity>,
): ReadonlyArray<BreedingCandidate> => {
  const candidates: BreedingCandidate[] = []
  for (const [id, entity] of entities) {
    if (entity.loveTicksRemaining > 0 && entity.ageTicks >= BABY_GROW_TICKS) {
      candidates.push({ id, type: entity.type, position: entity.position })
    }
  }
  return candidates
}
