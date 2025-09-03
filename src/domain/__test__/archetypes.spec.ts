import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import { describe, it, assert } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { Archetype, ArchetypeBuilder, ArchetypeSchema, createArchetype, createInputState } from '../archetypes'
import { BLOCK_COLLIDER, GRAVITY, PLAYER_COLLIDER } from '../world-constants'
import { hotbarSlots } from '../block'
import { toFloat, toInt, toChunkX, toChunkZ, ChunkX, ChunkZ } from '../common'
import { Position } from '../components'
import { BlockTypeSchema } from '../block-types'

const PlayerArchetypeBuilderArbitrary = Arbitrary.make(
  S.Struct({
    type: S.Literal('player'),
    pos: Position,
  }),
)

const BlockArchetypeBuilderArbitrary = Arbitrary.make(
  S.Struct({
    type: S.Literal('block'),
    pos: Position,
    blockType: BlockTypeSchema,
  }),
)

const CameraArchetypeBuilderArbitrary = Arbitrary.make(
  S.Struct({
    type: S.Literal('camera'),
    pos: Position,
  }),
)

const TargetBlockArchetypeBuilderArbitrary = Arbitrary.make(
  S.Struct({
    type: S.Literal('targetBlock'),
    pos: Position,
  }),
)

const ChunkArchetypeBuilderArbitrary = Arbitrary.make(
  S.Struct({
    type: S.Literal('chunk'),
    chunkX: ChunkX,
    chunkZ: ChunkZ,
  }),
)

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
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(ArchetypeBuilderArbitrary, async (value) => {
            const encode = S.encodeSync(ArchetypeBuilder)
            const decode = S.decodeSync(ArchetypeBuilder)
            const decodedValue = decode(encode(value))
            assert.deepStrictEqual(decodedValue, value)
          }),
        ),
      ),
    )

    it.effect('ArchetypeSchema should be reversible after encoding and decoding', () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(Arbitrary.make(ArchetypeSchema), async (value) => {
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
    const pos: Position = { x: toFloat(10), y: toFloat(20), z: toFloat(30) }

    it.effect('should create a valid player archetype', () =>
      Effect.gen(function* () {
        const builder: S.Schema.Type<typeof ArchetypeBuilder> = { type: 'player', pos }
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

    it.effect('should create a valid block archetype', () =>
      Effect.gen(function* () {
        const builder: S.Schema.Type<typeof ArchetypeBuilder> = { type: 'block', pos, blockType: 'grass' }
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
        const builder: S.Schema.Type<typeof ArchetypeBuilder> = { type: 'camera', pos }
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
        const builder: S.Schema.Type<typeof ArchetypeBuilder> = { type: 'targetBlock', pos }
        const archetype = yield* createArchetype(builder)
        const expected = {
          position: pos,
          targetBlock: {},
        }
        assert.deepStrictEqual(archetype, expected)
      }))

    it.effect('should create a valid chunk archetype', () =>
      Effect.gen(function* () {
        const builder: S.Schema.Type<typeof ArchetypeBuilder> = {
          type: 'chunk',
          chunkX: toChunkX(1),
          chunkZ: toChunkZ(2),
        }
        const archetype = yield* createArchetype(builder)
        const expected = {
          chunk: { chunkX: toChunkX(1), chunkZ: toChunkZ(2), blocks: [] },
        }
        assert.deepStrictEqual(archetype, expected)
      }))
  })
})