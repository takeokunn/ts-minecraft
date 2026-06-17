import { it } from '@effect/vitest'
import { Effect, HashMap, Option, Ref } from 'effect'
import { AIState, EntityId, EntityManager, EntityType, createEntity } from '@ts-minecraft/entity'
import type { Entity, EntityType as EntityTypeT } from '@ts-minecraft/entity'
import type { BlockType, Position, Vector3, Quaternion } from '@ts-minecraft/core'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex, zero, identity } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import type { Chunk } from '@ts-minecraft/world'
import type { ExplosionEvent } from '../../domain/explosion'
import { BABY_GROW_TICKS } from '../../domain/mob/breeding'
import type { EntityDrop } from '../../domain/mob/drop'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { makeEntityManagerInternal } from '../../application/mob/entity-manager-internal'
import { getMobDefinition } from '../../domain/mob/mobs'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import type { EntityFrameContext } from '../../application/mob/entity-manager-ai-frame'

type EntityOverrides = Partial<{
  entityId: EntityId
  position: Position
  velocity: Vector3
  rotation: Quaternion
  health: number
  type: EntityTypeT
}>

type ManagedEntityOverrides = EntityOverrides & Partial<Omit<ManagedEntity, keyof Entity>>

export type TerrainBlockFixture = Readonly<{
  lx: number
  y: number
  lz: number
  blockType: BlockType
}>

export const TERRAIN_CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE

export const setTerrainBlockFixture = (
  blocks: Uint8Array,
  { lx, y, lz, blockType }: TerrainBlockFixture,
): void => {
  blocks[chunkBlockIndexUnchecked(lx, y, lz)] = blockTypeToIndex(blockType)
}

export const makeTerrainBlockBuffer = (
  fixtures: ReadonlyArray<TerrainBlockFixture> = [],
): Uint8Array<ArrayBufferLike> => {
  const blocks = new Uint8Array(TERRAIN_CHUNK_BLOCK_COUNT)

  for (const fixture of fixtures) {
    setTerrainBlockFixture(blocks, fixture)
  }

  return blocks
}

export const makeTerrainChunk = (
  fixtures: ReadonlyArray<TerrainBlockFixture> = [],
  overrides: Partial<Chunk> = {},
): Chunk => ({
  coord: { x: 0, z: 0 },
  blocks: makeTerrainBlockBuffer(fixtures),
  fluid: Option.none(),
  ...overrides,
})

export const withEntityManager = <A, E>(program: Effect.Effect<A, E, EntityManager>): Effect.Effect<A, E> =>
  Effect.provide(program, EntityManager.Default)

export const runWithEntityManager = <A, E>(program: Effect.Effect<A, E, EntityManager>): Promise<A> =>
  Effect.runPromise(withEntityManager(program))

export const itEntityManagerEffect = <A, E>(
  name: string,
  program: () => Effect.Effect<A, E, EntityManager>,
): void => {
  it.effect(name, () => withEntityManager(program()))
}

export const unwrapSomeEffect = <A, E, R>(
  effect: Effect.Effect<Option.Option<A>, E, R>,
): Effect.Effect<A, E, R> => Effect.andThen(effect, Option.getOrThrow)

export const unwrapSome = <A>(option: Option.Option<A>): A => Option.getOrThrow(option)
export { expectSome } from '../test-utils'

type InternalHarness = Readonly<{
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>
  structureVersionRef: Ref.Ref<number>
  explosionsRef: Ref.Ref<ReadonlyArray<ExplosionEvent>>
  internal: ReturnType<typeof makeEntityManagerInternal>
}>

export const makeInternalHarness = (): Effect.Effect<InternalHarness> =>
  Effect.gen(function* () {
    const entitiesRef = yield* Ref.make(HashMap.empty<EntityId, ManagedEntity>())
    const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(Option.none())
    const structureVersionRef = yield* Ref.make(0)
    const explosionsRef = yield* Ref.make<ReadonlyArray<ExplosionEvent>>([])
    const internal = makeEntityManagerInternal(entitiesRef, cachedEntitiesRef, structureVersionRef, explosionsRef)

    return { entitiesRef, cachedEntitiesRef, structureVersionRef, explosionsRef, internal }
  })

export const itEntityManagerInternalEffect = <A, E>(
  name: string,
  program: (harness: InternalHarness) => Effect.Effect<A, E>,
): void => {
  it.effect(name, () => Effect.gen(function* () {
    const harness = yield* makeInternalHarness()
    return yield* program(harness)
  }))
}

/**
 * Returns a valid Entity with sensible defaults.
 * Useful for unit tests that need an entity without going through EntityManager.
 */
export const makeTestEntity = (overrides: EntityOverrides = {}): Entity => {
  const position = overrides.position ?? { x: 0, y: 0, z: 0 }
  const type = overrides.type ?? EntityType.Zombie
  const health = overrides.health ?? 20
  const entityId = overrides.entityId ?? EntityId.make(`test-entity-${Math.random().toString(36).slice(2, 8)}`)

  return createEntity({
    entityId,
    position,
    type,
    health,
    velocity: overrides.velocity ?? zero,
    rotation: overrides.rotation ?? identity,
  })
}

export const makeTestManagedEntity = (overrides: ManagedEntityOverrides = {}): ManagedEntity => {
  const type = overrides.type ?? EntityType.Zombie
  const definition = getMobDefinition(type)
  const entityOverrides: EntityOverrides = { health: overrides.health ?? definition.maxHealth, type }
  if (overrides.entityId !== undefined) entityOverrides.entityId = overrides.entityId
  if (overrides.position !== undefined) entityOverrides.position = overrides.position
  if (overrides.velocity !== undefined) entityOverrides.velocity = overrides.velocity
  if (overrides.rotation !== undefined) entityOverrides.rotation = overrides.rotation
  const drops: ReadonlyArray<EntityDrop> = definition.drops.map((drop) =>
    drop.chance === undefined
      ? { blockType: drop.blockType, count: drop.count }
      : { blockType: drop.blockType, count: drop.count, chance: drop.chance }
  )
  const entity = makeTestEntity(entityOverrides)

  return {
    ...entity,
    behavior: definition.behavior,
    maxHealth: definition.maxHealth,
    attackDamage: definition.attackDamage,
    speed: definition.speed,
    detectionRange: definition.detectionRange,
    attackRange: definition.attackRange,
    fleeHealthThreshold: definition.fleeHealthThreshold,
    drops,
    aiState: AIState.Idle,
    wanderDirection: zero,
    attackCooldownRemaining: 0,
    isProvoked: false,
    isGrounded: false,
    knockbackSecsRemaining: 0,
    fireSecsRemaining: 0,
    fireDamageAccumulatorSecs: 0,
    stuckTicks: 0,
    fuseSecs: 0,
    loveTicksRemaining: 0,
    breedCooldownRemaining: 0,
    ageTicks: BABY_GROW_TICKS,
    woolRegrowthTicks: 0,
    ...overrides,
  }
}

export const makeEntityFrameContext = (overrides: Partial<EntityFrameContext> = {}): EntityFrameContext => ({
  tick: 1,
  deltaTime: DeltaTimeSecs.make(0.016),
  playerPosition: { x: 1000, y: 64, z: 1000 },
  playerLookOrigin: { x: 1000, y: 65.6, z: 1000 },
  playerLookDirection: undefined,
  playerLookBlocked: undefined,
  daytimeBurningActive: false,
  ...overrides,
})
