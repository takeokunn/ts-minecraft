import { describe, it, assert } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { blockInteractionSystem } from '../block-interaction'
import { World } from '@/runtime/services'
import { WorldLive } from '@/infrastructure/world'
import { createArchetype } from '@/domain/archetypes'
import { toFloat, toInt } from '@/core/common'
import { Hotbar } from '@/core/components'
import { EntityId } from '@/core/entities/entity'

const TestLayer = WorldLive

describe('blockInteractionSystem', () => {
  it.effect('should destroy blocks when destroy input is true', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      
      // Create a block to target
      const blockArchetype = yield* _(createArchetype({
        type: 'block',
        pos: { x: 1, y: 1, z: 1 },
        blockType: 'stone',
      }))
      const blockId = yield* _(world.addArchetype(blockArchetype))
      
      // Create a player targeting the block
      const playerArchetype = yield* _(createArchetype({
        type: 'player',
        pos: { x: 0, y: 0, z: 0 },
      }))
      const playerId = yield* _(world.addArchetype(playerArchetype))
      
      // Set player to target the block and press destroy
      yield* _(world.updateComponent(playerId, 'target', {
        _tag: 'block',
        entityId: blockId,
        position: { x: 1, y: 1, z: 1 },
        face: [toInt(0), toInt(1), toInt(0)],
      }))
      
      yield* _(world.updateComponent(playerId, 'inputState', {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: true,
        isLocked: true,
      }))
      
      // Run the system
      yield* _(blockInteractionSystem)
      
      // Check that the block was removed
      const blockExists = yield* _(world.getComponent(blockId, 'position'))
      assert.isTrue(Option.isNone(blockExists))
      
      // Check that target was reset
      const newTarget = yield* _(world.getComponent(playerId, 'target'))
      assert.isTrue(Option.isSome(newTarget))
      if (Option.isSome(newTarget)) {
        assert.equal(newTarget.value._tag, 'none')
      }
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect('should place blocks when place input is true', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      
      // Create a block to target
      const blockArchetype = yield* _(createArchetype({
        type: 'block',
        pos: { x: 1, y: 1, z: 1 },
        blockType: 'stone',
      }))
      const blockId = yield* _(world.addArchetype(blockArchetype))
      
      // Create a player with hotbar
      const playerArchetype = yield* _(createArchetype({
        type: 'player',
        pos: { x: 0, y: 0, z: 0 },
      }))
      const playerId = yield* _(world.addArchetype(playerArchetype))
      
      // Set up hotbar with a block to place
      const hotbar = new Hotbar({
        slots: ['dirt', 'stone', 'wood', 'air', 'air', 'air', 'air', 'air', 'air'],
        selectedIndex: 0,
      })
      yield* _(world.updateComponent(playerId, 'hotbar', hotbar))
      
      // Set player to target the block and press place
      yield* _(world.updateComponent(playerId, 'target', {
        _tag: 'block',
        entityId: blockId,
        position: { x: 1, y: 1, z: 1 },
        face: [toInt(0), toInt(1), toInt(0)], // Top face
      }))
      
      yield* _(world.updateComponent(playerId, 'inputState', {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: true,
        destroy: false,
        isLocked: true,
      }))
      
      // Run the system
      yield* _(blockInteractionSystem)
      
      // Check that place input was reset
      const newInputState = yield* _(world.getComponent(playerId, 'inputState'))
      assert.isTrue(Option.isSome(newInputState))
      if (Option.isSome(newInputState)) {
        assert.isFalse(newInputState.value.place)
      }
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect('should not place blocks when hotbar slot is empty', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      
      // Create a block to target
      const blockArchetype = yield* _(createArchetype({
        type: 'block',
        pos: { x: 1, y: 1, z: 1 },
        blockType: 'stone',
      }))
      const blockId = yield* _(world.addArchetype(blockArchetype))
      
      // Create a player with empty hotbar slot selected
      const playerArchetype = yield* _(createArchetype({
        type: 'player',
        pos: { x: 0, y: 0, z: 0 },
      }))
      const playerId = yield* _(world.addArchetype(playerArchetype))
      
      // Set up hotbar with selected slot as air
      const hotbar = new Hotbar({
        slots: ['air', 'stone', 'wood', 'air', 'air', 'air', 'air', 'air', 'air'],
        selectedIndex: 0,
      })
      yield* _(world.updateComponent(playerId, 'hotbar', hotbar))
      
      // Set player to target the block and press place
      yield* _(world.updateComponent(playerId, 'target', {
        _tag: 'block',
        entityId: blockId,
        position: { x: 1, y: 1, z: 1 },
        face: [toInt(0), toInt(1), toInt(0)],
      }))
      
      yield* _(world.updateComponent(playerId, 'inputState', {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: true,
        destroy: false,
        isLocked: true,
      }))
      
      // Run the system
      yield* _(blockInteractionSystem)
      
      // Input state should remain unchanged when trying to place air
      const inputState = yield* _(world.getComponent(playerId, 'inputState'))
      assert.isTrue(Option.isSome(inputState))
      if (Option.isSome(inputState)) {
        assert.isTrue(inputState.value.place) // Still true since we couldn't place
      }
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect('should handle no target', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      
      // Create a player with no target
      const playerArchetype = yield* _(createArchetype({
        type: 'player',
        pos: { x: 0, y: 0, z: 0 },
      }))
      const playerId = yield* _(world.addArchetype(playerArchetype))
      
      // Set target to none
      yield* _(world.updateComponent(playerId, 'target', { _tag: 'none' as const }))
      
      yield* _(world.updateComponent(playerId, 'inputState', {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: true,
        destroy: true,
        isLocked: true,
      }))
      
      // Run the system - should handle gracefully
      yield* _(blockInteractionSystem)
      
      assert.isOk(true)
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect('should handle no players', () =>
    Effect.gen(function* (_) {
      // Simply test that the system runs without errors when no players exist
      yield* _(blockInteractionSystem)
      assert.isOk(true)
    }).pipe(Effect.provide(TestLayer))
  )
})