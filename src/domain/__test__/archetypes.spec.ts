import * as S from 'effect/Schema'
import { describe, it, assert } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Gen } from 'effect'
import { ArchetypeBuilder, ArchetypeSchema, createArchetype, createInputState } from '../archetypes'
import { BLOCK_COLLIDER, GRAVITY, PLAYER_COLLIDER } from '../world-constants'
import { hotbarSlots } from '../block'
import { toFloat, toInt } from '../common'
import { Position } from '../components'

describe('Archetypes', () => {
  const testReversibility = (name: string, schema: S.Schema<any, any>) => {
    it.effect(`${name} should be reversible after encoding and decoding`, () =>
      Gen.flatMap(fc.gen(schema), (value) =>
        Effect.sync(() => {
          const encode = S.encodeSync(schema)
          const decode = S.decodeSync(schema)
          const decodedValue = decode(encode(value))
          assert.deepStrictEqual(decodedValue, value)
        }),
      ))
  }

  describe('Schema Reversibility', () => {
    testReversibility('ArchetypeBuilder', ArchetypeBuilder)
    testReversibility('ArchetypeSchema', ArchetypeSchema)
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
    it.effect('should create a valid player archetype', () =>
      Gen.flatMap(fc.gen(Position), (pos) =>
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
            target: { _tag: 'none' },
          }
          assert.deepStrictEqual(archetype, expected)
        }),
      ))

    it.effect('should create a valid block archetype', () =>
      Gen.flatMap(
        fc.gen(ArchetypeBuilder).pipe(Gen.filter((b) => b.type === 'block')),
        (builder) =>
          Effect.gen(function* () {
            if (builder.type !== 'block') return // Type guard
            const archetype = yield* createArchetype(builder)
            const expected = {
              position: builder.pos,
              renderable: { geometry: 'box', blockType: builder.blockType },
              collider: BLOCK_COLLIDER,
              terrainBlock: {},
            }
            assert.deepStrictEqual(archetype, expected)
          }),
      ))

    it.effect('should create a valid camera archetype', () =>
      Gen.flatMap(fc.gen(Position), (pos) =>
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
        }),
      ))

    it.effect('should create a valid targetBlock archetype', () =>
      Gen.flatMap(fc.gen(Position), (pos) =>
        Effect.gen(function* () {
          const builder: S.Schema.Type<typeof ArchetypeBuilder> = { type: 'targetBlock', pos }
          const archetype = yield* createArchetype(builder)
          const expected = {
            position: pos,
            targetBlock: {},
          }
          assert.deepStrictEqual(archetype, expected)
        }),
      ))

    it.effect('should create a valid chunk archetype', () =>
      Gen.flatMap(
        fc.gen(ArchetypeBuilder).pipe(Gen.filter((b) => b.type === 'chunk')),
        (builder) =>
          Effect.gen(function* () {
            if (builder.type !== 'chunk') return // Type guard
            const archetype = yield* createArchetype(builder)
            const expected = {
              chunk: { chunkX: builder.chunkX, chunkZ: builder.chunkZ, blocks: [] },
            }
            assert.deepStrictEqual(archetype, expected)
          }),
      ))
  })
})
