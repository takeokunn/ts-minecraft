import { Effect, Option, Ref } from 'effect'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import {
  VillagerId,
  type Village,
  type Villager,
  flattenVillagers,
  awardVillagerExperience,
  findClosestVillagerInRange,
  findVillagerById,
  INITIAL_VILLAGE_STATE,
  advanceVillageState,
  ensureVillageInState,
  type VillageState,
} from '../../domain/village'

export class VillageService extends Effect.Service<VillageService>()(
  '@minecraft/village/VillageService',
  {
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<VillageState>(INITIAL_VILLAGE_STATE)
      return {
        ensureVillageNear: (playerPosition: Position): Effect.Effect<Village, never> =>
          Ref.modify(stateRef, (state): [Village, VillageState] => {
            const [nextState, village] = ensureVillageInState(state, playerPosition)
            return [village, nextState]
          }),

        getVillages: (): Effect.Effect<ReadonlyArray<Village>, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return state.villages
          }),

        getVillagers: (): Effect.Effect<ReadonlyArray<Villager>, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return flattenVillagers(state.villages)
          }),

        getVillager: (villagerId: VillagerId): Effect.Effect<Option.Option<Villager>, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return findVillagerById(state.villages, villagerId)
          }),

        findNearestVillager: (
          position: Position,
          maxDistance: number,
        ): Effect.Effect<Option.Option<Villager>, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return findClosestVillagerInRange(flattenVillagers(state.villages), position, maxDistance * maxDistance)
          }),

        addVillagerExperience: (
          villagerId: VillagerId,
          amount: number,
        ): Effect.Effect<Option.Option<Villager>, never> => {
          return Ref.modify(stateRef, (state): [Option.Option<Villager>, VillageState] => {
            const [updatedVillager, villages] = awardVillagerExperience(state.villages, villagerId, amount)
            return [updatedVillager, { ...state, villages }]
          })
        },

        update: (
          playerPosition: Position,
          timeOfDay: number,
          deltaTime: DeltaTimeSecs,
        ): Effect.Effect<void, never> =>
          Ref.update(stateRef, (state) => advanceVillageState(state, playerPosition, timeOfDay, deltaTime)),
      }
    }),
  },
) {}
