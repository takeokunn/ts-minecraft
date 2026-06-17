import { Layer, MutableHashMap, MutableHashSet, Effect, Option } from 'effect'
import { ChunkManagerService } from '@ts-minecraft/world'
import { HungerService, PlayerInputService } from '@ts-minecraft/entity'
import { MovementService } from '@ts-minecraft/entity'
import { PlayerCameraStateService } from '@ts-minecraft/entity'
import { PlayerService } from '@ts-minecraft/entity'
import { PhysicsService } from '@ts-minecraft/game'
import { PhysicsWorldPortLayer, RigidBodyPortLayer, ShapePortLayer } from '@ts-minecraft/game'
import { GameModeService } from '@ts-minecraft/game'
import { InventoryService } from '@ts-minecraft/inventory'
import { BlockRegistry } from '@ts-minecraft/block'
import { GameStateService } from '@ts-minecraft/game'

export const NoOpChunkManagerLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
  _tag: '@minecraft/application/ChunkManagerService' as const,
  getChunk: (_coord: unknown) => Effect.fail({ _tag: 'ChunkError', message: 'not loaded' } as never),
  getLoadedChunks: () => Effect.succeed([]),
  drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
  loadChunksAroundPlayer: (_pos: unknown, _dist?: unknown) => Effect.succeed(false),
  markChunkDirty: () => Effect.void,
  saveDirtyChunks: () => Effect.void,
  unloadChunk: () => Effect.void,
  setActiveWorldId: (_worldId: unknown) => Effect.void,
  setActiveDimension: (_dim: unknown) => Effect.void,
}))

export const NoOpPlayerInputLayer = Layer.succeed(PlayerInputService, PlayerInputService.of({
  _tag: '@minecraft/application/PlayerInputService' as const,
  isKeyPressed: (_key: string) => Effect.succeed(false),
  consumeKeyPress: (_key: string) => Effect.succeed(false),
  consumeWheelDelta: () => Effect.succeed(0),
  getMouseDelta: () => Effect.succeed({ x: 0, y: 0 }),
  isPointerLocked: () => Effect.succeed(false),
}))

export const PhysicsLayer = PhysicsService.Default.pipe(
  Layer.provide(PhysicsWorldPortLayer),
  Layer.provide(RigidBodyPortLayer),
  Layer.provide(ShapePortLayer),
)

export const MovementLayer = MovementService.Default.pipe(
  Layer.provide(NoOpPlayerInputLayer),
  Layer.provide(HungerService.Default),
)

export const InventoryLayerForTest = InventoryService.Default.pipe(Layer.provide(BlockRegistry.Default))

export const TestGameLayer = GameStateService.Default.pipe(
  Layer.provide(PlayerService.Default),
  Layer.provide(PhysicsLayer),
  Layer.provide(MovementLayer),
  Layer.provide(HungerService.Default),
  // GameStateService now directly requires PlayerInputService (creative flight, FR-1).
  Layer.provide(NoOpPlayerInputLayer),
  Layer.provide(PlayerCameraStateService.Default),
  Layer.provide(NoOpChunkManagerLayer),
  Layer.provide(GameModeService.Default),
  Layer.provide(InventoryLayerForTest),
)

export const createTestInputService = (initialState: {
  forward?: boolean
  backward?: boolean
  left?: boolean
  right?: boolean
  jump?: boolean
  sprint?: boolean
  sneak?: boolean
} = {}) => {
  const pressedKeys = MutableHashMap.make(
    ['KeyW', initialState.forward ?? false],
    ['KeyS', initialState.backward ?? false],
    ['KeyA', initialState.left ?? false],
    ['KeyD', initialState.right ?? false],
    ['Space', initialState.jump ?? false],
    // Sprint = Ctrl (KeyMappings.SPRINT reads ControlLeft/ControlRight); sneak = ShiftLeft.
    ['ControlLeft', initialState.sprint ?? false],
    ['ShiftLeft', initialState.sneak ?? false],
  )
  // For consumeKeyPress, track "just pressed" keys
  const justPressedKeys = MutableHashSet.empty<string>()
  if (initialState.jump) {
    MutableHashSet.add(justPressedKeys, 'Space')
  }

  return Object.assign(PlayerInputService.of({
    _tag: '@minecraft/application/PlayerInputService' as const,
    isKeyPressed: (key: string) => Effect.sync(() => Option.getOrElse(MutableHashMap.get(pressedKeys, key), () => false)),
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (MutableHashSet.has(justPressedKeys, key)) {
          MutableHashSet.remove(justPressedKeys, key)
          return true
        }
        return false
      }),
    getMouseDelta: () => Effect.sync(() => ({ x: 0, y: 0 })),
    isPointerLocked: () => Effect.sync(() => true),
    consumeWheelDelta: () => Effect.sync(() => 0),
  }), {
    setKeyPressed: (key: string, pressed: boolean) => {
      MutableHashMap.set(pressedKeys, key, pressed)
    },
    // Helper to simulate a new key press (adds to justPressedKeys)
    simulateKeyPress: (key: string) => {
      MutableHashMap.set(pressedKeys, key, true)
      MutableHashSet.add(justPressedKeys, key)
    },
  })
}

export const createTestLayer = (inputService: ReturnType<typeof createTestInputService>) => {
  const inputLayer = Layer.succeed(PlayerInputService, inputService)
  const movementLayer = MovementService.Default.pipe(
    Layer.provide(inputLayer),
    Layer.provide(HungerService.Default),
  )
  const dependencyLayers = Layer.mergeAll(
    PhysicsLayer,
    movementLayer,
    // GameStateService directly consumes PlayerInputService for creative flight
    // (FR-1) — expose the same test input the movement layer uses.
    inputLayer,
    PlayerCameraStateService.Default,
    PlayerService.Default,
    NoOpChunkManagerLayer,
    GameModeService.Default,
    InventoryLayerForTest,
  )
  return Layer.mergeAll(
    GameStateService.Default.pipe(Layer.provide(dependencyLayers)),
    PlayerService.Default,
  )
}
