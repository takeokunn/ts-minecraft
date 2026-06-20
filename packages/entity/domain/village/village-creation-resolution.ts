import { Array as Arr, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { type Village } from './village-model'
import { createVillage } from './village-creation'
import { VILLAGE_NEAR_DISTANCE } from './village-simulation-constants'
import { distanceSq } from './village-position'
import { findNearestVillage } from './village-search'
import { snapVillageCenter } from './village-placement-geometry'
import type { VillageState } from './village-state'

export const ensureVillageInState = (
  state: VillageState,
  playerPosition: Position,
): readonly [VillageState, Village] => {
  const nearestVillage = Option.getOrNull(findNearestVillage(state.villages, playerPosition))
  if (
    nearestVillage !== null &&
    distanceSq(nearestVillage.center, playerPosition) <= VILLAGE_NEAR_DISTANCE * VILLAGE_NEAR_DISTANCE
  ) {
    return [state, nearestVillage] as const
  }
  const village = createVillage(state.nextVillageNumber, snapVillageCenter(playerPosition))
  return [
    {
      ...state,
      villages: Arr.append(state.villages, village),
      nextVillageNumber: state.nextVillageNumber + 1,
    },
    village,
  ] as const
}
