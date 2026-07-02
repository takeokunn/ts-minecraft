import { describe, expect, it } from '@effect/vitest'
import { Effect, HashMap, Layer, Option, Ref } from 'effect'
import { fortressSiteForRegion, isNearFortressSite, FORTRESS_BLAZE_RADIUS } from '@ts-minecraft/world'
import { TimeServicePort } from '../../domain/time-service-port'
import { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import { MobSpawner } from '@ts-minecraft/entity/application/mob/spawner'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { NETHER_HOSTILE_MOBS } from '@ts-minecraft/entity/domain/mob/mob-categories'
import { getMobDefinition } from '../../domain/mob/mobs/get-mob-definition'
import { selectMobType } from '../../application/mob/mob-spawner-helpers'
import { BLAZE_IGNITE_SECS } from '../../application/mob/entity-manager-combat'
import { resolveNetherSpawnPosition } from '../../domain/mob/terrain-spawn'
import { MOB_HALF_HEIGHT } from '../../domain/mob/spawner-config'
import {
  itEntityManagerInternalEffect,
  makeTerrainChunk,
  makeTestManagedEntity,
  type TerrainBlockFixture,
} from './test-utils'

// Deterministic fortress site: 30% of regions roll a fortress, so a small
// scan always finds one (and a miss for the "away" case).
const findFortressSite = () => {
  for (let regionX = 0; regionX < 40; regionX++) {
    for (let regionZ = 0; regionZ < 40; regionZ++) {
      const site = fortressSiteForRegion(regionX, regionZ)
      if (site !== null) return site
    }
  }
  throw new Error('no fortress site in scan range')
}

const findPositionAwayFromFortresses = () => {
  for (let x = 0; x < 100000; x += 173) {
    if (!isNearFortressSite(x, 31)) return { x, z: 31 }
  }
  throw new Error('no fortress-free position in scan range')
}

describe('blaze', () => {
  describe('definition', () => {
    it('is a hostile ranged mob dropping blaze rods', () => {
      const def = getMobDefinition(EntityType.Blaze)
      expect(def.behavior).toBe('hostile')
      expect(def.attackRange).toBeGreaterThan(1.5)
      expect(def.drops).toContainEqual({ blockType: 'BLAZE_ROD', count: 1, chance: 0.5 })
    })
  })

  describe('isNearFortressSite', () => {
    it('is true at a fortress site and false far away', () => {
      const site = findFortressSite()
      expect(isNearFortressSite(site.x, site.z)).toBe(true)
      expect(isNearFortressSite(site.x + FORTRESS_BLAZE_RADIUS - 1, site.z)).toBe(true)
      const away = findPositionAwayFromFortresses()
      expect(isNearFortressSite(away.x, away.z)).toBe(false)
    })
  })

  describe('selectMobType', () => {
    it('selects a Blaze in the nether near a fortress', () => {
      const site = findFortressSite()
      const spawnPosition = { x: site.x, y: 49 + MOB_HALF_HEIGHT, z: site.z }
      for (let cursor = 0; cursor < 5; cursor++) {
        expect(selectMobType(true, cursor, 'nether', spawnPosition)).toBe(EntityType.Blaze)
      }
    })

    it('rotates the nether roster away from fortresses, at any hour', () => {
      const away = findPositionAwayFromFortresses()
      const spawnPosition = { x: away.x, y: 64, z: away.z }
      // isNight=false: the nether has no day/night, hostiles spawn regardless.
      const picked = selectMobType(false, 1, 'nether', spawnPosition)
      expect(NETHER_HOSTILE_MOBS).toContain(picked)
      expect(picked).not.toBe(EntityType.Blaze)
    })

    it('spawns only endermen in the end', () => {
      expect(selectMobType(false, 3, 'end', { x: 100, y: 65, z: 100 })).toBe(EntityType.Enderman)
    })

    it('keeps the overworld rotation unchanged', () => {
      expect(selectMobType(false, 0, 'overworld')).toBe(EntityType.Cow)
      expect(selectMobType(true, 0, 'overworld')).toBe(EntityType.Zombie)
    })
  })

  describe('resolveNetherSpawnPosition', () => {
    const roofedColumn = (options: { readonly cavernFloorY: number; readonly lavaGround?: boolean }) => {
      const fixtures: TerrainBlockFixture[] = []
      for (let y = 0; y <= 123; y++) {
        // Carve the 2-tall cavern pocket above the floor; everything else rock.
        if (y === options.cavernFloorY + 1 || y === options.cavernFloorY + 2) continue
        const blockType = options.lavaGround === true && y === options.cavernFloorY ? 'LAVA' : 'NETHERRACK'
        fixtures.push({ lx: 8, y, lz: 8, blockType })
      }
      return makeTerrainChunk(fixtures)
    }

    it('finds a cavern pocket near the candidate height (the roofed nether defeats top-down scans)', () => {
      const chunk = roofedColumn({ cavernFloorY: 60 })
      const result = resolveNetherSpawnPosition(chunk, { x: 8.5, y: 60, z: 8.5 })
      expect(Option.getOrThrow(result)).toEqual({ x: 8.5, y: 61 + MOB_HALF_HEIGHT, z: 8.5 })
    })

    it('refuses to spawn on lava', () => {
      const chunk = roofedColumn({ cavernFloorY: 60, lavaGround: true })
      expect(Option.isNone(resolveNetherSpawnPosition(chunk, { x: 8.5, y: 60, z: 8.5 }))).toBe(true)
    })

    it('returns none for a fully solid column', () => {
      const fixtures: TerrainBlockFixture[] = []
      for (let y = 0; y <= 123; y++) fixtures.push({ lx: 8, y, lz: 8, blockType: 'NETHERRACK' })
      expect(Option.isNone(resolveNetherSpawnPosition(makeTerrainChunk(fixtures), { x: 8.5, y: 60, z: 8.5 }))).toBe(true)
    })
  })

  describe('ranged fireball + ignite', () => {
    itEntityManagerInternalEffect('a blaze shot damages and ignites the player', ({ entitiesRef, internal }) =>
      Effect.gen(function* () {
        const blaze = makeTestManagedEntity({
          entityId: EntityId.make('entity-blaze-ranged'),
          type: EntityType.Blaze,
          position: { x: 0, y: 64, z: 0 },
        })
        yield* Ref.set(entitiesRef, HashMap.set(HashMap.empty(), blaze.entityId, blaze))

        const damage = yield* internal.getPlayerRangedDamage({ x: 10, y: 64, z: 0 })

        expect(damage).toBe(getMobDefinition(EntityType.Blaze).attackDamage)
        expect(yield* internal.drainPlayerIgniteSecs()).toBe(BLAZE_IGNITE_SECS)
        // Drained: a second read must not re-ignite.
        expect(yield* internal.drainPlayerIgniteSecs()).toBe(0)
      }))

    itEntityManagerInternalEffect('skeleton shots never ignite', ({ entitiesRef, internal }) =>
      Effect.gen(function* () {
        const skeleton = makeTestManagedEntity({
          entityId: EntityId.make('entity-skeleton-no-ignite'),
          type: EntityType.Skeleton,
          position: { x: 0, y: 64, z: 0 },
        })
        yield* Ref.set(entitiesRef, HashMap.set(HashMap.empty(), skeleton.entityId, skeleton))

        const damage = yield* internal.getPlayerRangedDamage({ x: 10, y: 64, z: 0 })

        expect(damage).toBeGreaterThan(0)
        expect(yield* internal.drainPlayerIgniteSecs()).toBe(0)
      }))

    itEntityManagerInternalEffect('blazes deal no contact damage', ({ entitiesRef, internal }) =>
      Effect.gen(function* () {
        const blaze = makeTestManagedEntity({
          entityId: EntityId.make('entity-blaze-contact'),
          type: EntityType.Blaze,
          position: { x: 0.5, y: 64, z: 0 },
        })
        yield* Ref.set(entitiesRef, HashMap.set(HashMap.empty(), blaze.entityId, blaze))

        const resolution = yield* internal.getPlayerContactDamageResolution({ x: 0, y: 64, z: 0 })

        expect(resolution.damage).toBe(0)
      }))
  })

  describe('nether spawner integration', () => {
    const makeTimeLayer = (night: boolean) =>
      Layer.succeed(TimeServicePort, TimeServicePort.of({
        _tag: '@minecraft/entity/domain/TimeServicePort' as const,
        isNight: () => Effect.succeed(night),
      }))

    const makeSpawnerLayer = (night: boolean) =>
      Layer.mergeAll(
        EntityManager.Default,
        MobSpawner.Default.pipe(
          Layer.provide(EntityManager.Default),
          Layer.provide(makeTimeLayer(night)),
        ),
      )

    it.effect('trySpawn in the nether near a fortress produces a Blaze even during the day', () =>
      Effect.gen(function* () {
        const spawner = yield* MobSpawner
        const entityManager = yield* EntityManager
        const site = findFortressSite()
        const playerPosition = { x: site.x - 20, y: 49, z: site.z }
        const resolvedSpawn = { x: site.x, y: 49 + MOB_HALF_HEIGHT, z: site.z }

        const found = yield* spawner.trySpawn(
          playerPosition,
          () => Effect.succeed(Option.some(resolvedSpawn)),
          undefined,
          'nether',
        )

        expect(Option.isSome(found)).toBe(true)
        const entities = yield* entityManager.getEntities()
        expect(entities[0]?.type).toBe(EntityType.Blaze)
      }).pipe(Effect.provide(makeSpawnerLayer(false))))
  })
})
