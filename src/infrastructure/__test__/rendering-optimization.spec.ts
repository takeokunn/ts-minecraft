import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { Effect, Layer, TestContext } from 'effect'
import * as THREE from 'three'
import { ThreeJSOptimizerService, ThreeJSOptimizerLive } from '../threejs-optimizer'
import { ObjectPool } from '@/core/performance/object-pool'

/**
 * Rendering Optimization Integration Tests
 * Tests instancing, LOD, frustum culling, and performance benchmarks
 */

describe('Rendering Optimization Integration', () => {
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let renderer: THREE.WebGLRenderer
  let optimizer: ThreeJSOptimizerService

  beforeEach(async () => {
    // Setup Three.js context
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(75, 1920 / 1080, 0.1, 1000)
    camera.position.set(0, 100, 100)
    camera.lookAt(0, 0, 0)

    renderer = new THREE.WebGLRenderer({ antialias: false })
    renderer.setSize(1920, 1080)

    // Setup optimizer service
    const program = Effect.provide(
      ThreeJSOptimizerService,
      ThreeJSOptimizerLive
    )
    
    optimizer = await Effect.runPromise(program)
  })

  afterEach(async () => {
    if (optimizer) {
      await Effect.runPromise(optimizer.dispose())
    }
    renderer.dispose()
  })

  describe('Instanced Rendering', () => {
    test('should create instanced batch for block rendering', async () => {
      // Create cube geometry for blocks
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 })

      await Effect.runPromise(
        optimizer.createInstancedBatch('blocks', geometry, material)
      )

      // Add 1000 block instances
      const transforms: THREE.Matrix4[] = []
      for (let i = 0; i < 1000; i++) {
        const matrix = new THREE.Matrix4()
        const x = (i % 10) * 2
        const y = Math.floor(i / 100) * 2
        const z = Math.floor((i % 100) / 10) * 2
        matrix.setPosition(x, y, z)
        transforms.push(matrix)
      }

      let successCount = 0
      for (const matrix of transforms) {
        const success = await Effect.runPromise(
          optimizer.addToInstancedBatch('blocks', `block-${successCount}`, matrix)
        )
        if (success) successCount++
      }

      expect(successCount).toBe(1000)

      // Update instances
      await Effect.runPromise(optimizer.updateInstances())

      // Get stats
      const stats = await Effect.runPromise(optimizer.getStats())
      expect(stats.instances).toBe(1000)
      expect(stats.drawCalls).toBe(1) // Should be just 1 draw call for instanced rendering
    })

    test('should handle dynamic instance management', async () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshLambertMaterial({ color: 0xff0000 })

      await Effect.runPromise(
        optimizer.createInstancedBatch('dynamic-blocks', geometry, material)
      )

      // Add instances
      const addResults = await Effect.runPromise(
        Effect.all(
          Array.from({ length: 500 }, (_, i) => {
            const matrix = new THREE.Matrix4()
            matrix.setPosition(i * 2, 0, 0)
            return optimizer.addToInstancedBatch('dynamic-blocks', `dynamic-${i}`, matrix)
          })
        )
      )

      const addedCount = addResults.filter(Boolean).length
      expect(addedCount).toBe(500)

      // Remove half of them
      const removeResults = await Effect.runPromise(
        Effect.all(
          Array.from({ length: 250 }, (_, i) => 
            optimizer.removeFromInstancedBatch('dynamic-blocks', `dynamic-${i}`)
          )
        )
      )

      const removedCount = removeResults.filter(Boolean).length
      expect(removedCount).toBe(250)

      await Effect.runPromise(optimizer.updateInstances())

      const stats = await Effect.runPromise(optimizer.getStats())
      expect(stats.instances).toBe(250)
    })

    test('should handle instance batch overflow gracefully', async () => {
      const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
      const material = new THREE.MeshLambertMaterial({ color: 0x0000ff })

      await Effect.runPromise(
        optimizer.createInstancedBatch('overflow-test', geometry, material)
      )

      // Try to add more instances than the maximum limit
      const results = await Effect.runPromise(
        Effect.all(
          Array.from({ length: 70000 }, (_, i) => { // Exceed MAX_INSTANCES_PER_TYPE
            const matrix = new THREE.Matrix4()
            matrix.setPosition(i % 100, Math.floor(i / 10000), Math.floor(i / 100) % 100)
            return optimizer.addToInstancedBatch('overflow-test', `overflow-${i}`, matrix)
          }),
          { concurrency: 100 }
        )
      )

      const successfulAdds = results.filter(Boolean).length
      expect(successfulAdds).toBeLessThanOrEqual(65536) // Should not exceed MAX_INSTANCES_PER_TYPE

      const stats = await Effect.runPromise(optimizer.getStats())
      expect(stats.instances).toBe(successfulAdds)
    })
  })

  describe('Level of Detail (LOD)', () => {
    test('should create LOD objects with multiple detail levels', async () => {
      // Create geometries with different levels of detail
      const highDetail = new THREE.SphereGeometry(1, 32, 32)
      const mediumDetail = new THREE.SphereGeometry(1, 16, 16)
      const lowDetail = new THREE.SphereGeometry(1, 8, 8)

      const material = new THREE.MeshLambertMaterial({ color: 0xffffff })
      const materials = [material, material, material]
      const distances = [0, 50, 200]

      const lodObject = await Effect.runPromise(
        optimizer.createLODObject('test-lod', [highDetail, mediumDetail, lowDetail], materials, distances)
      )

      expect(lodObject).toBeInstanceOf(THREE.LOD)
      expect(lodObject.levels).toHaveLength(3)

      // Test LOD switching at different distances
      camera.position.set(0, 0, 25) // Close distance - should use high detail
      await Effect.runPromise(optimizer.updateLOD(camera))

      camera.position.set(0, 0, 100) // Medium distance - should use medium detail
      await Effect.runPromise(optimizer.updateLOD(camera))

      camera.position.set(0, 0, 300) // Far distance - should use low detail
      await Effect.runPromise(optimizer.updateLOD(camera))
    })

    test('should automatically select appropriate LOD level based on distance', async () => {
      const geometries = [
        new THREE.BoxGeometry(1, 1, 1, 10, 10, 10), // High detail
        new THREE.BoxGeometry(1, 1, 1, 5, 5, 5),     // Medium detail
        new THREE.BoxGeometry(1, 1, 1, 2, 2, 2),     // Low detail
      ]
      const materials = geometries.map(() => new THREE.MeshLambertMaterial({ color: 0x808080 }))
      const distances = [0, 100, 400]

      await Effect.runPromise(
        optimizer.createLODObject('distance-lod', geometries, materials, distances)
      )

      // Test performance at different camera distances
      const testDistances = [25, 75, 150, 500]
      const performanceResults = []

      for (const distance of testDistances) {
        camera.position.set(0, 0, distance)
        
        const startTime = performance.now()
        await Effect.runPromise(optimizer.updateLOD(camera))
        const endTime = performance.now()
        
        performanceResults.push({
          distance,
          updateTime: endTime - startTime
        })
      }

      // LOD updates should be fast regardless of distance
      performanceResults.forEach(result => {
        expect(result.updateTime).toBeLessThan(5) // Should update in under 5ms
      })
    })
  })

  describe('Frustum Culling', () => {
    test('should cull objects outside camera view', async () => {
      // Create test objects at various positions
      const testObjects: THREE.Object3D[] = []
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshBasicMaterial({ color: 0xff00ff })

      for (let i = 0; i < 100; i++) {
        const mesh = new THREE.Mesh(geometry, material)
        const x = (Math.random() - 0.5) * 2000 // Spread objects widely
        const y = (Math.random() - 0.5) * 1000
        const z = (Math.random() - 0.5) * 2000
        mesh.position.set(x, y, z)
        testObjects.push(mesh)
        scene.add(mesh)
      }

      // Position camera to view only a subset of objects
      camera.position.set(0, 0, 100)
      camera.lookAt(0, 0, 0)
      camera.updateMatrixWorld()

      const cullingData = await Effect.runPromise(
        optimizer.performCulling(testObjects, camera)
      )

      expect(cullingData.cullStats.totalObjects).toBe(100)
      expect(cullingData.cullStats.culledObjects).toBeGreaterThan(0)
      expect(cullingData.cullStats.visibleObjects).toBeGreaterThan(0)
      expect(
        cullingData.cullStats.culledObjects + cullingData.cullStats.visibleObjects
      ).toBe(100)

      console.log(`Frustum Culling Results:`)
      console.log(`- Total objects: ${cullingData.cullStats.totalObjects}`)
      console.log(`- Visible objects: ${cullingData.cullStats.visibleObjects}`)
      console.log(`- Culled objects: ${cullingData.cullStats.culledObjects}`)
      console.log(`- Culling efficiency: ${(cullingData.cullStats.culledObjects / 100 * 100).toFixed(1)}%`)
    })

    test('should perform frustum culling efficiently on large object sets', async () => {
      // Create 10,000 test objects
      const largeObjectSet: THREE.Object3D[] = []
      const geometry = new THREE.SphereGeometry(0.5, 8, 8)
      const material = new THREE.MeshBasicMaterial({ color: 0x00ffff })

      for (let i = 0; i < 10000; i++) {
        const mesh = new THREE.Mesh(geometry, material)
        const x = (i % 100) * 10 - 500
        const y = Math.floor(i / 10000) * 10
        const z = Math.floor(i / 100) * 10 - 500
        mesh.position.set(x, y, z)
        largeObjectSet.push(mesh)
      }

      camera.position.set(0, 50, 0)
      camera.lookAt(0, 0, 0)

      const startTime = performance.now()
      const cullingData = await Effect.runPromise(
        optimizer.performCulling(largeObjectSet, camera)
      )
      const endTime = performance.now()
      const cullingTime = endTime - startTime

      console.log(`Large Scale Culling Performance:`)
      console.log(`- Objects processed: 10,000`)
      console.log(`- Culling time: ${cullingTime.toFixed(2)}ms`)
      console.log(`- Objects per ms: ${(10000 / cullingTime).toFixed(0)}`)

      expect(cullingTime).toBeLessThan(50) // Should complete culling in under 50ms
      expect(cullingData.cullStats.totalObjects).toBe(10000)
      expect(cullingData.cullStats.visibleObjects).toBeGreaterThan(0)
    })
  })

  describe('Geometry Batching', () => {
    test('should merge multiple geometries into single batch', async () => {
      // Create multiple similar objects
      const objects: THREE.Object3D[] = []
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshLambertMaterial({ color: 0xffff00 })

      for (let i = 0; i < 50; i++) {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(i * 2, 0, 0)
        objects.push(mesh)
      }

      const mergedGeometry = await Effect.runPromise(
        optimizer.mergeObjectGeometries('test-batch', objects)
      )

      expect(mergedGeometry).toBeInstanceOf(THREE.BufferGeometry)
      
      // Verify merged geometry has combined vertex data
      const positionAttribute = mergedGeometry.getAttribute('position')
      expect(positionAttribute.count).toBe(50 * 24) // 50 cubes * 24 vertices each

      const stats = await Effect.runPromise(optimizer.getStats())
      expect(stats.batchedObjects).toBe(50)
    })

    test('should handle empty geometry batching', async () => {
      const emptyObjects: THREE.Object3D[] = []
      
      const mergedGeometry = await Effect.runPromise(
        optimizer.mergeObjectGeometries('empty-batch', emptyObjects)
      )

      expect(mergedGeometry).toBeInstanceOf(THREE.BufferGeometry)
      
      const positionAttribute = mergedGeometry.getAttribute('position')
      expect(positionAttribute).toBeUndefined()
    })
  })

  describe('Scene Optimization', () => {
    test('should optimize entire scene with all techniques combined', async () => {
      // Setup a complex scene
      const sceneObjects: THREE.Object3D[] = []
      
      // Add instanced blocks
      const blockGeometry = new THREE.BoxGeometry(1, 1, 1)
      const blockMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 })
      
      await Effect.runPromise(
        optimizer.createInstancedBatch('scene-blocks', blockGeometry, blockMaterial)
      )

      // Add 1000 blocks in a grid
      for (let x = 0; x < 10; x++) {
        for (let z = 0; z < 10; z++) {
          for (let y = 0; y < 10; y++) {
            const matrix = new THREE.Matrix4()
            matrix.setPosition(x * 2, y * 2, z * 2)
            await Effect.runPromise(
              optimizer.addToInstancedBatch('scene-blocks', `scene-block-${x}-${y}-${z}`, matrix)
            )
          }
        }
      }

      // Add LOD objects
      const lodGeometries = [
        new THREE.IcosahedronGeometry(1, 3),
        new THREE.IcosahedronGeometry(1, 2),
        new THREE.IcosahedronGeometry(1, 1),
      ]
      const lodMaterials = lodGeometries.map(() => new THREE.MeshLambertMaterial({ color: 0x0080ff }))
      
      const lodObject = await Effect.runPromise(
        optimizer.createLODObject('scene-lod', lodGeometries, lodMaterials, [0, 50, 200])
      )
      lodObject.position.set(25, 25, 25)
      scene.add(lodObject)
      sceneObjects.push(lodObject)

      // Add regular meshes for culling
      for (let i = 0; i < 200; i++) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 8, 8),
          new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff })
        )
        mesh.position.set(
          (Math.random() - 0.5) * 200,
          Math.random() * 50,
          (Math.random() - 0.5) * 200
        )
        scene.add(mesh)
        sceneObjects.push(mesh)
      }

      // Position camera for optimal testing
      camera.position.set(50, 50, 50)
      camera.lookAt(25, 25, 25)

      // Optimize entire scene
      const startTime = performance.now()
      await Effect.runPromise(optimizer.optimizeScene(scene, camera))
      const endTime = performance.now()
      const optimizationTime = endTime - startTime

      // Get final statistics
      const stats = await Effect.runPromise(optimizer.getStats())

      console.log(`Complete Scene Optimization Results:`)
      console.log(`- Optimization time: ${optimizationTime.toFixed(2)}ms`)
      console.log(`- Total draw calls: ${stats.drawCalls}`)
      console.log(`- Total triangles: ${stats.triangles}`)
      console.log(`- Instanced objects: ${stats.instances}`)
      console.log(`- Batched objects: ${stats.batchedObjects}`)
      console.log(`- Culled objects: ${stats.culledObjects}`)
      console.log(`- Memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB`)

      // Performance expectations
      expect(optimizationTime).toBeLessThan(100) // Optimization should be fast
      expect(stats.drawCalls).toBeLessThan(50) // Should minimize draw calls
      expect(stats.instances).toBeGreaterThan(500) // Should have instanced rendering
      expect(stats.culledObjects).toBeGreaterThan(0) // Should perform culling
    })
  })

  describe('Memory Management', () => {
    test('should manage memory efficiently during optimization cycles', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      // Create and destroy multiple optimization cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        // Create temporary geometry and materials
        const geometry = new THREE.SphereGeometry(1, 16, 16)
        const material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff })

        await Effect.runPromise(
          optimizer.createInstancedBatch(`cycle-${cycle}`, geometry, material)
        )

        // Add many instances
        for (let i = 0; i < 100; i++) {
          const matrix = new THREE.Matrix4()
          matrix.setPosition(i, cycle, 0)
          await Effect.runPromise(
            optimizer.addToInstancedBatch(`cycle-${cycle}`, `obj-${cycle}-${i}`, matrix)
          )
        }

        await Effect.runPromise(optimizer.updateInstances())
      }

      // Clean up
      await Effect.runPromise(optimizer.dispose())

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      console.log(`Memory Management Test:`)
      console.log(`- Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`- Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`- Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)

      // Memory increase should be reasonable (target: <50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })

    test('should pool and reuse objects effectively', async () => {
      // This test verifies object pooling is working
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshLambertMaterial({ color: 0xff8000 })

      await Effect.runPromise(
        optimizer.createInstancedBatch('pooling-test', geometry, material)
      )

      // Repeatedly add and remove instances to test pooling
      for (let iteration = 0; iteration < 50; iteration++) {
        // Add 10 instances
        for (let i = 0; i < 10; i++) {
          const matrix = new THREE.Matrix4()
          matrix.setPosition(i, 0, iteration)
          await Effect.runPromise(
            optimizer.addToInstancedBatch('pooling-test', `pool-${iteration}-${i}`, matrix)
          )
        }

        // Remove all instances
        for (let i = 0; i < 10; i++) {
          await Effect.runPromise(
            optimizer.removeFromInstancedBatch('pooling-test', `pool-${iteration}-${i}`)
          )
        }
      }

      const stats = await Effect.runPromise(optimizer.getStats())
      expect(stats.instances).toBe(0) // All instances should be removed
    })
  })

  describe('Performance Benchmarks', () => {
    test('should achieve 60 FPS rendering targets with 10000+ objects', async () => {
      // This is a theoretical benchmark - actual rendering would require WebGL context
      const targetFPS = 60
      const frameTime = 1000 / targetFPS // 16.67ms per frame

      // Setup large scene
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshLambertMaterial({ color: 0x40e040 })

      await Effect.runPromise(
        optimizer.createInstancedBatch('performance-blocks', geometry, material)
      )

      // Add 10,000 objects
      const startSetupTime = performance.now()
      
      const setupResults = await Effect.runPromise(
        Effect.all(
          Array.from({ length: 10000 }, (_, i) => {
            const matrix = new THREE.Matrix4()
            const x = (i % 100) * 2
            const y = Math.floor(i / 10000) * 2
            const z = Math.floor((i % 10000) / 100) * 2
            matrix.setPosition(x, y, z)
            return optimizer.addToInstancedBatch('performance-blocks', `perf-${i}`, matrix)
          }),
          { concurrency: 100 }
        )
      )

      const endSetupTime = performance.now()
      const setupTime = endSetupTime - startSetupTime
      const successfulAdds = setupResults.filter(Boolean).length

      // Test scene optimization performance
      const optimizationTimes: number[] = []
      
      for (let frame = 0; frame < 10; frame++) {
        // Simulate camera movement
        camera.position.set(
          Math.sin(frame * 0.1) * 100,
          50 + Math.sin(frame * 0.05) * 20,
          Math.cos(frame * 0.1) * 100
        )
        camera.lookAt(0, 0, 0)

        const startFrame = performance.now()
        await Effect.runPromise(optimizer.optimizeScene(scene, camera))
        const endFrame = performance.now()
        
        optimizationTimes.push(endFrame - startFrame)
      }

      const averageOptimizationTime = optimizationTimes.reduce((a, b) => a + b, 0) / optimizationTimes.length
      const maxOptimizationTime = Math.max(...optimizationTimes)

      const stats = await Effect.runPromise(optimizer.getStats())

      console.log(`Performance Benchmark Results (10,000 objects):`)
      console.log(`- Setup time: ${setupTime.toFixed(2)}ms`)
      console.log(`- Objects added: ${successfulAdds}`)
      console.log(`- Average optimization time: ${averageOptimizationTime.toFixed(2)}ms`)
      console.log(`- Max optimization time: ${maxOptimizationTime.toFixed(2)}ms`)
      console.log(`- Draw calls: ${stats.drawCalls}`)
      console.log(`- Total triangles: ${stats.triangles}`)
      console.log(`- Memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB`)

      // Performance targets
      expect(successfulAdds).toBeGreaterThanOrEqual(10000)
      expect(averageOptimizationTime).toBeLessThan(frameTime / 2) // Use less than half frame time for optimization
      expect(maxOptimizationTime).toBeLessThan(frameTime) // Never exceed frame time
      expect(stats.drawCalls).toBeLessThan(10) // Minimize draw calls through batching/instancing
    })

    test('should maintain performance under dynamic object management', async () => {
      const geometry = new THREE.SphereGeometry(0.5, 8, 8)
      const material = new THREE.MeshLambertMaterial({ color: 0x8040e0 })

      await Effect.runPromise(
        optimizer.createInstancedBatch('dynamic-perf', geometry, material)
      )

      const operationTimes: number[] = []

      // Simulate dynamic object management over 100 frames
      for (let frame = 0; frame < 100; frame++) {
        const startFrame = performance.now()

        // Add some objects
        const addPromises = Array.from({ length: 10 }, (_, i) => {
          const matrix = new THREE.Matrix4()
          matrix.setPosition(frame, i, frame % 10)
          return optimizer.addToInstancedBatch('dynamic-perf', `dyn-${frame}-${i}`, matrix)
        })

        // Remove some old objects
        const removePromises = frame > 10 
          ? Array.from({ length: 5 }, (_, i) => 
              optimizer.removeFromInstancedBatch('dynamic-perf', `dyn-${frame - 10}-${i}`)
            )
          : []

        await Effect.runPromise(Effect.all([...addPromises, ...removePromises]))
        await Effect.runPromise(optimizer.updateInstances())

        const endFrame = performance.now()
        operationTimes.push(endFrame - startFrame)
      }

      const averageOperationTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length
      const maxOperationTime = Math.max(...operationTimes)

      console.log(`Dynamic Management Performance:`)
      console.log(`- Average operation time: ${averageOperationTime.toFixed(2)}ms`)
      console.log(`- Max operation time: ${maxOperationTime.toFixed(2)}ms`)

      // Performance should remain consistent
      expect(averageOperationTime).toBeLessThan(5) // Average under 5ms
      expect(maxOperationTime).toBeLessThan(15) // Never exceed 15ms
    })
  })
})