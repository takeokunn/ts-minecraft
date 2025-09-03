import { describe, it, assert } from '@effect/vitest'
import { Effect } from 'effect'
import * as S from 'effect/Schema'
console.log(S)
import * as Arbitrary from 'effect/Arbitrary'
import { blockTypeNames } from '../block-types'
import { hotbarSlots } from '../block'
import { CameraState, Position } from '../components'
import { BLOCK_COLLIDER, GRAVITY, PLAYER_COLLIDER } from '../world-constants'
import { createArchetype, createInputState } from '../archetypes'

const positionArbitrary = Arbitrary.make(Position)
const cameraStateArbitrary = Arbitrary.make(CameraState)
const blockTypeArbitrary = S.Literal(...blockTypeNames).pipe(Arbitrary.make)

describe('createArchetype', () => {
  describe('player', () => {
    it.prop('should create a player archetype with given position and cameraState', [positionArbitrary, cameraStateArbitrary], (pos, cameraState) =>
      Effect.gen(function* (_) {
        const archetype = yield* _(
          createArchetype({
            type: 'player',
            pos,
            cameraState,
          }),
        )

        const inputState = yield* _(createInputState())

        assert.deepStrictEqual(archetype.player, { isGrounded: false })
        assert.deepStrictEqual(archetype.position, pos)
        assert.deepStrictEqual(archetype.velocity, { dx: 0, dy: 0, dz: 0 })
        assert.deepStrictEqual(archetype.gravity, { value: GRAVITY })
        assert.deepStrictEqual(archetype.cameraState, cameraState)
        assert.deepStrictEqual(archetype.inputState, inputState)
        const playerCollider = yield* _(PLAYER_COLLIDER)
        assert.deepStrictEqual(archetype.collider, playerCollider)
        assert.deepStrictEqual(archetype.hotbar, { slots: hotbarSlots, selectedIndex: 0 })
        assert.deepStrictEqual(archetype.target, { _tag: 'none' })
      }),
    )

    it.prop('should create a player archetype with default cameraState if not provided', [positionArbitrary], (pos) =>
      Effect.gen(function* (_) {
        const archetype = yield* _(createArchetype({ type: 'player', pos, cameraState: undefined }))
        assert.deepStrictEqual(archetype.cameraState, { pitch: 0, yaw: 0 })
      }),
    )
  })

  describe('block', () => {
    it.prop('should create a block archetype', [positionArbitrary, blockTypeArbitrary], (pos, blockType) =>
      Effect.gen(function* (_) {
        const archetype = yield* _(
          createArchetype({
            type: 'block',
            pos,
            blockType,
          }),
        )

        assert.deepStrictEqual(archetype.position, pos)
        assert.deepStrictEqual(archetype.renderable, { geometry: 'box', blockType })
        const blockCollider = yield* _(BLOCK_COLLIDER)
        assert.deepStrictEqual(archetype.collider, blockCollider)
        assert.deepStrictEqual(archetype.terrainBlock, {})
      }),
    )
  })
})
