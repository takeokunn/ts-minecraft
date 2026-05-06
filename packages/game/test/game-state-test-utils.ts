import { Layer, MutableHashMap, MutableHashSet, Effect, Option } from 'effect'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { PlayerInputService } from '@ts-minecraft/player'
import { MovementServiceLive } from '@ts-minecraft/player'
import { PlayerCameraStateLive } from '@ts-minecraft/player'
import { PlayerServiceLive } from '@ts-minecraft/player'
import { PhysicsServiceLive } from '@ts-minecraft/physics'
import { PhysicsWorldPortLayer, RigidBodyPortLayer, ShapePortLayer } from '@ts-minecraft/physics'
import { GameModeServiceLive } from '@ts-minecraft/game'
import { InventoryServiceLive } from '@ts-minecraft/inventory'
import { BlockRegistryLive } from '@ts-minecraft/world-state'
import { GameStateServiceLive } from '@ts-minecraft/game'

export const NoOpChunkManagerLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
  _tag: '@minecraft/application/ChunkManagerService' as const,
  getChunk: (_coord: unknown) => Effect.fail({ _tag: 'ChunkError', message: 'not loaded' } as never),
  getLoadedChunks: () => Effect.succeed([]),
  drainRenderDirtyChunks: () => Effect.succeed([]),
  loadChunksAroundPlayer: (_pos: unknown, _dist?: unknown) => Effect.succeed(false),
  markChunkDirty: () => Effect.void,
  saveDirtyChunks: () => Effect.void,
  unloadChunk: () => Effect.void,
}))

export const NoOpPlayerInputLayer = Layer.succeed(PlayerInputService, PlayerInputService.of({
  _tag: '@minecraft/application/PlayerInputService' as const,
  isKeyPressed: (_key: string) => Effect.succeed(false),
  consumeKeyPress: (_key: string) => Effect.succeed(false),
  consumeWheelDelta: () => Effect.succeed(0),
  getMouseDelta: () => Effect.succeed({ x: 0, y: 0 }),
  isPointerLocked: () => Effect.succeed(false),
}))

export const PhysicsLayer = PhysicsServiceLive.pipe(
  Layer.provide(PhysicsWorldPortLayer),
  Layer.provide(RigidBodyPortLayer),
  Layer.provide(ShapePortLayer),
)

export const MovementLayer = MovementServiceLive.pipe(
  Layer.provide(NoOpPlayerInputLayer),
)

export const InventoryLayerForTest = InventoryServiceLive.pipe(Layer.provide(BlockRegistryLive))

export const TestGameLayer = GameStateServiceLive.pipe(
  Layer.provide(PlayerServiceLive),
  Layer.provide(PhysicsLayer),
  Layer.provide(MovementLayer),
  Layer.provide(PlayerCameraStateLive),
  Layer.provide(NoOpChunkManagerLayer),
  Layer.provide(GameModeServiceLive),
  Layer.provide(InventoryLayerForTest),
)

export const createTestInputService = (initialState: {
  forward?: boolean
  backward?: boolean
  left?: boolean
  right?: boolean
  jump?: boolean
  sprint?: boolean
} = {}) => {
  const pressedKeys = MutableHashMap.make(
    ['KeyW', Option.getOrElse(Option.fromNullable(initialState.forward), () => false)],
    ['KeyS', Option.getOrElse(Option.fromNullable(initialState.backward), () => false)],
    ['KeyA', Option.getOrElse(Option.fromNullable(initialState.left), () => false)],
    ['KeyD', Option.getOrElse(Option.fromNullable(initialState.right), () => false)],
    ['Space', Option.getOrElse(Option.fromNullable(initialState.jump), () => false)],
    ['ShiftLeft', Option.getOrElse(Option.fromNullable(initialState.sprint), () => false)],
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
  const movementLayer = MovementServiceLive.pipe(Layer.provide(inputLayer))
  const dependencyLayers = Layer.mergeAll(
    PhysicsLayer,
    movementLayer,
    PlayerCameraStateLive,
    PlayerServiceLive,
    NoOpChunkManagerLayer,
    GameModeServiceLive,
    InventoryLayerForTest,
  )
  return Layer.mergeAll(
    GameStateServiceLive.pipe(Layer.provide(dependencyLayers)),
    PlayerServiceLive,
  )
}
