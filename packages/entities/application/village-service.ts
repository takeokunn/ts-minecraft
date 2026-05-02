import { Array as Arr, Effect, Option, Ref } from 'effect'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/kernel'
import {
  VillageId,
  VillageStructureId,
  VillagerId,
  VillagerActivity,
  VillagerProfession,
  villagerLevelFromExperience,
  type Village,
  type Villager,
  type VillageStructure,
} from '../domain/village-model'
import {
  STRUCTURE_TEMPLATES,
  VILLAGER_TEMPLATES,
  buildAnchor,
  buildStructureId,
  buildVillagerId,
} from './village-service.config'
import {
  VILLAGE_NEAR_DISTANCE,
  distanceSq,
  moveTowards,
  findNearestVillage,
  findStructureAnchor,
  snapVillageCenter,
  flattenVillagers,
  nextActivityForVillager,
  getTargetPosition,
} from '../domain/village-simulation'

const VILLAGER_MOVE_SPEED = 0.045

const findClosestVillagerInRange = (
  villagers: ReadonlyArray<Villager>,
  position: Position,
  maxDistanceSq: number,
): Option.Option<Villager> =>
  Arr.reduce(villagers, Option.none<Villager>(), (closest, villager) => {
    const dSq = distanceSq(villager.position, position)
    if (dSq > maxDistanceSq) return closest
    return Option.match(closest, {
      onNone: () => Option.some(villager),
      onSome: (current) => dSq < distanceSq(current.position, position) ? Option.some(villager) : closest,
    })
  })

type VillageState = {
  readonly villages: ReadonlyArray<Village>
  readonly nextVillageNumber: number
  readonly updateTick: number
}

const INITIAL_STATE: VillageState = {
  villages: [],
  nextVillageNumber: 1,
  updateTick: 0,
}

const createVillage = (villageNumber: number, center: Position): Village => {
  const villageId = VillageId.make(`village-${villageNumber}`)
  const structureId = (suffix: string): VillageStructureId =>
    VillageStructureId.make(buildStructureId(villageId, suffix))

  const structures: ReadonlyArray<VillageStructure> = Arr.map(STRUCTURE_TEMPLATES, (template) => ({
    structureId: structureId(template.suffix),
    type: template.type,
    anchor: buildAnchor(center, template),
    size: { x: template.sizeX, y: template.sizeY, z: template.sizeZ },
  }))

  const villagers: ReadonlyArray<Villager> = Arr.map(VILLAGER_TEMPLATES, (template) => ({
    villagerId: VillagerId.make(buildVillagerId(villageId, template.suffix)),
    villageId,
    profession: VillagerProfession[template.profession],
    homeStructureId: structureId(template.homeStructureSuffix),
    workplaceStructureId: structureId(template.workplaceStructureSuffix),
    level: 1,
    experience: 0,
    position: findStructureAnchor(structures, structureId(template.homeStructureSuffix), center),
    activity: VillagerActivity.Idle,
  }))

  return {
    villageId,
    center,
    structures,
    villagers,
  }
}

const ensureVillageInState = (
  state: VillageState,
  playerPosition: Position,
): readonly [VillageState, Village] =>
  Option.match(findNearestVillage(state.villages, playerPosition), {
    onNone: () => {
      const village = createVillage(state.nextVillageNumber, snapVillageCenter(playerPosition))
      return [
        {
          ...state,
          villages: Arr.append(state.villages, village),
          nextVillageNumber: state.nextVillageNumber + 1,
        },
        village,
      ] as const
    },
    onSome: (nearestVillage) => {
      if (distanceSq(nearestVillage.center, playerPosition) <= VILLAGE_NEAR_DISTANCE * VILLAGE_NEAR_DISTANCE) {
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
    },
  })

export class VillageService extends Effect.Service<VillageService>()(
  '@minecraft/village/VillageService',
  {
    effect: Ref.make<VillageState>(INITIAL_STATE).pipe(Effect.map((stateRef) => ({
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
            const maxMoveDelta = Math.max(0, VILLAGER_MOVE_SPEED * deltaTime * 60)

            const villages = Arr.map(ensuredState.villages, (village) => ({
              ...village,
              villagers: Arr.map(village.villagers, (villager) => {
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
              }),
            }))

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
