import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { runMobMaintenance } from '@ts-minecraft/entity/application/mob/mob-maintenance';
import { EntityId } from '@ts-minecraft/entity/domain/mob/entity';
import { expectSome, makeTerrainChunk } from './test-utils'

type MobMaintenanceServices = Parameters<typeof runMobMaintenance>[0]

type MobMaintenanceOverrides = Partial<{
  readonly despawnFarEntities: MobMaintenanceServices['entityManager']['despawnFarEntities']
  readonly despawnAllEntities: MobMaintenanceServices['entityManager']['despawnAllEntities']
  readonly getChunk: MobMaintenanceServices['chunkManagerService']['getChunk']
  readonly trySpawn: MobMaintenanceServices['mobSpawner']['trySpawn']
}>

const createMobMaintenanceServices = (overrides: MobMaintenanceOverrides = {}): MobMaintenanceServices => ({
  entityManager: {
    despawnFarEntities: overrides.despawnFarEntities ?? (() => Effect.succeed(0)),
    despawnAllEntities: overrides.despawnAllEntities ?? (() => Effect.succeed(0)),
  },
  chunkManagerService: {
    getChunk: overrides.getChunk ?? (() => Effect.succeed(makeTerrainChunk())),
  },
  mobSpawner: {
    trySpawn: overrides.trySpawn ?? (() => Effect.succeed(Option.none())),
  },
})

describe('entity/mob-maintenance', () => {
  it.effect('despawns all entities when mobs are disabled', () =>
    Effect.gen(function* () {
      let despawnFarCalls = 0
      let despawnAllCalls = 0
      let trySpawnCalls = 0

      const result = yield* runMobMaintenance(
        createMobMaintenanceServices({
          despawnFarEntities: () => {
            despawnFarCalls += 1
            return Effect.succeed(3)
          },
          despawnAllEntities: () => {
            despawnAllCalls += 1
            return Effect.succeed(7)
          },
          trySpawn: () => {
            trySpawnCalls += 1
            return Effect.succeed(Option.some(EntityId.make('mob-test')))
          },
        }),
        {
          playerPos: { x: 0, y: 64, z: 0 },
          maintenanceDeltaTime: 0.05,
          mobsEnabled: false,
          mobsSpawnEnabled: false,
          timeOfDay: 0.5,
        },
      )

      expect(despawnFarCalls).toBe(0)
      expect(despawnAllCalls).toBe(1)
      expect(trySpawnCalls).toBe(0)
      expect(result.despawnedCount).toBe(7)
      expect(Option.isNone(result.spawnResult)).toBe(true)
    }))

  it.effect('despawns far entities when mobs are enabled', () =>
    Effect.gen(function* () {
      let despawnFarArgs: readonly [number, number] | undefined
      let despawnAllCalls = 0

      const result = yield* runMobMaintenance(
        createMobMaintenanceServices({
          despawnFarEntities: (playerPosition, maxDistance) => {
            despawnFarArgs = [playerPosition.x, maxDistance]
            return Effect.succeed(4)
          },
          despawnAllEntities: () => {
            despawnAllCalls += 1
            return Effect.succeed(11)
          },
        }),
        {
          playerPos: { x: 9, y: 64, z: -3 },
          maintenanceDeltaTime: 0.05,
          mobsEnabled: true,
          mobsSpawnEnabled: false,
          timeOfDay: 0.5,
        },
      )

      expect(despawnFarArgs).toEqual([9, 64])
      expect(despawnAllCalls).toBe(0)
      expect(result.despawnedCount).toBe(4)
      expect(Option.isNone(result.spawnResult)).toBe(true)
    }))

  it.effect('skips spawning when mob spawning is disabled', () =>
    Effect.gen(function* () {
      let getChunkCalls = 0
      let trySpawnCalls = 0

      const result = yield* runMobMaintenance(
        createMobMaintenanceServices({
          getChunk: () => {
            getChunkCalls += 1
            return Effect.succeed(makeTerrainChunk())
          },
          trySpawn: () => {
            trySpawnCalls += 1
            return Effect.succeed(Option.some(EntityId.make('mob-test')))
          },
        }),
        {
          playerPos: { x: 16.5, y: 64, z: 16.5 },
          maintenanceDeltaTime: 0.05,
          mobsEnabled: true,
          mobsSpawnEnabled: false,
          timeOfDay: 0.9,
        },
      )

      expect(getChunkCalls).toBe(0)
      expect(trySpawnCalls).toBe(0)
      expect(Option.isNone(result.spawnResult)).toBe(true)
    }))

  it.effect('resolves a terrain-aware spawn position from the candidate chunk', () =>
    Effect.gen(function* () {
      let observedCoord: { readonly x: number; readonly z: number } | undefined
      let observedResolverResult: Option.Option<{
        readonly x: number
        readonly y: number
        readonly z: number
      }> | undefined

      const chunk = makeTerrainChunk(
        [{ lx: 1, y: 60, lz: 1, blockType: 'STONE' }],
        { coord: { x: 1, z: 1 } },
      )

      const result = yield* runMobMaintenance(
        createMobMaintenanceServices({
          getChunk: (coord) => {
            observedCoord = coord
            return Effect.succeed(chunk)
          },
          trySpawn: (_playerPosition, spawnResolver) => {
            if (spawnResolver === undefined) {
              throw new Error('expected spawn resolver')
            }

            return Effect.gen(function* () {
              observedResolverResult = yield* spawnResolver({ x: 17.5, y: 64, z: 17.5 })
              return Option.some(EntityId.make('mob-test'))
            })
          },
        }),
        {
          playerPos: { x: 17.5, y: 64, z: 17.5 },
          maintenanceDeltaTime: 0.05,
          mobsEnabled: true,
          mobsSpawnEnabled: true,
          timeOfDay: 0.9,
        },
      )

      expect(observedCoord).toEqual({ x: 1, z: 1 })
      expect(observedResolverResult).toBeDefined()
      const resolved = expectSome(observedResolverResult!)
      expectSome(result.spawnResult)
      expect(resolved.x).toBe(17.5)
      expect(resolved.z).toBe(17.5)
      expect(resolved.y).toBeCloseTo(61.9)
    }))
})
