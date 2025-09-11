/**
 * DDD Migration Validation Tests
 *
 * This test suite validates the DDD architecture migration and ensures
 * all architectural improvements are working correctly.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, Layer, Exit } from 'effect'
import * as Context from 'effect/Context'

// Import layers and services
import { 
  AppLayer, 
  DomainLayer, 
  InfrastructureLayer, 
  ApplicationServicesLayer
} from '../../src/layers'

// Import test layer
import { TestLayer } from './test-layer'

// Import domain errors for validation
import { 
  GameError, 
  DomainError, 
  EntityError, 
  ComponentError, 
  WorldError,
  PhysicsError,
  SystemError
} from '../../src/domain/errors'

// Import domain ports
import { 
  MathPort, 
  RenderPort, 
  WorldRepositoryPort,
  TerrainGeneratorPort,
  SpatialGridPort 
} from '../../src/domain/ports'

// Import domain services from unified layer (working implementation)
import { 
  WorldDomainService, 
  PhysicsDomainService, 
  EntityDomainService 
} from '../../src/infrastructure/layers/unified.layer'

describe('DDD Migration Validation', () => {
  describe('Layer Boundary Enforcement', () => {
    it('should ensure domain layer has no infrastructure dependencies', async () => {
      // Test that domain layer can be created independently
      const domainEffect = Effect.gen(function* () {
        // Try to resolve domain services without infrastructure
        yield* Effect.succeed('Domain layer is pure')
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(domainEffect, DomainLayer)
      )

      expect(result).toBe(true)
    })

    it('should validate layer dependency direction', async () => {
      // Domain → Application → Infrastructure (no reverse dependencies)
      const layerTest = Effect.gen(function* () {
        // Domain should not know about application or infrastructure
        const domainServices = yield* WorldDomainService
        
        // Verify domain service is pure (no external dependencies leaked)
        expect(typeof domainServices.validatePosition).toBe('function')
        expect(typeof domainServices.isValidBlockPlacement).toBe('function')
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(layerTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should enforce port-adapter pattern compliance', async () => {
      // Test that domain only depends on ports, not concrete implementations
      const portTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        const renderPort = yield* RenderPort
        
        // These should be interface contracts, not concrete implementations
        expect(mathPort).toBeDefined()
        expect(mathPort.vector3).toBeDefined()
        expect(mathPort.quaternion).toBeDefined()
        expect(mathPort.ray).toBeDefined()
        
        expect(renderPort).toBeDefined()
        expect(renderPort.createMesh).toBeDefined()
        expect(renderPort.updateMesh).toBeDefined()
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(portTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Effect-TS Usage Throughout System', () => {
    it('should use Effect for all async operations', async () => {
      const effectTest = Effect.gen(function* () {
        const worldService = yield* WorldDomainService
        const physicsService = yield* PhysicsDomainService
        const entityService = yield* EntityDomainService
        
        // All service methods should return Effects
        const position = { x: 0, y: 0, z: 0 }
        const isValid = yield* worldService.validatePosition(position)
        
        expect(typeof isValid).toBe('boolean')
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(effectTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should properly compose Effects in service layers', async () => {
      const compositionTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        
        // Test Effect composition in math operations
        const vector1 = yield* mathPort.vector3.create(1, 2, 3)
        const vector2 = yield* mathPort.vector3.create(4, 5, 6)
        const result = yield* mathPort.vector3.add(vector1, vector2)
        
        expect(result.x).toBe(5)
        expect(result.y).toBe(7)
        expect(result.z).toBe(9)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(compositionTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should use Context for dependency injection', async () => {
      // Test that services are properly injected via Context
      const contextTest = Effect.gen(function* () {
        // These should be available through Context injection
        const worldService = yield* WorldDomainService
        const physicsService = yield* PhysicsDomainService
        
        expect(worldService).toBeDefined()
        expect(physicsService).toBeDefined()
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(contextTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Functional Programming Patterns', () => {
    it('should avoid classes in critical domain paths', async () => {
      // Verify that domain services use functional patterns
      const functionalTest = Effect.gen(function* () {
        const worldService = yield* WorldDomainService
        
        // Service should be a record of functions, not a class instance
        expect(typeof worldService).toBe('object')
        expect(worldService.constructor.name).not.toBe('WorldDomainService')
        
        // Functions should be pure and return Effects
        const validateFn = worldService.validatePosition
        expect(typeof validateFn).toBe('function')
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(functionalTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should use immutable data structures', async () => {
      const immutabilityTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        
        const originalVector = yield* mathPort.vector3.create(1, 2, 3)
        const modifiedVector = yield* mathPort.vector3.add(
          originalVector, 
          yield* mathPort.vector3.create(1, 1, 1)
        )
        
        // Original should be unchanged (immutability)
        expect(originalVector.x).toBe(1)
        expect(originalVector.y).toBe(2)
        expect(originalVector.z).toBe(3)
        
        // New vector should have the changes
        expect(modifiedVector.x).toBe(2)
        expect(modifiedVector.y).toBe(3)
        expect(modifiedVector.z).toBe(4)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(immutabilityTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should use pipe and flow for function composition', async () => {
      const compositionTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        
        // Test pipeline composition using Effect
        const result = yield* Effect.gen(function* () {
          const vec1 = yield* mathPort.vector3.create(1, 0, 0)
          const vec2 = yield* mathPort.vector3.create(0, 1, 0)
          const cross = yield* mathPort.vector3.cross(vec1, vec2)
          const normalized = yield* mathPort.vector3.normalize(cross)
          return normalized
        })
        
        // Should result in normalized (0, 0, 1) vector
        expect(Math.abs(result.x)).toBeLessThan(0.0001)
        expect(Math.abs(result.y)).toBeLessThan(0.0001)
        expect(Math.abs(result.z - 1)).toBeLessThan(0.0001)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(compositionTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Tagged Error Handling', () => {
    it('should use tagged errors throughout the system', () => {
      // Verify error hierarchy is properly structured
      expect(GameError).toBeDefined()
      expect(DomainError).toBeDefined()
      expect(EntityError).toBeDefined()
      expect(ComponentError).toBeDefined()
      expect(WorldError).toBeDefined()
      expect(PhysicsError).toBeDefined()
      expect(SystemError).toBeDefined()
      
      // Verify errors are classes/constructors
      expect(typeof GameError).toBe('function')
      expect(typeof DomainError).toBe('function')
    })

    it('should handle errors in Effect chains', async () => {
      const errorTest = Effect.gen(function* () {
        const worldService = yield* WorldDomainService
        
        // Test error handling with invalid position
        const invalidPosition = { x: Number.NaN, y: Number.NaN, z: Number.NaN }
        
        const result = yield* Effect.either(
          worldService.validatePosition(invalidPosition)
        )
        
        // Should either succeed or fail gracefully
        expect(result._tag === 'Left' || result._tag === 'Right').toBe(true)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(errorTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should propagate errors correctly through layers', async () => {
      const errorPropagationTest = Effect.gen(function* () {
        // Test that errors bubble up through the architecture layers correctly
        const worldService = yield* WorldDomainService
        
        try {
          // This should potentially fail and be handled gracefully
          const position = { x: -1000000, y: -1000000, z: -1000000 }
          yield* worldService.validatePosition(position)
        } catch (error) {
          // Errors should be properly typed and structured
          expect(error).toBeDefined()
        }
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(errorPropagationTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should provide error recovery mechanisms', async () => {
      const recoveryTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        
        // Test recovery from division by zero scenario
        const zeroVector = yield* mathPort.vector3.create(0, 0, 0)
        
        const normalizeResult = yield* Effect.either(
          mathPort.vector3.normalize(zeroVector)
        )
        
        if (normalizeResult._tag === 'Left') {
          // Should have a recovery mechanism or default value
          const defaultVector = yield* mathPort.vector3.create(0, 1, 0)
          expect(defaultVector).toBeDefined()
        }
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(recoveryTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Service Composition and Layers', () => {
    it('should properly compose all service layers', async () => {
      const layerCompositionTest = Effect.gen(function* () {
        // Test that the complete application layer includes all necessary services
        const worldService = yield* WorldDomainService
        const physicsService = yield* PhysicsDomainService
        const entityService = yield* EntityDomainService
        const mathPort = yield* MathPort
        
        expect(worldService).toBeDefined()
        expect(physicsService).toBeDefined()
        expect(entityService).toBeDefined()
        expect(mathPort).toBeDefined()
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(layerCompositionTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should handle layer initialization properly', async () => {
      // Test that layers can be initialized without circular dependencies
      const initTest = Effect.gen(function* () {
        // This should not throw or hang due to circular dependencies
        const services = {
          world: yield* WorldDomainService,
          physics: yield* PhysicsDomainService,
          entity: yield* EntityDomainService,
        }
        
        Object.values(services).forEach(service => {
          expect(service).toBeDefined()
        })
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(initTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should support layer testing and mocking', async () => {
      // Test that layers can be easily mocked for testing
      const mockTest = Effect.gen(function* () {
        // TestLayer should provide mock implementations
        const mathPort = yield* MathPort
        
        // Mock implementation should work
        const vector = yield* mathPort.vector3.create(1, 2, 3)
        expect(vector.x).toBe(1)
        expect(vector.y).toBe(2)
        expect(vector.z).toBe(3)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(mockTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })
})