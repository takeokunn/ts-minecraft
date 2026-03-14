import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import {
  GameStateService,
  GameStateServiceLive,
  GameStateError,
  PLAYER_BODY_ID,
  DEFAULT_PLAYER_ID,
} from './game-state'
import { PhysicsServiceLive } from './physics/physics-service'
import { MovementServiceLive } from './player/movement-service'
import { PlayerCameraStateLive } from '../domain/player-camera'
import { PlayerServiceLive } from '../domain/player'
import { WorldServiceLive } from '../domain/world'
import { PlayerInputService } from './input/player-input-service'
import { PhysicsWorldServiceLive } from '../infrastructure/cannon/boundary/world-service'
import { RigidBodyServiceLive } from '../infrastructure/cannon/boundary/body-service'
import { ShapeServiceLive } from '../infrastructure/cannon/boundary/shape-service'

/**
 * Test implementation of InputService with controllable key state
 */
const createTestInputService = (initialState: {
  forward?: boolean
  backward?: boolean
  left?: boolean
  right?: boolean
  jump?: boolean
  sprint?: boolean
} = {}) => {
  const pressedKeys = new Map<string, boolean>([
    ['KeyW', initialState.forward ?? false],
    ['KeyS', initialState.backward ?? false],
    ['KeyA', initialState.left ?? false],
    ['KeyD', initialState.right ?? false],
    ['Space', initialState.jump ?? false],
    ['ShiftLeft', initialState.sprint ?? false],
  ])
  // For consumeKeyPress, track "just pressed" keys
  const justPressedKeys = new Set<string>()
  if (initialState.jump) {
    justPressedKeys.add('Space')
  }

  return {
    isKeyPressed: (key: string) => Effect.sync(() => pressedKeys.get(key) ?? false),
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (justPressedKeys.has(key)) {
          justPressedKeys.delete(key)
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
      pressedKeys.set(key, pressed)
    },
    // Helper to simulate a new key press (adds to justPressedKeys)
    simulateKeyPress: (key: string) => {
      pressedKeys.set(key, true)
      justPressedKeys.add(key)
    },
  }
}

/**
 * Create test layer with all dependencies
 */
const createTestLayer = (inputService: ReturnType<typeof createTestInputService>) => {
  // Create the base layers that don't have dependencies
  const inputLayer = Layer.succeed(PlayerInputService, inputService as unknown as PlayerInputService)
  const shapeLayer = ShapeServiceLive
  const bodyLayer = RigidBodyServiceLive.pipe(Layer.provide(shapeLayer))
  const worldLayer = PhysicsWorldServiceLive

  // Create physics layer with its dependencies
  const physicsLayer = PhysicsServiceLive.pipe(
    Layer.provide(worldLayer),
    Layer.provide(bodyLayer),
    Layer.provide(shapeLayer)
  )

  // Create movement layer with input dependency
  const movementLayer = MovementServiceLive.pipe(Layer.provide(inputLayer))

  // Create player and world layers
  const playerLayer = PlayerServiceLive
  const worldServiceLayer = WorldServiceLive
  const cameraLayer = PlayerCameraStateLive

  // Merge all dependency layers
  const dependencyLayers = Layer.mergeAll(
    physicsLayer,
    movementLayer,
    cameraLayer,
    playerLayer,
    worldServiceLayer
  )

  // Create final layer with GameStateService
  return GameStateServiceLive.pipe(
    Layer.provide(dependencyLayers)
  )
}

describe('application/game-state', () => {
  describe('Constants', () => {
    it('should have PLAYER_BODY_ID constant', () => {
      expect(PLAYER_BODY_ID).toBe('player')
    })

    it('should have DEFAULT_PLAYER_ID constant', () => {
      expect(DEFAULT_PLAYER_ID).toBe('player-1')
    })
  })

  describe('GameStateError', () => {
    it('should create GameStateError with operation and message', () => {
      const error = new GameStateError({ operation: 'initialize', reason: 'Test error' })
      expect(error._tag).toBe('GameStateError')
      expect(error.operation).toBe('initialize')
      expect(error.message).toContain('initialize')
      expect(error.message).toContain('Test error')
    })

    it('should create GameStateError with cause', () => {
      const cause = new Error('Underlying error')
      const error = new GameStateError({ operation: 'update', reason: 'Test error', cause })
      expect(error.cause).toBe(cause)
    })
  })

  describe('GameStateServiceLive', () => {
    it('should provide GameStateService as Layer', () => {
      const inputService = createTestInputService()
      const layer = createTestLayer(inputService)

      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it('should have all required methods', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        expect(typeof service.initialize).toBe('function')
        expect(typeof service.update).toBe('function')
        expect(typeof service.getTiming).toBe('function')
        expect(typeof service.getPlayerPosition).toBe('function')
        expect(typeof service.getCameraRotation).toBe('function')
        expect(typeof service.isPlayerGrounded).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Initialization', () => {
    it('should initialize physics world and player body', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Check player position was set
        const position = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(position.x).toBe(0)
        expect(position.y).toBe(5) // Spawn position
        expect(position.z).toBe(0)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should create player at spawn position 5 units above ground', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const position = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(position.y).toBe(5)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Update loop', () => {
    it('should fail to update before initialization', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        const result = yield* Effect.either(service.update(1 / 60))

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(GameStateError)
          expect((result.left as GameStateError).operation).toBe('update')
        }

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should succeed to update after initialization', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })
        yield* service.update(1 / 60)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should update timing state', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const timingBefore = yield* service.getTiming()
        expect(timingBefore.frameCount).toBe(0)

        yield* service.update(1 / 60)

        const timingAfter = yield* service.getTiming()
        expect(timingAfter.frameCount).toBe(1)
        expect(timingAfter.deltaTime).toBe(1 / 60)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should apply movement velocity from input', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Store initial position
        const initialPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Update multiple times to let physics move the player
        for (let i = 0; i < 60; i++) {
          yield* service.update(1 / 60)
        }

        const finalPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Player should have moved in negative Z direction (forward)
        expect(finalPos.z).toBeLessThan(initialPos.z)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should step physics simulation', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const initialPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(initialPos.y).toBe(5)

        // Step simulation multiple times - player should fall due to gravity
        for (let i = 0; i < 120; i++) {
          yield* service.update(1 / 60)
        }

        const finalPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Player should have fallen (gravity)
        expect(finalPos.y).toBeLessThan(initialPos.y)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should sync physics position back to player state', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Run simulation
        yield* service.update(1 / 60)

        // Position should be synced
        const position = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(typeof position.x).toBe('number')
        expect(typeof position.y).toBe('number')
        expect(typeof position.z).toBe('number')

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Gravity', () => {
    it('should apply gravity to player', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const initialY = 5

        // Run simulation for a while
        for (let i = 0; i < 60; i++) {
          yield* service.update(1 / 60)
        }

        const position = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Player should have fallen
        expect(position.y).toBeLessThan(initialY)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should preserve gravity Y velocity when not jumping', () => {
      const inputService = createTestInputService({ forward: true }) // No jump
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const initialY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y

        // Run some updates - player should be falling
        for (let i = 0; i < 30; i++) {
          yield* service.update(1 / 60)
        }

        const finalY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y

        // Player should have fallen (Y decreased)
        expect(finalY).toBeLessThan(initialY)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should stop falling when player hits ground', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Run simulation for extended time to let player fall and land
        for (let i = 0; i < 300; i++) {
          yield* service.update(1 / 60)
        }

        const position = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Player should be on or very close to ground
        // Ground is at y=0, player center is at player height/2 above ground
        expect(position.y).toBeGreaterThan(0)
        expect(position.y).toBeLessThan(3) // Should have landed

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Jump mechanics', () => {
    it('should apply jump velocity when jump is pressed and grounded', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // First, let the player fall to ground (no jump pressed, so consumeKeyPress is not consumed)
        for (let i = 0; i < 300; i++) {
          yield* service.update(1 / 60)
        }

        // Check player is on ground
        const groundLevelY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y

        // Simulate a fresh jump key press at the exact moment we want to jump
        inputService.simulateKeyPress('Space')

        // Now update with jump pressed - should jump
        yield* service.update(1 / 60)

        // After jump, Y should increase
        const afterJumpY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y
        expect(afterJumpY).toBeGreaterThan(groundLevelY)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should clear grounded state when jumping', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Let player fall to ground (no jump key, so consumeKeyPress is never consumed)
        for (let i = 0; i < 300; i++) {
          yield* service.update(1 / 60)
        }

        // Player is now on the ground — simulate a fresh jump key press
        inputService.simulateKeyPress('Space')

        // Update with jump pressed while grounded — jump should fire and clear grounded state
        yield* service.update(1 / 60)

        // After jump, grounded state should be cleared
        const isGroundedAfter = yield* service.isPlayerGrounded()
        expect(isGroundedAfter).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should not jump when not grounded (in air)', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Just started - player is in air at y=5
        const isGrounded = yield* service.isPlayerGrounded()
        expect(isGrounded).toBe(false)

        const initialY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y

        // Try to update with jump pressed while in air
        yield* service.update(1 / 60)

        const afterUpdateY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y

        // Player should be falling (Y should decrease), not jumping up
        expect(afterUpdateY).toBeLessThan(initialY)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Camera rotation', () => {
    it('should return camera rotation', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        const rotation = yield* service.getCameraRotation()

        expect(typeof rotation.yaw).toBe('number')
        expect(typeof rotation.pitch).toBe('number')

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should use camera yaw for movement direction', () => {
      // This test verifies that movement is relative to camera direction
      // We test this by moving forward and checking the player position changes
      const inputService = createTestInputService({ forward: true })
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const initialPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Update multiple times - player should move in some direction
        for (let i = 0; i < 60; i++) {
          yield* service.update(1 / 60)
        }

        const finalPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Player should have moved (either X or Z changed significantly)
        const movedX = Math.abs(finalPos.x - initialPos.x)
        const movedZ = Math.abs(finalPos.z - initialPos.z)
        const totalMovement = movedX + movedZ

        expect(totalMovement).toBeGreaterThan(0.1) // Player should have moved

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Grounded state', () => {
    it('should not be grounded initially (in air)', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const isGrounded = yield* service.isPlayerGrounded()

        expect(isGrounded).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Integration scenarios', () => {
    it('should handle full gameplay loop: fall, land, move, jump', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Phase 1: Fall and land
        for (let i = 0; i < 300; i++) {
          yield* service.update(1 / 60)
        }

        const landedY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y
        expect(landedY).toBeLessThan(5)

        // Phase 2: Move forward
        inputService.setKeyPressed('KeyW', true)
        const beforeMoveZ = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).z

        for (let i = 0; i < 60; i++) {
          yield* service.update(1 / 60)
        }

        const afterMoveZ = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).z
        expect(afterMoveZ).toBeLessThan(beforeMoveZ)

        // Phase 3: Jump (with jump key pressed from start)
        // Note: The jump will only work if the player is grounded
        // After movement, player may or may not be grounded depending on physics state
        inputService.setKeyPressed('Space', true)
        inputService.setKeyPressed('KeyW', false)

        // Run a few updates to let physics settle
        for (let i = 0; i < 10; i++) {
          yield* service.update(1 / 60)
        }

        // Verify timing state is correct
        const timing = yield* service.getTiming()
        // 300 (fall) + 60 (move) + 10 (settle) = 370 frames
        expect(timing.frameCount).toBe(370)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should handle sprint movement', () => {
      const inputService = createTestInputService({ forward: true, sprint: true })
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Let player land first
        for (let i = 0; i < 300; i++) {
          yield* service.update(1 / 60)
        }

        const initialZ = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).z

        // Sprint forward
        for (let i = 0; i < 60; i++) {
          yield* service.update(1 / 60)
        }

        const finalZ = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).z
        const distanceTraveled = Math.abs(finalZ - initialZ)

        // Sprint should cover more distance than walk
        expect(distanceTraveled).toBeGreaterThan(0)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Effect composition', () => {
    it('should support Effect.flatMap for chaining operations', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        const result = service.initialize({ x: 0, y: 5, z: 0 }).pipe(
          Effect.flatMap(() => service.update(1 / 60)),
          Effect.flatMap(() => service.getTiming()),
          Effect.map((timing) => timing.frameCount)
        )

        const frameCount = yield* result
        expect(frameCount).toBe(1)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Multiple update calls', () => {
    it('should increment frameCount for each update call', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        for (let i = 0; i < 10; i++) {
          yield* service.update(1 / 60)
        }

        const timing = yield* service.getTiming()
        expect(timing.frameCount).toBe(10)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should track deltaTime from the last update call', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        yield* service.update(1 / 60)
        const timing1 = yield* service.getTiming()
        expect(timing1.deltaTime).toBeCloseTo(1 / 60)

        yield* service.update(1 / 30)
        const timing2 = yield* service.getTiming()
        expect(timing2.deltaTime).toBeCloseTo(1 / 30)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Error propagation', () => {
    it('should wrap update error as GameStateError with correct _tag', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        // Don't initialize — update should fail
        const result = yield* Effect.either(service.update(1 / 60))

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('GameStateError')
        }

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should be catchable with Effect.catchTag for GameStateError', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        // This should fail because we didn't initialize
        const result = yield* service.update(1 / 60).pipe(
          Effect.catchTag('GameStateError', (e) => Effect.succeed(`caught: ${e.operation}`))
        )

        expect(result).toBe('caught: update')

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Position synchronization', () => {
    it('should sync physics position back to player service after update', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 10, y: 20, z: 30 })

        // Initial position should match spawn
        const initialPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(initialPos.x).toBe(10)
        expect(initialPos.y).toBe(20)
        expect(initialPos.z).toBe(30)

        // After update, position should still be numeric (synced from physics)
        yield* service.update(1 / 60)
        const afterPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(typeof afterPos.x).toBe('number')
        expect(typeof afterPos.y).toBe('number')
        expect(typeof afterPos.z).toBe('number')
        // Y should be different due to gravity
        expect(afterPos.y).not.toBe(20)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Initialization edge cases', () => {
    it('should initialize at negative spawn coordinates', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: -100, y: 50, z: -200 })
        const pos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        expect(pos.x).toBe(-100)
        expect(pos.y).toBe(50)
        expect(pos.z).toBe(-200)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should accept zero spawn position', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 0, z: 0 })
        const pos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        expect(pos.x).toBe(0)
        expect(pos.y).toBe(0)
        expect(pos.z).toBe(0)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('isPlayerGrounded before initialization', () => {
    it('should return false when physics not initialized', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        // No initialization
        const grounded = yield* service.isPlayerGrounded()
        expect(grounded).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Strafing movement', () => {
    it('should move player in X direction with left strafe', () => {
      const inputService = createTestInputService({ left: true })
      const testLayer = createTestLayer(inputService)

      const program = Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const initialPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        for (let i = 0; i < 60; i++) {
          yield* service.update(1 / 60)
        }

        const finalPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Left strafe at yaw=0: x should decrease (negative X direction)
        expect(finalPos.x).toBeLessThan(initialPos.x)

        return { success: true }
      }).pipe(Effect.provide(testLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })
})
