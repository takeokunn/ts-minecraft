import { Effect, Option, HashMap } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import * as S from "/schema/Schema"
import { createArchetype, type ArchetypeBuilder } from '@/domain/archetypes'
import { createQuery } from '@/core/queries'
import { Position, ComponentName, Chunk } from '@/core/components'
import { WorldLive } from '@/infrastructure/world'
import { World } from '@/runtime/services'
import { ArchetypeBuilderArb, PositionArb } from '@test/arbitraries'
import { BlockType } from '@/core/values/block-type'
import { CHUNK_HEIGHT } from '@/domain/world-constants'

// Helper to set up a world with some archetypes
const setupWorldWithArchetypes = (builders: readonly ArchetypeBuilder[]) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    const archetypes = yield* _(Effect.all(builders.map(createArchetype)))
    const entityIds = yield* _(Effect.all(archetypes.map((arch) => world.addArchetype(arch))))
    return { world, entityIds, archetypes }
  })

const createPlayerArchetype = createArchetype({
  type: 'player',
  pos: S.decodeSync(Position)({ x: 0, y: 80, z: 0 }),
})

describe('World', () => {
  it.effect('should add an archetype and retrieve a component', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = yield* _(createPlayerArchetype)
      const entityId = yield* _(world.addArchetype(playerArchetype))
      const positionOpt = yield* _(world.getComponent(entityId, 'position'))

      assert.isTrue(Option.isSome(positionOpt))
      const position = Option.getOrThrow(positionOpt)
      assert.strictEqual(position.x, 0)
      assert.strictEqual(position.y, 80)
      assert.strictEqual(position.z, 0)
    }).pipe(Effect.provide(WorldLive)))

  it.effect('should update a component', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = yield* _(createPlayerArchetype)
      const entityId = yield* _(world.addArchetype(playerArchetype))

      yield* _(world.updateComponent(entityId, 'position', S.decodeSync(Position)({ x: 1, y: 2, z: 3 })))

      const position = yield* _(world.getComponentUnsafe(entityId, 'position'))
      assert.strictEqual(position.x, 1)
      assert.strictEqual(position.y, 2)
      assert.strictEqual(position.z, 3)
    }).pipe(Effect.provide(WorldLive)))

  it.effect('should correctly add and remove entities', () =>
    Effect.gen(function* (_) {
      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(
              fc.array(ArchetypeBuilderArb),
              fc.array(fc.integer()),
              async (builders, indicesToRemove) =>
                Effect.gen(function* (_) {
                  const { world, entityIds } = yield* _(setupWorldWithArchetypes(builders))

                  const idsToRemove = new Set(
                    indicesToRemove.map((i) => entityIds[i % entityIds.length]).filter(Boolean),
                  )

                  for (const entityId of idsToRemove) {
                    yield* _(world.removeEntity(entityId))
                  }

                  const allEntitiesInWorld = yield* _(
                    world.state.pipe(Effect.map((s) => Array.from(HashMap.keys(s.entities)))),
                  )

                  for (const removedId of idsToRemove) {
                    assert.isFalse(
                      allEntitiesInWorld.includes(removedId),
                      `Removed entity ${removedId} should not be in world state`,
                    )
                    const component = yield* _(world.getComponent(removedId, 'position'))
                    assert.isTrue(
                      Option.isNone(component),
                      `Component of removed entity ${removedId} should be None`,
                    )
                  }
                }).pipe(Effect.provide(WorldLive), Effect.runPromise),
            ),
          ),
        ),
      )
    }))

  it.effect('should update a component correctly', () =>
    Effect.gen(function* (_) {
      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(
              fc.array(ArchetypeBuilderArb, { minLength: 1 }),
              PositionArb,
              async (builders, newPosition) =>
                Effect.gen(function* (_) {
                  const { world } = yield* _(setupWorldWithArchetypes(builders))
                  const entitiesWithPosition = yield* _(world.query(createQuery('posQuery', ['position'])))
                  if (entitiesWithPosition.length === 0) return

                  const entityToUpdate = entitiesWithPosition[0][0]

                  yield* _(world.updateComponent(entityToUpdate, 'position', newPosition))

                  const updatedPosition = yield* _(world.getComponentUnsafe(entityToUpdate, 'position'))
                  assert.deepStrictEqual(updatedPosition, newPosition)
                }).pipe(Effect.provide(WorldLive), Effect.runPromise),
            ),
          ),
        ),
      )
    }))

  it.effect('getVoxel and setVoxel should be consistent', () =>
    Effect.gen(function* (_) {
      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(
              fc.integer({ min: -100, max: 100 }),
              fc.integer({ min: 0, max: CHUNK_HEIGHT - 1 }),
              fc.integer({ min: -100, max: 100 }),
              fc.constantFrom('stone', 'dirt', 'grass') as fc.Arbitrary<BlockType>,
              async (x, y, z, blockType) =>
                Effect.gen(function* (_) {
                  const world = yield* _(World)
                  const voxel = { position: [x, y, z] as any, blockType }

                  // Ensure chunk exists
                  const chunkX = Math.floor(x / 16)
                  const chunkZ = Math.floor(z / 16)
                  const blocks = Array(32768).fill('air') as BlockType[]
                  const chunk = S.decodeSync(Chunk)({ chunkX, chunkZ, blocks })
                  yield* _(world.setChunk(chunkX, chunkZ, chunk))

                  yield* _(world.setVoxel(x, y, z, voxel))
                  const retrievedVoxelOpt = yield* _(world.getVoxel(x, y, z))

                  assert.isTrue(Option.isSome(retrievedVoxelOpt))
                  const retrievedVoxel = Option.getOrThrow(retrievedVoxelOpt)
                  assert.deepStrictEqual(retrievedVoxel.position, [
                    Math.floor(x),
                    Math.floor(y),
                    Math.floor(z),
                  ] as any)
                  assert.strictEqual(retrievedVoxel.blockType, blockType)
                }).pipe(Effect.provide(WorldLive), Effect.runPromise),
            ),
          ),
        ),
      )
    }))
})

describe('World Queries', () => {
  it.effect('should return entities that match a query', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = yield* _(createPlayerArchetype)
      const entityId = yield* _(world.addArchetype(playerArchetype))

      const query = createQuery('testQuery', ['position', 'velocity'])
      const results = yield* _(world.query(query))

      assert.lengthOf(results, 1)
      assert.strictEqual(results[0][0], entityId)
      const pos = S.decodeSync(Position)({ x: 0, y: 80, z: 0 })
      assert.deepStrictEqual(results[0][1][0], pos)
      assert.deepStrictEqual(results[0][1][1], { dx: 0, dy: 0, dz: 0 })
    }).pipe(Effect.provide(WorldLive)))

  it.effect('should not return entities that do not match a query', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = yield* _(createPlayerArchetype)
      yield* _(world.addArchetype(playerArchetype))

      const query = createQuery('testQuery', ['position', 'velocity', 'renderable'])
      const results = yield* _(world.query(query))

      assert.lengthOf(results, 0)
    }).pipe(Effect.provide(WorldLive)))

  it.effect('query and querySoA should return consistent results', () =>
    Effect.gen(function* (_) {
      const allComponentNames: readonly ComponentName[] = [
        'position',
        'velocity',
        'player',
        'renderable',
        'collider',
        'gravity',
      ]
      const queryComponentsArb = fc.subarray(allComponentNames, { minLength: 1 })

      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(
              fc.array(ArchetypeBuilderArb),
              queryComponentsArb,
              async (builders, queryComponents) =>
                Effect.gen(function* (_) {
                  const { world } = yield* _(setupWorldWithArchetypes(builders))

                  const query = createQuery('pbtQuery', queryComponents)

                  const aosResults = yield* _(world.query(query))
                  const soaResults = yield* _(world.querySoA(query))

                  const aosEntityIds = new Set(aosResults.map(([id]) => id))
                  const soaEntityIds = new Set(soaResults.entities)

                  assert.deepStrictEqual(aosEntityIds, soaEntityIds, 'Entity ID sets should be identical')

                  for (const [entityId, components] of aosResults) {
                    const soaIndex = soaResults.entities.indexOf(entityId)
                    assert.notStrictEqual(soaIndex, -1)

                    query.components.forEach((name, i) => {
                      const aosComponent = components[i]
                      const soaComponent = soaResults.components[name][soaIndex]
                      assert.deepStrictEqual(
                        aosComponent,
                        soaComponent,
                        `Component ${name} for entity ${entityId} should match`,
                      )
                    })
                  }
                }).pipe(Effect.provide(WorldLive), Effect.runPromise),
            ),
          ),
        ),
      )
    }))
})