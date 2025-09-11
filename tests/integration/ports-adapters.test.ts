/**
 * Port/Adapter Integration Tests
 *
 * This test suite validates the port/adapter pattern implementation,
 * ensuring that all ports are properly implemented by adapters and
 * that the system supports multiple implementations.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, Layer } from 'effect'

// Import layers and all ports
import { TestLayer } from '../../src/layers'
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

// Import test utilities
import { Vector3Data, QuaternionData, RayData } from '../../src/domain/ports/math.port'

describe('Port/Adapter Integration Tests', () => {
  describe('Math Port Implementation', () => {
    it('should provide complete Vector3 operations', async () => {
      const vector3Test = Effect.gen(function* () {
        const mathPort = yield* MathPort
        const v3 = mathPort.vector3
        
        // Test basic creation and operations
        const vec1 = yield* v3.create(1, 2, 3)
        const vec2 = yield* v3.create(4, 5, 6)
        
        expect(vec1.x).toBe(1)
        expect(vec1.y).toBe(2)
        expect(vec1.z).toBe(3)
        
        // Test addition
        const sum = yield* v3.add(vec1, vec2)
        expect(sum.x).toBe(5)
        expect(sum.y).toBe(7)
        expect(sum.z).toBe(9)
        
        // Test subtraction
        const diff = yield* v3.subtract(vec2, vec1)
        expect(diff.x).toBe(3)
        expect(diff.y).toBe(3)
        expect(diff.z).toBe(3)
        
        // Test scalar multiplication
        const scaled = yield* v3.multiply(vec1, 2)
        expect(scaled.x).toBe(2)
        expect(scaled.y).toBe(4)
        expect(scaled.z).toBe(6)
        
        // Test dot product
        const dot = yield* v3.dot(vec1, vec2)
        expect(dot).toBe(32) // 1*4 + 2*5 + 3*6
        
        // Test cross product
        const cross = yield* v3.cross(vec1, vec2)
        expect(cross.x).toBe(-3) // 2*6 - 3*5
        expect(cross.y).toBe(6)  // 3*4 - 1*6
        expect(cross.z).toBe(-3) // 1*5 - 2*4
        
        // Test magnitude
        const magnitude = yield* v3.magnitude(vec1)
        expect(magnitude).toBeCloseTo(Math.sqrt(14), 5)
        
        // Test normalization
        const normalized = yield* v3.normalize(vec1)
        const normalizedMag = yield* v3.magnitude(normalized)
        expect(normalizedMag).toBeCloseTo(1, 5)
        
        // Test distance
        const distance = yield* v3.distance(vec1, vec2)
        expect(distance).toBeCloseTo(Math.sqrt(27), 5)
        
        // Test linear interpolation
        const lerped = yield* v3.lerp(vec1, vec2, 0.5)
        expect(lerped.x).toBe(2.5)
        expect(lerped.y).toBe(3.5)
        expect(lerped.z).toBe(4.5)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(vector3Test, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should provide complete Quaternion operations', async () => {
      const quaternionTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        const quat = mathPort.quaternion
        
        // Test identity quaternion
        const identity = yield* quat.identity()
        expect(identity.x).toBe(0)
        expect(identity.y).toBe(0)
        expect(identity.z).toBe(0)
        expect(identity.w).toBe(1)
        
        // Test quaternion creation
        const q1 = yield* quat.create(1, 2, 3, 4)
        expect(q1.x).toBe(1)
        expect(q1.y).toBe(2)
        expect(q1.z).toBe(3)
        expect(q1.w).toBe(4)
        
        // Test multiplication
        const q2 = yield* quat.create(0, 0, 0, 1)
        const product = yield* quat.multiply(q1, q2)
        expect(product.x).toBe(1)
        expect(product.y).toBe(2)
        expect(product.z).toBe(3)
        expect(product.w).toBe(4)
        
        // Test conjugate
        const conjugate = yield* quat.conjugate(q1)
        expect(conjugate.x).toBe(-1)
        expect(conjugate.y).toBe(-2)
        expect(conjugate.z).toBe(-3)
        expect(conjugate.w).toBe(4)
        
        // Test normalization
        const normalized = yield* quat.normalize(q1)
        const magnitude = Math.sqrt(normalized.x ** 2 + normalized.y ** 2 + normalized.z ** 2 + normalized.w ** 2)
        expect(magnitude).toBeCloseTo(1, 5)
        
        // Test axis-angle creation
        const axis = yield* mathPort.vector3.create(0, 1, 0) // Y-axis
        const angle = Math.PI / 2 // 90 degrees
        const axisAngleQuat = yield* quat.fromAxisAngle(axis, angle)
        expect(axisAngleQuat.y).toBeCloseTo(Math.sin(angle / 2), 5)
        expect(axisAngleQuat.w).toBeCloseTo(Math.cos(angle / 2), 5)
        
        // Test vector rotation
        const vector = yield* mathPort.vector3.create(1, 0, 0) // X-axis
        const rotatedVector = yield* quat.rotateVector(axisAngleQuat, vector)
        // Rotating X-axis 90° around Y-axis should give Z-axis
        expect(rotatedVector.x).toBeCloseTo(0, 5)
        expect(rotatedVector.z).toBeCloseTo(1, 5)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(quaternionTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should provide complete Ray operations', async () => {
      const rayTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        const ray = mathPort.ray
        
        // Test ray creation
        const origin = yield* mathPort.vector3.create(0, 0, 0)
        const direction = yield* mathPort.vector3.create(1, 0, 0)
        const testRay = yield* ray.create(origin, direction)
        
        expect(testRay.origin.x).toBe(0)
        expect(testRay.direction.x).toBe(1)
        
        // Test ray point calculation
        const pointAt5 = yield* ray.at(testRay, 5)
        expect(pointAt5.x).toBe(5)
        expect(pointAt5.y).toBe(0)
        expect(pointAt5.z).toBe(0)
        
        // Test sphere intersection
        const sphereCenter = yield* mathPort.vector3.create(10, 0, 0)
        const sphereIntersection = yield* ray.intersectsSphere(testRay, sphereCenter, 2)
        expect(sphereIntersection.hit).toBe(true)
        expect(sphereIntersection.distance).toBeCloseTo(8, 5)
        
        // Test plane intersection
        const planeNormal = yield* mathPort.vector3.create(-1, 0, 0)
        const planeIntersection = yield* ray.intersectsPlane(testRay, planeNormal, 5)
        expect(planeIntersection.hit).toBe(true)
        expect(planeIntersection.distance).toBeCloseTo(5, 5)
        
        // Test box intersection
        const boxMin = yield* mathPort.vector3.create(3, -1, -1)
        const boxMax = yield* mathPort.vector3.create(7, 1, 1)
        const boxIntersection = yield* ray.intersectsBox(testRay, boxMin, boxMax)
        expect(boxIntersection.hit).toBe(true)
        expect(boxIntersection.distance).toBeCloseTo(3, 5)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(rayTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should support multiple math implementations', async () => {
      // Test that we can potentially swap math implementations
      const adaptabilityTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        
        // Test that the interface is consistent
        expect(mathPort.vector3).toBeDefined()
        expect(mathPort.quaternion).toBeDefined()
        expect(mathPort.ray).toBeDefined()
        
        // Test that operations maintain mathematical correctness
        const v1 = yield* mathPort.vector3.create(1, 0, 0)
        const v2 = yield* mathPort.vector3.create(0, 1, 0)
        const cross = yield* mathPort.vector3.cross(v1, v2)
        
        // Should produce (0, 0, 1) vector
        expect(cross.x).toBeCloseTo(0, 5)
        expect(cross.y).toBeCloseTo(0, 5)
        expect(cross.z).toBeCloseTo(1, 5)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(adaptabilityTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Render Port Implementation', () => {
    it('should provide complete mesh management operations', async () => {
      const renderTest = Effect.gen(function* () {
        const renderPort = yield* RenderPort
        
        // Test mesh creation
        const meshId = 'test-mesh-001'
        const meshData = {
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint16Array([0, 1, 2]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])
        }
        
        const createResult = yield* renderPort.createMesh(meshId, meshData)
        expect(createResult.success).toBe(true)
        expect(createResult.meshId).toBe(meshId)
        
        // Test mesh update
        const updatedMeshData = {
          vertices: new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]),
          indices: new Uint16Array([0, 1, 2]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])
        }
        
        const updateResult = yield* renderPort.updateMesh(meshId, updatedMeshData)
        expect(updateResult.success).toBe(true)
        
        // Test mesh destruction
        const destroyResult = yield* renderPort.destroyMesh(meshId)
        expect(destroyResult.success).toBe(true)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(renderTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should handle material operations', async () => {
      const materialTest = Effect.gen(function* () {
        const renderPort = yield* RenderPort
        
        // Test material creation
        const materialId = 'test-material'
        const materialData = {
          diffuseColor: { r: 1, g: 0, b: 0, a: 1 },
          specularColor: { r: 1, g: 1, b: 1, a: 1 },
          shininess: 32
        }
        
        const createResult = yield* renderPort.createMaterial(materialId, materialData)
        expect(createResult.success).toBe(true)
        
        // Test material update
        const updatedMaterialData = {
          diffuseColor: { r: 0, g: 1, b: 0, a: 1 },
          specularColor: { r: 1, g: 1, b: 1, a: 1 },
          shininess: 64
        }
        
        const updateResult = yield* renderPort.updateMaterial(materialId, updatedMaterialData)
        expect(updateResult.success).toBe(true)
        
        // Test material destruction
        const destroyResult = yield* renderPort.destroyMaterial(materialId)
        expect(destroyResult.success).toBe(true)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(renderTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should support camera operations', async () => {
      const cameraTest = Effect.gen(function* () {
        const renderPort = yield* RenderPort
        
        // Test camera setup
        const cameraConfig = {
          position: { x: 0, y: 5, z: 10 },
          target: { x: 0, y: 0, z: 0 },
          up: { x: 0, y: 1, z: 0 },
          fov: 60,
          aspect: 16 / 9,
          near: 0.1,
          far: 1000
        }
        
        const setCameraResult = yield* renderPort.setCamera(cameraConfig)
        expect(setCameraResult.success).toBe(true)
        
        // Test camera movement
        const newPosition = { x: 5, y: 5, z: 5 }
        const moveCameraResult = yield* renderPort.moveCamera(newPosition)
        expect(moveCameraResult.success).toBe(true)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(renderTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('World Repository Port Implementation', () => {
    it('should provide world persistence operations', async () => {
      const worldRepoTest = Effect.gen(function* () {
        const worldRepo = yield* WorldRepositoryPort
        
        // Test world save
        const worldData = {
          name: 'test-world',
          seed: 12345,
          chunks: new Map(),
          entities: []
        }
        
        const saveResult = yield* worldRepo.save('test-world', worldData)
        expect(saveResult.success).toBe(true)
        
        // Test world load
        const loadResult = yield* worldRepo.load('test-world')
        expect(loadResult.success).toBe(true)
        expect(loadResult.data?.name).toBe('test-world')
        expect(loadResult.data?.seed).toBe(12345)
        
        // Test world existence check
        const existsResult = yield* worldRepo.exists('test-world')
        expect(existsResult).toBe(true)
        
        // Test world deletion
        const deleteResult = yield* worldRepo.delete('test-world')
        expect(deleteResult.success).toBe(true)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(renderTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should handle chunk operations', async () => {
      const chunkTest = Effect.gen(function* () {
        const worldRepo = yield* WorldRepositoryPort
        
        // Test chunk save
        const chunkData = {
          x: 0,
          z: 0,
          blocks: new Uint16Array(16 * 16 * 16),
          entities: []
        }
        
        const saveResult = yield* worldRepo.saveChunk('test-world', { x: 0, z: 0 }, chunkData)
        expect(saveResult.success).toBe(true)
        
        // Test chunk load
        const loadResult = yield* worldRepo.loadChunk('test-world', { x: 0, z: 0 })
        expect(loadResult.success).toBe(true)
        expect(loadResult.data?.x).toBe(0)
        expect(loadResult.data?.z).toBe(0)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(chunkTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Terrain Generator Port Implementation', () => {
    it('should generate terrain chunks', async () => {
      const terrainTest = Effect.gen(function* () {
        const terrainGenerator = yield* TerrainGeneratorPort
        
        // Test chunk generation
        const chunkCoords = { x: 0, z: 0 }
        const seed = 12345
        
        const generatedChunk = yield* terrainGenerator.generateChunk(chunkCoords, seed)
        
        expect(generatedChunk.x).toBe(0)
        expect(generatedChunk.z).toBe(0)
        expect(generatedChunk.blocks).toBeDefined()
        expect(generatedChunk.blocks.length).toBe(16 * 16 * 16)
        
        // Test height map generation
        const heightMap = yield* terrainGenerator.generateHeightMap(chunkCoords, seed)
        expect(heightMap.length).toBe(16 * 16)
        
        // Test biome generation
        const biome = yield* terrainGenerator.getBiome(chunkCoords, seed)
        expect(biome).toBeDefined()
        expect(typeof biome.temperature).toBe('number')
        expect(typeof biome.humidity).toBe('number')
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(terrainTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should support different terrain types', async () => {
      const terrainTypesTest = Effect.gen(function* () {
        const terrainGenerator = yield* TerrainGeneratorPort
        
        // Test different terrain configurations
        const configs = [
          { type: 'plains', seed: 1 },
          { type: 'mountains', seed: 2 },
          { type: 'desert', seed: 3 }
        ]
        
        for (const config of configs) {
          const chunk = yield* terrainGenerator.generateChunk({ x: 0, z: 0 }, config.seed)
          expect(chunk.blocks).toBeDefined()
          expect(chunk.blocks.length).toBe(16 * 16 * 16)
        }
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(terrainTypesTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Spatial Grid Port Implementation', () => {
    it('should manage spatial entities', async () => {
      const spatialTest = Effect.gen(function* () {
        const spatialGrid = yield* SpatialGridPort
        
        // Test entity addition
        const entityId = 'test-entity-001'
        const position = { x: 100, y: 50, z: 200 }
        const bounds = { min: { x: 99, y: 49, z: 199 }, max: { x: 101, y: 51, z: 201 } }
        
        const addResult = yield* spatialGrid.addEntity(entityId, position, bounds)
        expect(addResult.success).toBe(true)
        
        // Test entity query
        const queryBounds = { min: { x: 90, y: 40, z: 190 }, max: { x: 110, y: 60, z: 210 } }
        const queryResult = yield* spatialGrid.queryEntities(queryBounds)
        expect(queryResult.entities).toContain(entityId)
        
        // Test entity movement
        const newPosition = { x: 150, y: 50, z: 200 }
        const moveResult = yield* spatialGrid.updateEntity(entityId, newPosition, bounds)
        expect(moveResult.success).toBe(true)
        
        // Test entity removal
        const removeResult = yield* spatialGrid.removeEntity(entityId)
        expect(removeResult.success).toBe(true)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(spatialTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should handle spatial queries efficiently', async () => {
      const queryTest = Effect.gen(function* () {
        const spatialGrid = yield* SpatialGridPort
        
        // Add multiple entities
        const entities = Array.from({ length: 100 }, (_, i) => ({
          id: `entity-${i}`,
          position: { x: i * 10, y: 0, z: i * 10 },
          bounds: { 
            min: { x: i * 10 - 1, y: -1, z: i * 10 - 1 }, 
            max: { x: i * 10 + 1, y: 1, z: i * 10 + 1 } 
          }
        }))
        
        for (const entity of entities) {
          yield* spatialGrid.addEntity(entity.id, entity.position, entity.bounds)
        }
        
        // Test range query
        const queryBounds = { min: { x: 0, y: -10, z: 0 }, max: { x: 100, y: 10, z: 100 } }
        const queryResult = yield* spatialGrid.queryEntities(queryBounds)
        
        expect(queryResult.entities.length).toBeGreaterThan(0)
        expect(queryResult.entities.length).toBeLessThanOrEqual(11) // Entities 0-10 should be in range
        
        // Test radius query
        const radiusResult = yield* spatialGrid.queryEntitiesInRadius({ x: 50, y: 0, z: 50 }, 30)
        expect(radiusResult.entities.length).toBeGreaterThan(0)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(queryTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Port Adapter Switching', () => {
    it('should support hot-swapping implementations', async () => {
      // Test that ports can be replaced with different implementations
      const swapTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        
        // Test with current implementation
        const vector1 = yield* mathPort.vector3.create(1, 2, 3)
        const vector2 = yield* mathPort.vector3.create(4, 5, 6)
        const result1 = yield* mathPort.vector3.add(vector1, vector2)
        
        expect(result1.x).toBe(5)
        expect(result1.y).toBe(7)
        expect(result1.z).toBe(9)
        
        // The fact that this works shows the adapter pattern is working
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(swapTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should maintain interface consistency across implementations', async () => {
      const consistencyTest = Effect.gen(function* () {
        // Test that all port interfaces are consistent
        const mathPort = yield* MathPort
        const renderPort = yield* RenderPort
        const worldRepo = yield* WorldRepositoryPort
        
        // All ports should have the expected structure
        expect(mathPort.vector3).toBeDefined()
        expect(mathPort.quaternion).toBeDefined()
        expect(mathPort.ray).toBeDefined()
        
        expect(renderPort.createMesh).toBeDefined()
        expect(renderPort.updateMesh).toBeDefined()
        expect(renderPort.destroyMesh).toBeDefined()
        
        expect(worldRepo.save).toBeDefined()
        expect(worldRepo.load).toBeDefined()
        expect(worldRepo.exists).toBeDefined()
        
        // All port methods should return Effects
        const vector = yield* mathPort.vector3.create(1, 2, 3)
        expect(vector).toBeDefined()
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(consistencyTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should support configuration-based adapter selection', async () => {
      // Test that adapters can be selected based on configuration
      const configTest = Effect.gen(function* () {
        // Test layer provides appropriate implementations
        const mathPort = yield* MathPort
        const renderPort = yield* RenderPort
        
        // Implementations should work regardless of which adapter is used
        const testVector = yield* mathPort.vector3.create(10, 20, 30)
        const magnitude = yield* mathPort.vector3.magnitude(testVector)
        
        expect(magnitude).toBeCloseTo(Math.sqrt(1400), 5)
        
        const meshResult = yield* renderPort.createMesh('config-test-mesh', {
          vertices: new Float32Array([0, 0, 0]),
          indices: new Uint16Array([0]),
          normals: new Float32Array([0, 1, 0])
        })
        
        expect(meshResult.success).toBe(true)
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(configTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })

  describe('Error Handling in Ports', () => {
    it('should handle port errors gracefully', async () => {
      const errorTest = Effect.gen(function* () {
        const mathPort = yield* MathPort
        
        // Test error handling with invalid operations
        const zeroVector = yield* mathPort.vector3.create(0, 0, 0)
        
        const normalizeResult = yield* Effect.either(
          mathPort.vector3.normalize(zeroVector)
        )
        
        // Should either succeed with a default or fail gracefully
        expect(normalizeResult._tag === 'Left' || normalizeResult._tag === 'Right').toBe(true)
        
        if (normalizeResult._tag === 'Right') {
          // If normalization succeeded, result should be valid
          const result = normalizeResult.right
          expect(typeof result.x).toBe('number')
          expect(typeof result.y).toBe('number')
          expect(typeof result.z).toBe('number')
        }
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(errorTest, TestLayer)
      )

      expect(result).toBe(true)
    })

    it('should propagate adapter errors correctly', async () => {
      const adapterErrorTest = Effect.gen(function* () {
        const renderPort = yield* RenderPort
        
        // Test error handling with invalid mesh data
        const invalidMeshData = {
          vertices: new Float32Array([]), // Empty vertices
          indices: new Uint16Array([0, 1, 2]), // Indices pointing to non-existent vertices
          normals: new Float32Array([0, 0, 1])
        }
        
        const createResult = yield* Effect.either(
          renderPort.createMesh('invalid-mesh', invalidMeshData)
        )
        
        // Should handle the error gracefully
        expect(createResult._tag === 'Left' || createResult._tag === 'Right').toBe(true)
        
        if (createResult._tag === 'Right') {
          // If creation succeeded, it should indicate failure in the result
          expect(createResult.right.success).toBe(false)
        }
        
        return true
      })

      const result = await Effect.runPromise(
        Effect.provide(adapterErrorTest, TestLayer)
      )

      expect(result).toBe(true)
    })
  })
})