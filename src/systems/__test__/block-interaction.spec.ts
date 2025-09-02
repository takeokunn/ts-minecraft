import { Effect, HashSet, Option, Record, Layer } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import type { BlockType } from '@/domain/block'
import { Hotbar, InputState, TargetBlock, createTargetNone } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import { QueryResult, World, WorldLive } from '@/runtime/world'
import { blockInteractionSystem, handleDestroyBlock, handlePlaceBlock } from '../block-interaction'
import { mock } from 'vitest-mock-extended'
import { RaycastService } from '@/infrastructure/raycast-three'
import { ThreeCameraService } from '@/infrastructure/camera-three'
import { ThreeContextService, ThreeContext } from '@/infrastructure/types'
import { Scene } from 'three'

const raycastMock = mock<RaycastService>()
const cameraMock = mock<ThreeCameraService>()
const contextMock = {
  ...mock<ThreeContext>(),
  scene: new Scene(),
} as ThreeContext

const MocksLayer = Layer.mergeAll(
  Layer.succeed(RaycastService, raycastMock),
  Layer.succeed(ThreeCameraService, cameraMock),
  Layer.succeed(ThreeContextService, contextMock),
)

const TestLayer = WorldLive.pipe(Layer.provide(MocksLayer))

const setupWorld = Effect.gen(function* (_) {
  const world = yield* _(World)

  const playerArchetype = createArchetype({
    type: 'player',
    pos: { x: 0, y: 1, z: 0 },
  })
  const playerId = yield* _(world.addArchetype(playerArchetype))

  const blockArchetype = createArchetype({
    type: 'block',
    pos: { x: 0, y: 0, z: -2 },
    blockType: 'grass',
  })
  const blockId = yield* _(world.addArchetype(blockArchetype))

  yield* _(
    world.updateComponent(
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

type PlayerQueryResult = QueryResult<['player', 'inputState', 'target', 'hotbar']> & { target: TargetBlock }

describe('blockInteractionSystem', () => {
  describe('handleDestroyBlock', () => {
    it('should destroy a block', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const { playerId, blockId } = yield* _(setupWorld)

        const players = yield* _(world.query(playerTargetQuery))
        const player = players[0]
        expect(player).toBeDefined()

        if (player && player.target._tag === 'block') {
          yield* _(handleDestroyBlock(player as PlayerQueryResult))
        }

        const blockExists = yield* _(world.getComponent(blockId, 'position'))
        const newTarget = yield* _(world.getComponent(playerId, 'target'))
        const worldState = yield* _(world.state.get)

        expect(Option.isNone(blockExists)).toBe(true)
        expect(newTarget).toEqual(Option.some(createTargetNone()))
        expect(HashSet.has(worldState.globalState.editedBlocks.destroyed, '0,0,-2')).toBe(true)
      })

      await Effect.runPromise(Effect.provide(program, TestLayer) as any)
    })

    it('should do nothing if target block has no position', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const { blockId } = yield* _(setupWorld)
        const players = yield* _(world.query(playerTargetQuery))
        const player = players[0]!

        // Manually remove the position component to trigger the guard clause
        yield* _(
          world.update((w) => {
            const newPositionMap = new Map(w.components.position)
            newPositionMap.delete(blockId)
            return {
              ...w,
              components: {
                ...w.components,
                position: newPositionMap,
              },
            }
          }),
        )
        const initialWorldState = yield* _(world.state.get)

        if (player && player.target._tag === 'block') {
          yield* _(handleDestroyBlock(player as PlayerQueryResult))
        }

        const finalWorldState = yield* _(world.state.get)
        expect(finalWorldState).toEqual(initialWorldState)
      })

      await Effect.runPromise(Effect.provide(program, TestLayer) as any)
    })

    it('should do nothing if target is not a block', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const { playerId } = yield* _(setupWorld)
        yield* _(world.updateComponent(playerId, 'target', createTargetNone()))
        const players = yield* _(world.query(playerTargetQuery))
        const player = players[0]!
        const initialWorldState = yield* _(world.state.get)

        if (player) {
          yield* _(handleDestroyBlock(player as PlayerQueryResult))
        }

        const finalWorldState = yield* _(world.state.get)
        expect(finalWorldState).toEqual(initialWorldState)
      })
      await Effect.runPromise(Effect.provide(program, TestLayer) as any)
    })
  })

  describe('handlePlaceBlock', () => {
    it('should place a block', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const { playerId } = yield* _(setupWorld)

        yield* _(
          world.updateComponent(
            playerId,
            'hotbar',
            new Hotbar({
              slots: ['dirt' as BlockType],
              selectedIndex: 0,
            }),
          ),
        )

        const players = yield* _(world.query(playerTargetQuery))
        const player = players[0]
        expect(player).toBeDefined()

        if (player && player.target._tag === 'block') {
          yield* _(handlePlaceBlock(player as PlayerQueryResult))
        }

        const worldState = yield* _(world.state.get)
        const placedBlock = Record.get(worldState.globalState.editedBlocks.placed, '0,0,-1')
        expect(Option.isSome(placedBlock)).toBe(true)
        expect(Option.getOrThrow(placedBlock)).toEqual({
          position: { x: 0, y: 0, z: -1 },
          blockType: 'dirt',
        })

        const newPlayerInput = yield* _(world.getComponent(playerId, 'inputState'))
        expect(newPlayerInput.pipe(Option.map((s) => s.place)).pipe(Option.getOrThrow)).toBe(false)
      })
      await Effect.runPromise(Effect.provide(program, TestLayer) as any)
    })

    it('should do nothing if target is not a block', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const { playerId } = yield* _(setupWorld)
        yield* _(world.updateComponent(playerId, 'target', createTargetNone()))
        const players = yield* _(world.query(playerTargetQuery))
        const player = players[0]!
        const initialWorldState = yield* _(world.state.get)

        if (player) {
          yield* _(handlePlaceBlock(player as PlayerQueryResult))
        }

        const finalWorldState = yield* _(world.state.get)
        expect(finalWorldState).toEqual(initialWorldState)
      })
      await Effect.runPromise(Effect.provide(program, TestLayer) as any)
    })

    it('should do nothing if target block has no position', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const { blockId } = yield* _(setupWorld)
        const players = yield* _(world.query(playerTargetQuery))
        const player = players[0]!

        // Manually remove the position component to trigger the guard clause
        yield* _(
          world.update((w) => {
            const newPositionMap = new Map(w.components.position)
            newPositionMap.delete(blockId)
            return {
              ...w,
              components: {
                ...w.components,
                position: newPositionMap,
              },
            }
          }),
        )
        const initialWorldState = yield* _(world.state.get)

        if (player && player.target._tag === 'block') {
          yield* _(handlePlaceBlock(player as PlayerQueryResult))
        }

        const finalWorldState = yield* _(world.state.get)
        expect(finalWorldState).toEqual(initialWorldState)
      })
      await Effect.runPromise(Effect.provide(program, TestLayer) as any)
    })
  })

  describe('blockInteractionSystem', () => {
    it('should call destroy handler when destroy input is true', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const { playerId, blockId } = yield* _(setupWorld)
        yield* _(
          world.updateComponent(
            playerId,
            'inputState',
            new InputState({ destroy: true, place: false, forward: false, backward: false, left: false, right: false, jump: false, sprint: false, isLocked: false }),
          ),
        )

        yield* _(blockInteractionSystem)

        const blockExists = yield* _(world.getComponent(blockId, 'position'))
        expect(Option.isNone(blockExists)).toBe(true)
      })
      await Effect.runPromise(Effect.provide(program, TestLayer) as any)
    })

    it('should call place handler when place input is true', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const { playerId } = yield* _(setupWorld)
        yield* _(
          world.updateComponent(
            playerId,
            'inputState',
            new InputState({ place: true, destroy: false, forward: false, backward: false, left: false, right: false, jump: false, sprint: false, isLocked: false }),
          ),
        )
        yield* _(
          world.updateComponent(
            playerId,
            'hotbar',
            new Hotbar({
              slots: ['stone' as BlockType],
              selectedIndex: 0,
            }),
          ),
        )

        yield* _(blockInteractionSystem)

        const worldState = yield* _(world.state.get)
        const placedBlock = Record.get(worldState.globalState.editedBlocks.placed, '0,0,-1')
        expect(Option.isSome(placedBlock)).toBe(true)
      })
      await Effect.runPromise(Effect.provide(program, TestLayer) as any)
    })

    it('should do nothing if hotbar selection is empty when placing', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const { playerId } = yield* _(setupWorld)
        yield* _(
          world.updateComponent(
            playerId,
            'inputState',
            new InputState({ place: true, destroy: false, forward: false, backward: false, left: false, right: false, jump: false, sprint: false, isLocked: false }),
          ),
        )
        yield* _(
          world.updateComponent(
            playerId,
            'hotbar',
            new Hotbar({
              slots: [],
              selectedIndex: 0,
            }),
          ),
        )
        const initialWorldState = yield* _(world.state.get)

        yield* _(blockInteractionSystem)

        const finalWorldState = yield* _(world.state.get)
        expect(finalWorldState).toEqual(initialWorldState)
      })
      await Effect.runPromise(Effect.provide(program, TestLayer) as any)
    })

    it('should do nothing if target is none', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const { playerId } = yield* _(setupWorld)
        yield* _(world.updateComponent(playerId, 'target', createTargetNone()))
        yield* _(
          world.updateComponent(
            playerId,
            'inputState',
            new InputState({ destroy: true, place: true, forward: false, backward: false, left: false, right: false, jump: false, sprint: false, isLocked: false }),
          ),
        )
        const initialWorldState = yield* _(world.state.get)

        yield* _(blockInteractionSystem)

        const finalWorldState = yield* _(world.state.get)
        expect(finalWorldState).toEqual(initialWorldState)
      })
      await Effect.runPromise(Effect.provide(program, TestLayer) as any)
    })

    it('should do nothing if no input is given', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const { blockId } = yield* _(setupWorld)
        const initialWorldState = yield* _(world.state.get)

        yield* _(blockInteractionSystem)

        const finalWorldState = yield* _(world.state.get)
        const blockExists = yield* _(world.getComponent(blockId, 'position'))

        expect(Option.isSome(blockExists)).toBe(true)
        expect(finalWorldState).toEqual(initialWorldState)
      })
      await Effect.runPromise(Effect.provide(program, TestLayer) as any)
    })
  })
})
