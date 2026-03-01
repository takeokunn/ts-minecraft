import { describe, it, expect, vi } from 'vitest'
import { Effect, Layer } from 'effect'
import * as CANNON from 'cannon-es'
import {
  PhysicsService,
  PhysicsServiceLive,
  GROUND_DETECTION_DISTANCE,
  PLAYER_FEET_OFFSET,
} from './physics-service'
import { PhysicsWorldServiceLive } from '../../infrastructure/cannon/boundary/world-service'
import { RigidBodyServiceLive } from '../../infrastructure/cannon/boundary/body-service'
import { ShapeServiceLive } from '../../infrastructure/cannon/boundary/shape-service'

// Create test layer by combining all dependencies
const TestLayer = PhysicsServiceLive.pipe(
  Layer.provide(PhysicsWorldServiceLive),
  Layer.provide(RigidBodyServiceLive),
  Layer.provide(ShapeServiceLive)
)

describe('application/physics/physics-service', () => {
  describe('PhysicsServiceLive', () => {
    it('should provide PhysicsService as Layer', () => {
      const layer = PhysicsServiceLive

      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it('should have all required methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        expect(typeof service.initialize).toBe('function')
        expect(typeof service.createPlayerBody).toBe('function')
        expect(typeof service.createGroundPlane).toBe('function')
        expect(typeof service.initializeScene).toBe('function')
        expect(typeof service.step).toBe('function')
        expect(typeof service.getBody).toBe('function')
        expect(typeof service.applyImpulse).toBe('function')
        expect(typeof service.setVelocity).toBe('function')
        expect(typeof service.isGrounded).toBe('function')
        expect(typeof service.checkGroundContact).toBe('function')
        expect(typeof service.onGroundCollision).toBe('function')
        expect(typeof service.clearGroundedState).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('World initialization', () => {
    it('should initialize physics world with default gravity', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const world = yield* service.initialize()

        expect(world).toBeInstanceOf(CANNON.World)
        expect(world.gravity.x).toBe(0)
        expect(world.gravity.y).toBe(-9.82)
        expect(world.gravity.z).toBe(0)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Player body creation', () => {
    it('should create player body with correct properties', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        const body = yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })

        expect(body).toBeInstanceOf(CANNON.Body)
        expect(body.mass).toBe(70)
        expect(body.position.x).toBe(0)
        expect(body.position.y).toBe(10)
        expect(body.position.z).toBe(0)
        expect(body.shapes.length).toBe(1)
        expect(body.shapes[0]).toBeInstanceOf(CANNON.Box)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should fail to create player body before initialization', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const result = yield* Effect.either(service.createPlayerBody('player1', { x: 0, y: 10, z: 0 }))

        expect(result._tag).toBe('Left')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should set fixedRotation to true on player body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        const body = yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })

        expect(body.fixedRotation).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should set angularDamping to 1 on player body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        const body = yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })

        expect(body.angularDamping).toBe(1)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should keep quaternion at identity after lateral impulse and physics step', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const world = yield* service.initialize()
        const body = yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })

        // Apply a strong lateral impulse that would cause rotation without fixedRotation
        yield* service.applyImpulse('player1', { x: 500, y: 0, z: 0 })

        // Step the simulation to let the impulse take effect
        for (let i = 0; i < 10; i++) {
          yield* service.step(world, 1 / 60)
        }

        // Quaternion should remain at identity (no rotation) due to fixedRotation = true
        expect(body.quaternion.x).toBeCloseTo(0, 5)
        expect(body.quaternion.y).toBeCloseTo(0, 5)
        expect(body.quaternion.z).toBeCloseTo(0, 5)
        expect(body.quaternion.w).toBeCloseTo(1, 5)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should track multiple player bodies', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        const body1 = yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })
        const body2 = yield* service.createPlayerBody('player2', { x: 5, y: 10, z: 5 })

        const retrievedBody1 = yield* service.getBody('player1')
        const retrievedBody2 = yield* service.getBody('player2')

        expect(retrievedBody1).toBe(body1)
        expect(retrievedBody2).toBe(body2)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Ground plane creation', () => {
    it('should create ground plane', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        const ground = yield* service.createGroundPlane()

        expect(ground).toBeInstanceOf(CANNON.Body)
        expect(ground.mass).toBe(0) // Static body
        expect(ground.shapes.length).toBe(1)
        expect(ground.shapes[0]).toBeInstanceOf(CANNON.Plane)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should fail to create ground plane before initialization', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const result = yield* Effect.either(service.createGroundPlane())

        expect(result._tag).toBe('Left')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Scene initialization', () => {
    it('should initialize scene with world and ground body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const { world, groundBody } = yield* service.initializeScene()

        expect(world).toBeInstanceOf(CANNON.World)
        expect(groundBody).toBeInstanceOf(CANNON.Body)

        // Verify world has correct gravity
        expect(world.gravity.x).toBe(0)
        expect(world.gravity.y).toBe(-9.82)
        expect(world.gravity.z).toBe(0)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should create ground body as static (mass = 0)', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const { groundBody } = yield* service.initializeScene()

        expect(groundBody.mass).toBe(0)
        expect(groundBody.shapes.length).toBe(1)
        expect(groundBody.shapes[0]).toBeInstanceOf(CANNON.Plane)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should add ground body to world', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const { world, groundBody } = yield* service.initializeScene()

        // Check ground body is in the world
        expect(world.bodies).toContain(groundBody)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Step simulation', () => {
    it('should step the simulation', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const world = yield* service.initialize()
        yield* service.step(world, 1 / 60)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should simulate falling body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const world = yield* service.initialize()
        const body = yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })

        const initialY = body.position.y

        // Step simulation multiple times
        for (let i = 0; i < 60; i++) {
          yield* service.step(world, 1 / 60)
        }

        // Body should have fallen
        expect(body.position.y).toBeLessThan(initialY)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Body retrieval', () => {
    it('should return null for unknown body ID', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        const body = yield* service.getBody('unknown')

        expect(body).toBeNull()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should return body for known ID', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        const createdBody = yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })
        const retrievedBody = yield* service.getBody('player1')

        expect(retrievedBody).toBe(createdBody)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Velocity setting', () => {
    it('should set velocity on body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })
        yield* service.setVelocity('player1', { x: 5, y: 2, z: -3 })

        const body = yield* service.getBody('player1')

        expect(body!.velocity.x).toBe(5)
        expect(body!.velocity.y).toBe(2)
        expect(body!.velocity.z).toBe(-3)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should fail to set velocity on unknown body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        const result = yield* Effect.either(service.setVelocity('unknown', { x: 5, y: 2, z: -3 }))

        expect(result._tag).toBe('Left')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Impulse application', () => {
    it('should apply impulse to body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })
        yield* service.applyImpulse('player1', { x: 0, y: 500, z: 0 })

        const body = yield* service.getBody('player1')

        // After impulse, velocity should have changed
        // impulse = mass * delta_velocity => delta_v = impulse / mass = 500 / 70 = 7.14
        expect(body!.velocity.y).toBeCloseTo(500 / 70, 2)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should fail to apply impulse on unknown body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        const result = yield* Effect.either(service.applyImpulse('unknown', { x: 0, y: 500, z: 0 }))

        expect(result._tag).toBe('Left')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Grounded state', () => {
    it('should initially not be grounded', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })

        const grounded = yield* service.isGrounded('player1')

        expect(grounded).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should return false for unknown body ID', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        const grounded = yield* service.isGrounded('unknown')

        expect(grounded).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Ground contact checking', () => {
    it('should return false for ground contact when no contact', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })

        const hasContact = yield* service.checkGroundContact('player1')

        expect(hasContact).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should return false for unknown body ID', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        const hasContact = yield* service.checkGroundContact('unknown')

        expect(hasContact).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Clear grounded state', () => {
    it('should clear grounded state for a body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })

        // Initially not grounded
        const initiallyGrounded = yield* service.isGrounded('player1')
        expect(initiallyGrounded).toBe(false)

        // Clear grounded state (used when jumping)
        yield* service.clearGroundedState('player1')

        // Should still not be grounded
        const afterClearGrounded = yield* service.isGrounded('player1')
        expect(afterClearGrounded).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should clear ground contact count when clearing grounded state', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })

        // Clear grounded state
        yield* service.clearGroundedState('player1')

        // Check ground contact should also be false
        const hasContact = yield* service.checkGroundContact('player1')
        expect(hasContact).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Ground collision callbacks', () => {
    it('should register ground collision callback', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })

        const callback = vi.fn()
        yield* service.onGroundCollision('player1', callback)

        // Callback is registered but not called yet
        expect(callback).not.toHaveBeenCalled()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should support multiple callbacks for same body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize()
        yield* service.createPlayerBody('player1', { x: 0, y: 10, z: 0 })

        const callback1 = vi.fn()
        const callback2 = vi.fn()
        yield* service.onGroundCollision('player1', callback1)
        yield* service.onGroundCollision('player1', callback2)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Effect composition', () => {
    it('should support Effect.flatMap for chaining operations', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const result = service.initialize().pipe(
          Effect.flatMap((world) => service.step(world, 1 / 60)),
          Effect.map(() => ({ success: true }))
        )

        expect(typeof result.pipe).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Raycast-based ground detection', () => {
    it('should have correct ground detection constants', () => {
      expect(GROUND_DETECTION_DISTANCE).toBe(0.15)
      expect(PLAYER_FEET_OFFSET).toBe(0.9)
    })

    it('should detect ground when player lands on ground plane', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const { world } = yield* service.initializeScene()
        yield* service.createPlayerBody('player1', { x: 0, y: 5, z: 0 })

        // Player should not be grounded initially (5 units above ground)
        const initialGrounded = yield* service.isGrounded('player1')
        expect(initialGrounded).toBe(false)

        // Simulate falling until player hits ground
        for (let i = 0; i < 300; i++) {
          yield* service.step(world, 1 / 60)
        }

        // After falling, player should be grounded
        const finalGrounded = yield* service.isGrounded('player1')
        expect(finalGrounded).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should not be grounded when player jumps', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const { world } = yield* service.initializeScene()
        yield* service.createPlayerBody('player1', { x: 0, y: 5, z: 0 })

        // Let player fall to ground
        for (let i = 0; i < 300; i++) {
          yield* service.step(world, 1 / 60)
        }

        // Player should be on ground
        const beforeJumpGrounded = yield* service.isGrounded('player1')
        expect(beforeJumpGrounded).toBe(true)

        // Apply jump impulse
        yield* service.applyImpulse('player1', { x: 0, y: 500, z: 0 })

        // Step multiple times to let player rise above ground detection range
        for (let i = 0; i < 5; i++) {
          yield* service.step(world, 1 / 60)
        }

        // Player should no longer be grounded after jumping
        const afterJumpGrounded = yield* service.isGrounded('player1')
        expect(afterJumpGrounded).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should properly detect grounded state after landing', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const { world } = yield* service.initializeScene()
        yield* service.createPlayerBody('player1', { x: 0, y: 5, z: 0 })

        // Fall and land (need enough frames for physics to settle)
        for (let i = 0; i < 500; i++) {
          yield* service.step(world, 1 / 60)
        }

        // After landing, check grounded
        const isGroundedAfterLanding = yield* service.isGrounded('player1')

        // Jump
        yield* service.applyImpulse('player1', { x: 0, y: 500, z: 0 })
        for (let i = 0; i < 10; i++) {
          yield* service.step(world, 1 / 60)
        }

        // In air
        expect(yield* service.isGrounded('player1')).toBe(false)

        // Fall back down
        for (let i = 0; i < 500; i++) {
          yield* service.step(world, 1 / 60)
        }

        // Landed again
        expect(yield* service.isGrounded('player1')).toBe(true)

        // Also verify the first landing was successful
        expect(isGroundedAfterLanding).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Physics raycast', () => {
    it('should have raycast method', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        expect(typeof service.raycast).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return no hit when raycast hits nothing', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const world = yield* service.initialize()

        const result = yield* service.raycast(
          world,
          { x: 0, y: 10, z: 0 },
          { x: 0, y: -1, z: 0 },
          5
        )

        expect(result.hasHit).toBe(false)
        expect(result.body).toBeNull()
        expect(result.hitPoint).toBeNull()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return hit when raycast hits ground plane', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const { world } = yield* service.initializeScene()

        // Raycast from above the ground
        const result = yield* service.raycast(
          world,
          { x: 0, y: 10, z: 0 },
          { x: 0, y: -1, z: 0 },
          15
        )

        expect(result.hasHit).toBe(true)
        expect(result.body).not.toBeNull()
        expect(result.hitPoint).not.toBeNull()
        expect(result.hitPoint!.y).toBeCloseTo(0, 1)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should respect max distance', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const { world } = yield* service.initializeScene()

        // Raycast from far above ground with short max distance
        const result = yield* service.raycast(
          world,
          { x: 0, y: 100, z: 0 },
          { x: 0, y: -1, z: 0 },
          5 // Only cast 5 units, ground is 100 units away
        )

        expect(result.hasHit).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })
})
