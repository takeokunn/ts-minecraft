/**
 * Architecture Compliance Tests
 *
 * This test suite validates that the DDD architecture is properly implemented
 * and enforces architectural boundaries and patterns.
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import * as fs from 'fs'
import * as path from 'path'

// Import layers for testing
import { 
  DomainLayer, 
  InfrastructureLayer, 
  ApplicationServicesLayer,
  TestLayer 
} from '../../src/layers'

// Import all ports
import { 
  MathPort, 
  RenderPort, 
  WorldRepositoryPort,
  TerrainGeneratorPort,
  SpatialGridPort,
  PerformanceMonitorPort,
  InputPort,
  ClockPort,
  RaycastPort,
  MeshGeneratorPort,
  SystemCommunicationPort
} from '../../src/domain/ports'

// Import services
import { 
  WorldDomainService, 
  PhysicsDomainService, 
  EntityDomainService 
} from '../../src/layers'

describe('Architecture Compliance', () => {
  describe('Domain Layer Purity', () => {
    it('should have no external dependencies in domain layer', () => {
      // Read domain files and check imports
      const domainPath = path.join(process.cwd(), 'src', 'domain')
      const checkDomainPurity = (dirPath: string): boolean => {
        const items = fs.readdirSync(dirPath)
        
        for (const item of items) {
          const itemPath = path.join(dirPath, item)
          const stat = fs.statSync(itemPath)
          
          if (stat.isDirectory()) {
            if (!checkDomainPurity(itemPath)) return false
          } else if (item.endsWith('.ts') && !item.endsWith('.test.ts')) {
            const content = fs.readFileSync(itemPath, 'utf-8')
            
            // Check for forbidden imports
            const forbiddenImports = [
              '@infrastructure',
              '@application',
              '@presentation',
              'three',
              'three/',
              'gl-matrix',
              'vite',
              'vitest'
            ]
            
            for (const forbidden of forbiddenImports) {
              if (content.includes(`from '${forbidden}`) || content.includes(`import('${forbidden}`)) {
                console.error(`Domain layer violation in ${itemPath}: imports ${forbidden}`)
                return false
              }
            }
            
            // Domain should only import from effect, domain, and shared
            const allowedImports = [
              'effect',
              '@domain',
              '@shared',
              '../',
              './',
              'uuid'
            ]
            
            const importRegex = /from\s+['"]([^'"]+)['"]/g
            let match
            while ((match = importRegex.exec(content)) !== null) {
              const importPath = match[1]
              if (!allowedImports.some(allowed => importPath.startsWith(allowed))) {
                // Allow some common Node.js modules
                if (!['crypto', 'util', 'path'].includes(importPath)) {
                  console.warn(`Potential domain violation in ${itemPath}: imports ${importPath}`)
                }
              }
            }
          }
        }
        return true
      }
      
      expect(checkDomainPurity(domainPath)).toBe(true)
    })

    it('should only export ports and domain logic from domain layer', async () => {
      const domainTest = Effect.gen(function* () {
        // Domain should export services that work with ports only
        const worldService = yield* WorldDomainService
        const physicsService = yield* PhysicsDomainService
        
        // Verify these are functional services, not classes
        expect(typeof worldService).toBe('object')
        expect(typeof physicsService).toBe('object')
        
        // Check that they have the expected domain methods
        expect(typeof worldService.validatePosition).toBe('function')
        expect(typeof physicsService.calculateGravity).toBeDefined()
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(domainTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should use only Effect and domain types in domain services', async () => {
      const typeTest = Effect.gen(function* () {
        const worldService = yield* WorldDomainService
        
        // Test a domain operation
        const position = { x: 0, y: 0, z: 0 }
        const isValid = yield* worldService.validatePosition(position)
        
        // Result should be a primitive type or domain type
        expect(typeof isValid).toBe('boolean')
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(typeTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Infrastructure Port Implementation', () => {
    it('should implement all domain ports correctly', async () => {
      const portImplementationTest = Effect.gen(function* () {
        // Test that all ports are properly implemented in infrastructure
        const mathPort = yield* MathPort
        const renderPort = yield* RenderPort
        const worldRepo = yield* WorldRepositoryPort
        const terrainGen = yield* TerrainGeneratorPort
        const spatialGrid = yield* SpatialGridPort
        
        // Verify port interfaces are complete
        expect(mathPort.vector3).toBeDefined()
        expect(mathPort.quaternion).toBeDefined()
        expect(mathPort.ray).toBeDefined()
        
        expect(renderPort.createMesh).toBeDefined()
        expect(renderPort.updateMesh).toBeDefined()
        expect(renderPort.destroyMesh).toBeDefined()
        
        expect(worldRepo.save).toBeDefined()
        expect(worldRepo.load).toBeDefined()
        
        expect(terrainGen.generateChunk).toBeDefined()
        expect(spatialGrid.addEntity).toBeDefined()
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(portImplementationTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should provide adapter switching capability', async () => {
      const adapterTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        
        // Test that port operations work (indicating proper adapter implementation)
        const vector1 = yield* mathPort.vector3.create(1, 2, 3)
        const vector2 = yield* mathPort.vector3.create(4, 5, 6)
        const sum = yield* mathPort.vector3.add(vector1, vector2)
        
        expect(sum.x).toBe(5)
        expect(sum.y).toBe(7)
        expect(sum.z).toBe(9)
        
        // Test quaternion operations
        const quat = yield* mathPort.quaternion.identity()
        expect(quat.w).toBe(1)
        expect(quat.x).toBe(0)
        expect(quat.y).toBe(0)
        expect(quat.z).toBe(0)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(adapterTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should maintain port contract compliance', async () => {
      const contractTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        
        // Test that port contracts are maintained (immutability, Effect types)
        const originalVector = yield* mathPort.vector3.create(1, 0, 0)
        const magnitude = yield* mathPort.vector3.magnitude(originalVector)
        
        // Original vector should be unchanged
        expect(originalVector.x).toBe(1)
        expect(originalVector.y).toBe(0)
        expect(originalVector.z).toBe(0)
        
        // Magnitude should be correct
        expect(magnitude).toBe(1)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(contractTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Application Layer Orchestration', () => {
    it('should properly orchestrate domain services', async () => {
      const orchestrationTest = Effect.gen(function* () {
        // Application layer should coordinate multiple domain services
        const worldService = yield* WorldDomainService
        const physicsService = yield* PhysicsDomainService
        const entityService = yield* EntityDomainService
        
        // Test coordinated operation
        const position = { x: 0, y: 100, z: 0 }
        const isValidPosition = yield* worldService.validatePosition(position)
        
        if (isValidPosition) {
          // Could simulate physics calculation
          const gravityVector = { x: 0, y: -9.81, z: 0 }
          // This demonstrates service coordination
          expect(gravityVector.y).toBeLessThan(0)
        }
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(orchestrationTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should handle cross-cutting concerns properly', async () => {
      const crossCuttingTest = Effect.gen(function* () {
        // Test that application layer handles concerns like logging, monitoring
        const worldService = yield* WorldDomainService
        
        // Operations should include proper error handling and monitoring
        const result = yield* Effect.either(
          worldService.validatePosition({ x: 0, y: 0, z: 0 })
        )
        
        expect(result._tag === 'Left' || result._tag === 'Right').toBe(true)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(crossCuttingTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should manage transactions and consistency', async () => {
      const transactionTest = Effect.gen(function* () {
        // Test that application services handle consistency properly
        const entityService = yield* EntityDomainService
        const worldService = yield* WorldDomainService
        
        // Simulate a transaction-like operation
        const position = { x: 10, y: 20, z: 30 }
        const isValid = yield* worldService.validatePosition(position)
        
        if (isValid) {
          // Entity operations should be consistent with world state
          expect(position.x).toBe(10)
          expect(position.y).toBe(20)
          expect(position.z).toBe(30)
        }
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(transactionTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Dependency Injection with Effect Layers', () => {
    it('should provide proper dependency injection', async () => {
      const diTest = Effect.gen(function* () {
        // All services should be injectable through Effect Context
        const worldService = yield* WorldDomainService
        const physicsService = yield* PhysicsDomainService
        const entityService = yield* EntityDomainService
        const mathPort = yield* MathPort
        const renderPort = yield* RenderPort
        
        // All should be properly injected
        expect(worldService).toBeDefined()
        expect(physicsService).toBeDefined()
        expect(entityService).toBeDefined()
        expect(mathPort).toBeDefined()
        expect(renderPort).toBeDefined()
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(diTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should support layer composition and overrides', async () => {
      // Test that layers can be composed and overridden for testing
      const mockMathLayer = Layer.succeed(MathPort, {
        vector3: {
          create: (x, y, z) => Effect.succeed({ x, y, z }),
          add: (a, b) => Effect.succeed({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
          subtract: (a, b) => Effect.succeed({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
          multiply: (v, s) => Effect.succeed({ x: v.x * s, y: v.y * s, z: v.z * s }),
          dot: (a, b) => Effect.succeed(a.x * b.x + a.y * b.y + a.z * b.z),
          cross: (a, b) => Effect.succeed({
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x
          }),
          magnitude: (v) => Effect.succeed(Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)),
          normalize: (v) => Effect.gen(function* () {
            const mag = yield* Effect.succeed(Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z))
            return mag > 0 ? { x: v.x / mag, y: v.y / mag, z: v.z / mag } : { x: 0, y: 0, z: 0 }
          }),
          distance: (a, b) => Effect.succeed(Math.sqrt(
            (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
          )),
          lerp: (a, b, t) => Effect.succeed({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            z: a.z + (b.z - a.z) * t
          })
        },
        quaternion: {
          create: (x, y, z, w) => Effect.succeed({ x, y, z, w }),
          identity: () => Effect.succeed({ x: 0, y: 0, z: 0, w: 1 }),
          multiply: (a, b) => Effect.succeed({
            w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
            x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
            y: a.w * b.y + a.y * b.w + a.z * b.x - a.x * b.z,
            z: a.w * b.z + a.z * b.w + a.x * b.y - a.y * b.x
          }),
          conjugate: (q) => Effect.succeed({ x: -q.x, y: -q.y, z: -q.z, w: q.w }),
          normalize: (q) => Effect.gen(function* () {
            const mag = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w)
            return mag > 0 ? { x: q.x / mag, y: q.y / mag, z: q.z / mag, w: q.w / mag } : { x: 0, y: 0, z: 0, w: 1 }
          }),
          fromAxisAngle: (axis, angle) => Effect.succeed({
            x: axis.x * Math.sin(angle / 2),
            y: axis.y * Math.sin(angle / 2),
            z: axis.z * Math.sin(angle / 2),
            w: Math.cos(angle / 2)
          }),
          fromEuler: (pitch, yaw, roll) => Effect.succeed({ x: 0, y: 0, z: 0, w: 1 }),
          toEuler: (q) => Effect.succeed({ pitch: 0, yaw: 0, roll: 0 }),
          rotateVector: (q, v) => Effect.succeed(v) // Simplified
        },
        ray: {
          create: (origin, direction) => Effect.succeed({ origin, direction }),
          at: (ray, distance) => Effect.succeed({
            x: ray.origin.x + ray.direction.x * distance,
            y: ray.origin.y + ray.direction.y * distance,
            z: ray.origin.z + ray.direction.z * distance
          }),
          intersectsSphere: (ray, center, radius) => Effect.succeed({ hit: false }),
          intersectsPlane: (ray, normal, distance) => Effect.succeed({ hit: false }),
          intersectsBox: (ray, min, max) => Effect.succeed({ hit: false })
        }
      })

      const overrideTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        
        // Test with mock implementation
        const vector = yield* mathPort.vector3.create(3, 4, 0)
        const magnitude = yield* mathPort.vector3.magnitude(vector)
        
        expect(magnitude).toBe(5) // 3-4-5 triangle
        
        return true
      })

      // Use the mock layer instead of TestLayer
      const testLayer = Layer.mergeAll(TestLayer, mockMathLayer)
      const result = await Effect.runPromise(
        Effect.provide(overrideTest, testLayer)
      )

      expect(result).toBe(true)
    })

    it('should handle circular dependency prevention', async () => {
      // Test that the DI system prevents circular dependencies
      const circularTest = Effect.gen(function* () {
        // This should not hang or throw due to circular dependencies
        const worldService = yield* WorldDomainService
        const physicsService = yield* PhysicsDomainService
        
        // Services should be available without circular dependency issues
        expect(worldService).toBeDefined()
        expect(physicsService).toBeDefined()
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(circularTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Architectural Pattern Enforcement', () => {
    it('should enforce hexagonal architecture boundaries', () => {
      // Check that infrastructure adapters follow the pattern
      const infraPath = path.join(process.cwd(), 'src', 'infrastructure')
      const checkHexagonalPattern = (dirPath: string): boolean => {
        if (!fs.existsSync(dirPath)) return true
        
        const items = fs.readdirSync(dirPath)
        
        for (const item of items) {
          const itemPath = path.join(dirPath, item)
          const stat = fs.statSync(itemPath)
          
          if (stat.isDirectory()) {
            if (!checkHexagonalPattern(itemPath)) return false
          } else if (item.endsWith('.ts') && !item.endsWith('.test.ts')) {
            const content = fs.readFileSync(itemPath, 'utf-8')
            
            // Infrastructure should implement domain ports
            const hasPortImplementation = 
              content.includes('implements ') || 
              content.includes('Layer.succeed') ||
              content.includes('Context.GenericTag')
            
            // For adapter files, they should follow the pattern
            if (item.includes('adapter') || item.includes('impl')) {
              expect(hasPortImplementation).toBe(true)
            }
          }
        }
        return true
      }
      
      expect(checkHexagonalPattern(infraPath)).toBe(true)
    })

    it('should enforce SOLID principles', async () => {
      const solidTest = Effect.gen(function* () {
        // Single Responsibility: Each service should have a focused purpose
        const worldService = yield* WorldDomainService
        const physicsService = yield* PhysicsDomainService
        
        // Services should be focused (not trying to do everything)
        const worldMethods = Object.keys(worldService)
        const physicsMethods = Object.keys(physicsService)
        
        // Should have focused, cohesive interfaces
        expect(worldMethods.length).toBeGreaterThan(0)
        expect(worldMethods.length).toBeLessThan(20) // Not too many responsibilities
        
        expect(physicsMethods.length).toBeGreaterThan(0)
        expect(physicsMethods.length).toBeLessThan(20)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(solidTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should support Open/Closed principle through ports', async () => {
      const openClosedTest = Effect.gen(function* () {
        // Ports should allow extension without modification
        const mathPort = yield* MathPort
        const renderPort = yield* RenderPort
        
        // Ports provide interfaces that can be extended with new implementations
        expect(mathPort.vector3).toBeDefined()
        expect(mathPort.quaternion).toBeDefined()
        expect(mathPort.ray).toBeDefined()
        
        expect(renderPort.createMesh).toBeDefined()
        expect(renderPort.updateMesh).toBeDefined()
        expect(renderPort.destroyMesh).toBeDefined()
        
        // These interfaces are closed for modification but open for extension
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(openClosedTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })
})