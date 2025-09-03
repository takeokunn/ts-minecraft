import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import { describe, it, assert } from '@effect/vitest'
import { Effect, Either } from 'effect'
import * as fc from 'effect/FastCheck'
import { Archetype, ArchetypeBuilder, ArchetypeSchema, createArchetype, createInputState } from '../archetypes'
import { BLOCK_COLLIDER, GRAVITY, PLAYER_COLLIDER } from '../world-constants'
import { hotbarSlots } from '../block'
import { toFloat, toInt, toChunkX, toChunkZ, ChunkX, ChunkZ } from '../common'
import { Position, CameraState } from '../components'
import { BlockTypeSchema } from '../block-types'
import { ParseError } from 'effect/ParseResult'

const PlayerArchetypeBuilderArbitrary = S.Struct({
  type: S.Literal('player'),
  pos: Position,
  cameraState: S.optional(CameraState),
}).pipe(Arbitrary.make)

const BlockArchetypeBuilderArbitrary = S.Struct({
  type: S.Literal('block'),
  pos: Position,
  blockType: BlockTypeSchema,
}).pipe(Arbitrary.make)

const CameraArchetypeBuilderArbitrary = S.Struct({
  type: S.Literal('camera'),
  pos: Position,
}).pipe(Arbitrary.make)

const TargetBlockArchetypeBuilderArbitrary = S.Struct({
  type: S.Literal('targetBlock'),
  pos: Position,
}).pipe(Arbitrary.make)

const ChunkArchetypeBuilderArbitrary = S.Struct({
  type: S.Literal('chunk'),
  chunkX: ChunkX,
  chunkZ: ChunkZ,
}).pipe(Arbitrary.make)

const ArchetypeBuilderArbitrary = fc.oneof(
  PlayerArchetypeBuilderArbitrary,
  BlockArchetypeBuilderArbitrary,
  CameraArchetypeBuilderArbitrary,
  TargetBlockArchetypeBuilderArbitrary,
  ChunkArchetypeBuilderArbitrary,
)

describe('Archetypes', () => {
  describe('Schema Reversibility', () => {
    it.effect('ArchetypeBuilder should be reversible after encoding and decoding', () =>
      Effect.sync(() =>
        fc.assert(
          fc.property(ArchetypeBuilderArbitrary, (value) => {
            const encode = S.encodeSync(ArchetypeBuilder)
            const decode = S.decodeSync(ArchetypeBuilder)
            const decodedValue = decode(encode(value))
            assert.deepStrictEqual(decodedValue, value)
          }),
        ),
      ),
    )

    it.effect('ArchetypeSchema should be reversible after encoding and decoding', () =>
      Effect.sync(() =>
        fc.assert(
          fc.property(Arbitrary.make(ArchetypeSchema), (value) => {
            const encode = S.encodeSync(ArchetypeSchema)
            const decode = S.decodeSync(ArchetypeSchema)
            const decodedValue = decode(encode(value))
            assert.deepStrictEqual(decodedValue, value)
          }),
        ),
      ),
    )
  })

  describe('createInputState', () => {
    it('should return a valid InputState object with all fields set to false', () => {
      const expectedState = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: false,
        isLocked: false,
      }
      assert.deepStrictEqual(createInputState(), expectedState)
    })
  })

  describe('createArchetype', () => {
    const pos = new Position({ x: toFloat(10), y: toFloat(20), z: toFloat(30) })

    it.effect('should create a valid player archetype without cameraState', () =>
      Effect.gen(function* () {
        const builder = { type: 'player' as const, pos }
        const archetype = yield* createArchetype(builder)
        const expected = {
          player: { isGrounded: false },
          position: pos,
          velocity: { dx: toFloat(0), dy: toFloat(0), dz: toFloat(0) },
          gravity: { value: toFloat(GRAVITY) },
          cameraState: { pitch: toFloat(0), yaw: toFloat(0) },
          inputState: createInputState(),
          collider: PLAYER_COLLIDER,
          hotbar: { slots: hotbarSlots, selectedIndex: toInt(0) },
          target: { _tag: 'none' as const },
        }
        assert.deepStrictEqual(archetype, expected)
      }))

    it.effect('should create a valid player archetype with cameraState', () =>
      Effect.gen(function* () {
        const cameraState = new CameraState({ pitch: toFloat(0.5), yaw: toFloat(1.5) })
        const builder = { type: 'player' as const, pos, cameraState }
        const archetype = yield* createArchetype(builder)
        const expected = {
          player: { isGrounded: false },
          position: pos,
          velocity: { dx: toFloat(0), dy: toFloat(0), dz: toFloat(0) },
          gravity: { value: toFloat(GRAVITY) },
          cameraState: cameraState,
          inputState: createInputState(),
          collider: PLAYER_COLLIDER,
          hotbar: { slots: hotbarSlots, selectedIndex: toInt(0) },
          target: { _tag: 'none' as const },
        }
        assert.deepStrictEqual(archetype, expected)
      }))

    it.effect('should create a valid block archetype', () =>
      Effect.gen(function* () {
        const builder = { type: 'block' as const, pos, blockType: 'grass' as const }
        const archetype = yield* createArchetype(builder)
        const expected: Archetype = {
          position: pos,
          renderable: { geometry: 'box', blockType: 'grass' },
          collider: BLOCK_COLLIDER,
          terrainBlock: {},
        }
        assert.deepStrictEqual(archetype, expected)
      }))

    it.effect('should create a valid camera archetype', () =>
      Effect.gen(function* () {
        const builder = { type: 'camera' as const, pos }
        const archetype = yield* createArchetype(builder)
        const expected = {
          camera: {
            position: pos,
            damping: toFloat(0.1),
          },
          position: pos,
        }
        assert.deepStrictEqual(archetype, expected)
      }))

    it.effect('should create a valid targetBlock archetype', () =>
      Effect.gen(function* () {
        const builder = { type: 'targetBlock' as const, pos }
        const archetype = yield* createArchetype(builder)
        const expected = {
          position: pos,
          targetBlock: {},
        }
        assert.deepStrictEqual(archetype, expected)
      }))

    it.effect('should create a valid chunk archetype', () =>
      Effect.gen(function* () {
        const builder = {
          type: 'chunk' as const,
          chunkX: toChunkX(1),
          chunkZ: toChunkZ(2),
        }
        const archetype = yield* createArchetype(builder)
        const expected = {
          chunk: { chunkX: toChunkX(1), chunkZ: toChunkZ(2), blocks: [] },
        }
        assert.deepStrictEqual(archetype, expected)
      }))

    it.effect('should return a ParseError for an invalid builder', () =>
      Effect.gen(function* () {
        const builder = { type: 'invalid' }
        const result = yield* Effect.either(createArchetype(builder as any))
        assert.isTrue(Either.isLeft(result))
        assert.instanceOf(result.left, ParseError)
      }))

    it.effect('should create a valid archetype for any valid builder (PBT)', () =>
      Effect.sync(() =>
        fc.assert(
          fc.property(ArchetypeBuilderArbitrary, (builder) => {
            const result = Effect.runSync(createArchetype(builder))
            assert.isObject(result)
            if ('pos' in builder) {
              assert.deepStrictEqual(result.position, builder.pos)
            }
          }),
        ),
      ),
    )
  })
})