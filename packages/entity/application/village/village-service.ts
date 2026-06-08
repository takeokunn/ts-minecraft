import { Array as Arr, Effect, Option, Ref } from 'effect'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import {
  VillagerId,
  VillagerActivity,
  type Village,
  type Villager,
} from '../../domain/village/village-model'
import {
  VILLAGE_SIMULATION_DISTANCE,
  distanceSq,
  moveTowards,
  nextActivityForVillager,
  getTargetPosition,
  villagerLevelFromExperience,
} from '../../domain/village/village-simulation'
import {
  type VillageState,
  INITIAL_VILLAGE_STATE,
  createVillage as _createVillage,
  ensureVillageInState,
  findClosestVillagerInRange,
  flattenVillagers,
} from './village-factory'

const VILLAGER_MOVE_SPEED = 0.045

/**
 * Pure per-villager AI + movement tick.
 * Extracted from the `update` loop to reduce nesting and allow independent unit testing.
 */
const tickVillager = (
  villager: Villager,
  village: Village,
  playerPosition: Position,
  timeOfDay: number,
  tick: number,
  maxMoveDelta: number,
): Villager => {
  const nextActivity = nextActivityForVillager(villager, playerPosition, timeOfDay)
  const target = getTargetPosition(village, villager, nextActivity, tick)
  const nextPosition =
    nextActivity === VillagerActivity.Trade
      ? villager.position
      : moveTowards(villager.position, target, maxMoveDelta)

  if (nextActivity === villager.activity && nextPosition === villager.position) {
    return villager
  }

  return {
    ...villager,
    activity: nextActivity,
    position: nextPosition,
  }
}

export class VillageService extends Effect.Service<VillageService>()(
  '@minecraft/village/VillageService',
  {
    effect: Ref.make<VillageState>(INITIAL_VILLAGE_STATE).pipe(Effect.map((stateRef) => ({
        ensureVillageNear: (playerPosition: Position): Effect.Effect<Village, never> =>
          Ref.modify(stateRef, (state): [Village, VillageState] => {
            const [nextState, village] = ensureVillageInState(state, playerPosition)
            return [village, nextState]
          }),

        getVillages: (): Effect.Effect<ReadonlyArray<Village>, never> =>
          Ref.get(stateRef).pipe(Effect.map((state) => state.villages)),

        getVillagers: (): Effect.Effect<ReadonlyArray<Villager>, never> =>
          Ref.get(stateRef).pipe(Effect.map((state) => flattenVillagers(state.villages))),

        getVillager: (villagerId: VillagerId): Effect.Effect<Option.Option<Villager>, never> =>
          Ref.get(stateRef).pipe(
            Effect.map((state) => Arr.findFirst(flattenVillagers(state.villages), (villager) => villager.villagerId === villagerId))
          ),

        findNearestVillager: (
          position: Position,
          maxDistance: number,
        ): Effect.Effect<Option.Option<Villager>, never> =>
          Ref.get(stateRef).pipe(
            Effect.map((state) =>
              findClosestVillagerInRange(flattenVillagers(state.villages), position, maxDistance * maxDistance)
            )
          ),

        addVillagerExperience: (
          villagerId: VillagerId,
          amount: number,
        ): Effect.Effect<Option.Option<Villager>, never> => {
          if (amount <= 0) {
            return Effect.succeed(Option.none())
          }

          return Ref.modify(stateRef, (state): [Option.Option<Villager>, VillageState] => {
            const updatedVillager: Option.Option<Villager> = Option.map(
              Arr.findFirst(flattenVillagers(state.villages), (v) => v.villagerId === villagerId),
              (v) => {
                const nextExperience = v.experience + amount
                return { ...v, experience: nextExperience, level: villagerLevelFromExperience(nextExperience) }
              },
            )

            const villages = Arr.map(state.villages, (village) => ({
              ...village,
              villagers: Arr.map(village.villagers, (villager) => {
                if (villager.villagerId !== villagerId) return villager
                return Option.getOrElse(updatedVillager, () => villager)
              }),
            }))

            return [updatedVillager, { ...state, villages }]
          })
        },

        update: (
          playerPosition: Position,
          timeOfDay: number,
          deltaTime: DeltaTimeSecs,
        ): Effect.Effect<void, never> =>
          Ref.update(stateRef, (state) => {
            const [ensuredState] = ensureVillageInState(state, playerPosition)
            const tick = ensuredState.updateTick + 1
            // Normalise speed (defined at 60 fps reference rate) to actual frame duration.
            const maxMoveDelta = Math.max(0, VILLAGER_MOVE_SPEED * deltaTime * 60)

            const villages = Arr.map(ensuredState.villages, (village) => {
              // Freeze villages far from the player: their villagers are unobservable,
              // so skip per-villager AI/movement. State is preserved — a frozen village
              // resumes from its last positions when the player returns.
              if (distanceSq(village.center, playerPosition) > VILLAGE_SIMULATION_DISTANCE * VILLAGE_SIMULATION_DISTANCE) {
                return village
              }
              return {
                ...village,
                villagers: Arr.map(village.villagers, (villager) =>
                  tickVillager(villager, village, playerPosition, timeOfDay, tick, maxMoveDelta)
                ),
              }
            })

            return {
              ...ensuredState,
              villages,
              updateTick: tick,
            }
          }),
    })))
  },
) {}

export const VillageServiceLive = VillageService.Default
