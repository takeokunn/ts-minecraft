import { Layer, MutableHashMap, MutableHashSet, Effect, Option } from 'effect'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { PlayerInputService } from '@ts-minecraft/player'
import { MovementServiceLive } from '@ts-minecraft/player'
import { PlayerCameraStateLive } from '@ts-minecraft/player'
import { PlayerServiceLive } from '@ts-minecraft/player'
import { PhysicsServiceLive } from '@ts-minecraft/physics'
import { PhysicsWorldPortLayer, RigidBodyPortLayer, ShapePortLayer } from '@ts-minecraft/app'
import { GameModeServiceLive } from '@ts-minecraft/game'
import { InventoryServiceLive } from '@ts-minecraft/inventory'
import { BlockRegistryLive } from '@ts-minecraft/world-state'
import { GameStateServiceLive } from '@ts-minecraft/game'

export const NoOpChunkManagerLayer = Layer.succeed(ChunkManagerService, {
  _tag: '@minecraft/application/ChunkManagerService' as const,
  getChunk: (_coord: unknown) => Effect.fail({ _tag: 'ChunkError', message: 'not loaded' } as never),
  getLoadedChunks: () => Effect.succeed([]),
  loadChunksAroundPlayer: (_pos: unknown, _dist?: unknown) => Effect.succeed(false),
  saveChunk: (_coord: unknown) => Effect.void,
  evictChunksOutsideRange: (_pos: unknown, _dist: unknown) => Effect.succeed([]),
} as unknown as ChunkManagerService)

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

  return {
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
    isMouseDown: () => Effect.sync(() => false),
    requestPointerLock: () => Effect.sync(() => {}),
    exitPointerLock: () => Effect.sync(() => {}),
    isPointerLocked: () => Effect.sync(() => true),
    consumeMouseClick: () => Effect.sync(() => false),
    consumeWheelDelta: () => Effect.sync(() => 0),
    setKeyPressed: (key: string, pressed: boolean) => {
      MutableHashMap.set(pressedKeys, key, pressed)
    },
    // Helper to simulate a new key press (adds to justPressedKeys)
    simulateKeyPress: (key: string) => {
      MutableHashMap.set(pressedKeys, key, true)
      MutableHashSet.add(justPressedKeys, key)
    },
  }
}

export const createTestLayer = (inputService: ReturnType<typeof createTestInputService>) => {
  // Create the base layers that don't have dependencies
  const inputLayer = Layer.succeed(PlayerInputService, inputService as unknown as PlayerInputService)

  // Create physics layer using application-layer ports (bridges to infrastructure live in @/layers)
  const physicsLayer = PhysicsServiceLive.pipe(
    Layer.provide(PhysicsWorldPortLayer),
    Layer.provide(RigidBodyPortLayer),
    Layer.provide(ShapePortLayer)
  )

  // Create movement layer with input dependency
  const movementLayer = MovementServiceLive.pipe(Layer.provide(inputLayer))

  // Create player and camera layers
  const playerLayer = PlayerServiceLive
  const cameraLayer = PlayerCameraStateLive

  // Merge all dependency layers — includes GameModeService (mode-aware respawn FR-1.3)
  // and InventoryService (clears on survival death) per the W2c death-screen wiring.
  const inventoryLayer = InventoryServiceLive.pipe(Layer.provide(BlockRegistryLive))
  const dependencyLayers = Layer.mergeAll(
    physicsLayer,
    movementLayer,
    cameraLayer,
    playerLayer,
    NoOpChunkManagerLayer,
    GameModeServiceLive,
    inventoryLayer,
  )

  // Create final layer with GameStateService
  return Layer.mergeAll(
    GameStateServiceLive.pipe(Layer.provide(dependencyLayers)),
    playerLayer,
  )
}
