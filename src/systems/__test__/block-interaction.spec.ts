import { Effect, Option, Record, Ref } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import type { BlockType } from '@/domain/block'
import { Hotbar, InputState, TargetBlock, createTargetNone } from '@/domain/components'
import * as World from '@/runtime/world-pure'
import { WorldContext } from '@/runtime/context'
import { provideTestLayer } from 'test/utils'
import { blockInteractionSystem } from '../block-interaction'

const TestLayer = provideTestLayer()

const setupWorld = Effect.gen(function* ($) {
  const playerArchetype = createArchetype({
    type: 'player',
    pos: { x: 0, y: 1, z: 0 },
  })
  const playerId = yield* $(World.addArchetype(playerArchetype))

  const blockArchetype = createArchetype({
    type: 'block',
    pos: { x: 0, y: 0, z: -2 },
    blockType: 'grass',
  })
  const blockId = yield* $(World.addArchetype(blockArchetype))

  yield* $(
    World.updateComponent(
      playerId,
      'target',
      new TargetBlock({
        _tag: 'block',
        entityId: blockId,
        face: { x: 0, y: 0, z: 1 },
      }),
    ),
  )

  return { playerId, blockId }
})

describe('blockInteractionSystem', () => {
  it('should call destroy handler when destroy input is true', () =>
    Effect.gen(function* ($) {
      const { playerId, blockId } = yield* $(setupWorld)
      yield* $(
        World.updateComponent(
          playerId,
          'inputState',
          new InputState({ destroy: true, place: false, forward: false, backward: false, left: false, right: false, jump: false, sprint: false, isLocked: false }),
        ),
      )

      yield* $(blockInteractionSystem)

      const blockExists = yield* $(World.getComponentOption(blockId, 'position'))
      expect(Option.isNone(blockExists)).toBe(true)
    }).pipe(Effect.provide(TestLayer)))

  it('should call place handler when place input is true', () =>
    Effect.gen(function* ($) {
      const { playerId } = yield* $(setupWorld)
      const { world } = yield* $(WorldContext)
      yield* $(
        World.updateComponent(
          playerId,
          'inputState',
          new InputState({ place: true, destroy: false, forward: false, backward: false, left: false, right: false, jump: false, sprint: false, isLocked: false }),
        ),
      )
      yield* $(
        World.updateComponent(
          playerId,
          'hotbar',
          new Hotbar({
            slots: ['stone' as BlockType],
            selectedIndex: 0,
          }),
        ),
      )

      yield* $(blockInteractionSystem)

      const worldState = yield* $(Ref.get(world))
      const placedBlock = Record.get(worldState.globalState.editedBlocks.placed, '0,0,-1')
      expect(Option.isSome(placedBlock)).toBe(true)
    }).pipe(Effect.provide(TestLayer)))

  it('should do nothing if hotbar selection is empty when placing', () =>
    Effect.gen(function* ($) {
      const { playerId } = yield* $(setupWorld)
      const { world } = yield* $(WorldContext)
      yield* $(
        World.updateComponent(
          playerId,
          'inputState',
          new InputState({ place: true, destroy: false, forward: false, backward: false, left: false, right: false, jump: false, sprint: false, isLocked: false }),
        ),
      )
      yield* $(
        World.updateComponent(
          playerId,
          'hotbar',
          new Hotbar({
            slots: [],
            selectedIndex: 0,
          }),
        ),
      )
      const initialWorldState = yield* $(Ref.get(world))

      yield* $(blockInteractionSystem)

      const finalWorldState = yield* $(Ref.get(world))
      expect(finalWorldState).toEqual(initialWorldState)
    }).pipe(Effect.provide(TestLayer)))

  it('should do nothing if target is none', () =>
    Effect.gen(function* ($) {
      const { playerId } = yield* $(setupWorld)
      const { world } = yield* $(WorldContext)
      yield* $(World.updateComponent(playerId, 'target', createTargetNone()))
      yield* $(
        World.updateComponent(
          playerId,
          'inputState',
          new InputState({ destroy: true, place: true, forward: false, backward: false, left: false, right: false, jump: false, sprint: false, isLocked: false }),
        ),
      )
      const initialWorldState = yield* $(Ref.get(world))

      yield* $(blockInteractionSystem)

      const finalWorldState = yield* $(Ref.get(world))
      expect(finalWorldState).toEqual(initialWorldState)
    }).pipe(Effect.provide(TestLayer)))

  it('should do nothing if no input is given', () =>
    Effect.gen(function* ($) {
      const { blockId } = yield* $(setupWorld)
      const { world } = yield* $(WorldContext)
      const initialWorldState = yield* $(Ref.get(world))

      yield* $(blockInteractionSystem)

      const finalWorldState = yield* $(Ref.get(world))
      const blockExists = yield* $(World.getComponentOption(blockId, 'position'))

      expect(Option.isSome(blockExists)).toBe(true)
      expect(finalWorldState).toEqual(initialWorldState)
    }).pipe(Effect.provide(TestLayer)))
})
