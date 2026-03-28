import { Array as Arr, Effect, Option, Ref } from 'effect'
import type { DeltaTimeSecs, Position } from '@/shared/kernel'
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
} from '@/village/village-model'

const VILLAGE_GRID_SIZE = 96
const VILLAGE_NEAR_DISTANCE = 80
const TRADE_DISTANCE = 4
const VILLAGER_MOVE_SPEED = 0.045

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

const distanceTo = (a: Position, b: Position): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

const hashString = (source: string): number => {
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

const moveTowards = (from: Position, to: Position, maxDelta: number): Position => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

  if (distance === 0 || distance <= maxDelta) {
    return to
  }

  return {
    x: from.x + (dx / distance) * maxDelta,
    y: from.y + (dy / distance) * maxDelta,
    z: from.z + (dz / distance) * maxDelta,
  }
}

const findNearestVillage = (
  villages: ReadonlyArray<Village>,
  position: Position,
): Option.Option<Village> =>
  Arr.reduce(villages, Option.none<Village>(), (closest, village) =>
    Option.match(closest, {
      onNone: () => Option.some(village),
      onSome: (current) =>
        distanceTo(village.center, position) < distanceTo(current.center, position)
          ? Option.some(village)
          : closest,
    })
  )

const snapVillageCenter = (position: Position): Position => ({
  x: Math.floor(position.x / VILLAGE_GRID_SIZE) * VILLAGE_GRID_SIZE + VILLAGE_GRID_SIZE / 2,
  y: Math.max(64, Math.round(position.y)),
  z: Math.floor(position.z / VILLAGE_GRID_SIZE) * VILLAGE_GRID_SIZE + VILLAGE_GRID_SIZE / 2,
})

const createVillage = (villageNumber: number, center: Position): Village => {
  const villageId = VillageId.make(`village-${villageNumber}`)
  const structureId = (suffix: string): VillageStructureId => VillageStructureId.make(`${villageId}:${suffix}`)

  const structures: ReadonlyArray<VillageStructure> = [
    {
      structureId: structureId('well'),
      type: 'well',
      anchor: { x: center.x, y: center.y, z: center.z },
      size: { x: 3, y: 4, z: 3 },
    },
    {
      structureId: structureId('road-main'),
      type: 'road',
      anchor: { x: center.x - 12, y: center.y, z: center.z },
      size: { x: 24, y: 1, z: 3 },
    },
    {
      structureId: structureId('house-a'),
      type: 'house',
      anchor: { x: center.x - 8, y: center.y, z: center.z - 8 },
      size: { x: 6, y: 5, z: 6 },
    },
    {
      structureId: structureId('house-b'),
      type: 'house',
      anchor: { x: center.x + 2, y: center.y, z: center.z - 8 },
      size: { x: 6, y: 5, z: 6 },
    },
    {
      structureId: structureId('house-c'),
      type: 'house',
      anchor: { x: center.x + 8, y: center.y, z: center.z + 2 },
      size: { x: 6, y: 5, z: 6 },
    },
    {
      structureId: structureId('farm'),
      type: 'farm',
      anchor: { x: center.x - 10, y: center.y, z: center.z + 6 },
      size: { x: 8, y: 1, z: 8 },
    },
  ]

  const byId = (id: string): Position =>
    Option.getOrElse(
      Arr.findFirst(structures, (structure) => structure.structureId === id).pipe(
        Option.map((structure) => structure.anchor),
      ),
      () => center,
    )

  const villagers: ReadonlyArray<Villager> = [
    {
      villagerId: VillagerId.make(`${villageId}:villager-farmer`),
      villageId,
      profession: VillagerProfession.Farmer,
      homeStructureId: structureId('house-a'),
      workplaceStructureId: structureId('farm'),
      level: 1,
      experience: 0,
      position: byId(structureId('house-a')),
      activity: VillagerActivity.Idle,
    },
    {
      villagerId: VillagerId.make(`${villageId}:villager-librarian`),
      villageId,
      profession: VillagerProfession.Librarian,
      homeStructureId: structureId('house-b'),
      workplaceStructureId: structureId('well'),
      level: 1,
      experience: 0,
      position: byId(structureId('house-b')),
      activity: VillagerActivity.Idle,
    },
    {
      villagerId: VillagerId.make(`${villageId}:villager-blacksmith`),
      villageId,
      profession: VillagerProfession.Blacksmith,
      homeStructureId: structureId('house-c'),
      workplaceStructureId: structureId('road-main'),
      level: 1,
      experience: 0,
      position: byId(structureId('house-c')),
      activity: VillagerActivity.Idle,
    },
  ]

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
      if (distanceTo(nearestVillage.center, playerPosition) <= VILLAGE_NEAR_DISTANCE) {
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

const getTargetPosition = (
  village: Village,
  villager: Villager,
  nextActivity: VillagerActivity,
  tick: number,
): Position => {
  const findStructurePosition = (structureId: VillageStructureId): Position =>
    Option.getOrElse(
      Arr.findFirst(village.structures, (structure) => structure.structureId === structureId).pipe(
        Option.map((structure) => structure.anchor),
      ),
      () => villager.position,
    )

  if (nextActivity === VillagerActivity.Work) {
    return findStructurePosition(villager.workplaceStructureId)
  }

  const homePosition = findStructurePosition(villager.homeStructureId)
  if (nextActivity === VillagerActivity.Rest) {
    return homePosition
  }

  if (nextActivity === VillagerActivity.Wander) {
    const phase = (hashString(villager.villagerId) + tick * 9) % 360
    const angle = phase * (Math.PI / 180)
    return {
      x: homePosition.x + Math.cos(angle) * 2,
      y: homePosition.y,
      z: homePosition.z + Math.sin(angle) * 2,
    }
  }

  return villager.position
}

const nextActivityForVillager = (
  villager: Villager,
  playerPosition: Position,
  timeOfDay: number,
): VillagerActivity => {
  if (distanceTo(villager.position, playerPosition) <= TRADE_DISTANCE) {
    return VillagerActivity.Trade
  }

  if (timeOfDay < 0.22 || timeOfDay > 0.78) {
    return VillagerActivity.Rest
  }

  if (timeOfDay >= 0.28 && timeOfDay <= 0.72) {
    return VillagerActivity.Work
  }

  return VillagerActivity.Wander
}

const flattenVillagers = (villages: ReadonlyArray<Village>): ReadonlyArray<Villager> =>
  Arr.flatMap(villages, (village) => village.villagers)

export class VillageService extends Effect.Service<VillageService>()(
  '@minecraft/village/VillageService',
  {
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<VillageState>(INITIAL_STATE)

      return {
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
              Arr.reduce(flattenVillagers(state.villages), Option.none<Villager>(), (closest, villager) => {
                const villagerDistance = distanceTo(villager.position, position)
                if (villagerDistance > maxDistance) {
                  return closest
                }

                return Option.match(closest, {
                  onNone: () => Option.some(villager),
                  onSome: (current) =>
                    villagerDistance < distanceTo(current.position, position)
                      ? Option.some(villager)
                      : closest,
                })
              })
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
      }
    }),
  },
) {}

export const VillageServiceLive = VillageService.Default
