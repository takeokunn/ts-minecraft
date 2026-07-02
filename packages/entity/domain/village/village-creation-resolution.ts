import { Array as Arr, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { type Village } from './village-model'
import { createVillage } from './village-creation'
import { VILLAGE_NEAR_DISTANCE } from './village-simulation-constants'
import { distanceSq } from './village-position'
import { findNearestVillage } from './village-search'
import { VILLAGE_ACTIVATION_DISTANCE, villageSitesNear } from './village-region-sites'
import { snapVillageCenter } from './village-placement-geometry'
import type { VillageState } from './village-state'

// Seed-deterministic activation: create villages for every deterministic
// region site within activation range that isn't in the state yet. Replaces
// the old player-follow behavior (a village within 80 blocks of wherever the
// player walked) with sparse, world-seed-derived placement that is identical
// for every player sharing the seed.
export const ensureSeededVillagesInState = (
  state: VillageState,
  playerPosition: Position,
  worldSeed: number,
): VillageState => {
  const sites = villageSitesNear(worldSeed, playerPosition, VILLAGE_ACTIVATION_DISTANCE)
  if (sites.length === 0) return state
  let villages = state.villages
  let nextVillageNumber = state.nextVillageNumber
  for (const site of sites) {
    const occupied = villages.some(
      (village) => Math.floor(village.center.x) === site.x && Math.floor(village.center.z) === site.z,
    )
    if (occupied) continue
    // Nominal y from the player: structures are grounded to real terrain at
    // placement time; villager y rides this approximation like before.
    const center = snapVillageCenter({ x: site.x, y: playerPosition.y, z: site.z })
    villages = Arr.append(villages, createVillage(nextVillageNumber, { x: site.x, y: center.y, z: site.z }))
    nextVillageNumber += 1
  }
  if (villages === state.villages) return state
  return { ...state, villages, nextVillageNumber }
}

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
