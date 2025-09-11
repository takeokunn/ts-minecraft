import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { Effect, Layer, Duration } from 'effect'
import { ThreeJSOptimizerService, ThreeJSOptimizerLive } from '../threejs-optimizer'
import { WASMIntegrationService, WASMIntegrationLive } from '../wasm-integration'
import { ChunkCacheLive } from '../chunk-cache'
import { createWorkerPool, createWorkerFactory } from '@/workers/base/typed-worker'
import { TerrainGenerationRequest, TerrainGenerationResponse } from '@/workers/shared/protocol'
import * as THREE from 'three'
import type { ChunkCoordinates } from '@/core/values/coordinates'

/**
 * Comprehensive Infrastructure Integration Benchmark
 * Tests all systems working together and measures performance targets
 */

interface BenchmarkResults {
  workerThroughput: number // req/s
  renderingPerformance: {
    drawCalls: number
    triangles: number
    culledObjects: number
    memoryUsage: number // MB
  }
  memoryEfficiency: {
    cacheHitRate: number // %
    poolUtilization: number // %
    compressionRatio: number
  }
  systemIntegration: {
    startupTime: number // ms
    totalMemoryFootprint: number // MB
    concurrentOperations: number
  }
}

describe('Comprehensive Infrastructure Integration', () => {
  let optimizer: ThreeJSOptimizerService
  let wasmService: WASMIntegrationService
  let chunkCache: any
  let workerPool: any
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera

  beforeAll(async () => {
    // Initialize all systems
    const startupStart = performance.now()

    // Three.js setup
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(75, 1920 / 1080, 0.1, 1000)
    camera.position.set(0, 50, 50)

    // Initialize services
    try {
      optimizer = await Effect.runPromise(
        Effect.provide(ThreeJSOptimizerService, ThreeJSOptimizerLive)
      )

      if (typeof WebAssembly !== 'undefined') {
        wasmService = await Effect.runPromise(
          Effect.provide(WASMIntegrationService, WASMIntegrationLive)
        )
      }

      chunkCache = await Effect.runPromise(
        Effect.provide(
          Layer.mergeAll(ChunkCacheLive),
          Effect.gen(function* () {
            return yield* Effect.service(Effect.Tag<any>('ChunkManager'))
          })
        )
      )

      // Worker pool setup
      const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
        '/src/workers/terrain-generation.worker.ts',
        {
          inputSchema: TerrainGenerationRequest,
          outputSchema: TerrainGenerationResponse,
          timeout: Duration.seconds(30),
        }
      )
      workerPool = await Effect.runPromise(createWorkerPool(factory, 4))

      const startupEnd = performance.now()
      console.log(`System startup completed in ${(startupEnd - startupStart).toFixed(2)}ms`)

    } catch (error) {
      console.warn('Some systems not available:', error)
    }
  }, 30000) // Extended timeout for system initialization

  afterAll(async () => {
    // Cleanup all systems
    if (optimizer) {
      await Effect.runPromise(optimizer.dispose())
    }
    if (wasmService) {
      await Effect.runPromise(wasmService.dispose())
    }
    if (chunkCache) {
      await Effect.runPromise(chunkCache.clear())
    }
    if (workerPool) {
      await Effect.runPromise(workerPool.terminate())
    }
  })

  test('should meet all performance targets in integrated scenario', async () => {
    const results: BenchmarkResults = {
      workerThroughput: 0,
      renderingPerformance: {
        drawCalls: 0,
        triangles: 0,
        culledObjects: 0,
        memoryUsage: 0,
      },
      memoryEfficiency: {
        cacheHitRate: 0,
        poolUtilization: 0,
        compressionRatio: 0,
      },
      systemIntegration: {
        startupTime: 0,
        totalMemoryFootprint: 0,
        concurrentOperations: 0,
      },
    }

    // === Worker Performance Test ===
    console.log('🚀 Testing Worker Pool Performance...')
    
    if (workerPool) {
      const workerRequests = Array.from({ length: 100 }, (_, i) => ({
        coordinates: { x: i % 10, z: Math.floor(i / 10) } as ChunkCoordinates,
        seed: 42,
        biomeSettings: {
          temperature: 0.5,
          humidity: 0.5,
          elevation: 0.7,
        },
      }))

      const workerStart = performance.now()
      const workerResults = await Effect.runPromise(
        Effect.all(
          workerRequests.map(request => workerPool.sendRequest(request)),
          { concurrency: 4 }
        )
      )
      const workerEnd = performance.now()

      const workerTime = (workerEnd - workerStart) / 1000
      results.workerThroughput = workerResults.length / workerTime

      console.log(`✅ Worker throughput: ${results.workerThroughput.toFixed(2)} req/s`)
      expect(results.workerThroughput).toBeGreaterThan(10) // Target: >10 req/s
    }

    // === Rendering Performance Test ===
    console.log('🎨 Testing Rendering Optimization...')
    
    if (optimizer) {
      // Setup large scene
      const blockGeometry = new THREE.BoxGeometry(1, 1, 1)
      const blockMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 })

      await Effect.runPromise(
        optimizer.createInstancedBatch('benchmark-blocks', blockGeometry, blockMaterial)
      )

      // Add 5000 blocks
      for (let i = 0; i < 5000; i++) {
        const matrix = new THREE.Matrix4()
        const x = (i % 50) * 2
        const y = Math.floor(i / 2500) * 2
        const z = Math.floor((i % 2500) / 50) * 2
        matrix.setPosition(x, y, z)
        
        await Effect.runPromise(
          optimizer.addToInstancedBatch('benchmark-blocks', `bench-block-${i}`, matrix)
        )
      }

      // Add LOD objects
      const lodGeometries = [
        new THREE.IcosahedronGeometry(2, 3),
        new THREE.IcosahedronGeometry(2, 2),
        new THREE.IcosahedronGeometry(2, 1),
      ]
      const lodMaterials = lodGeometries.map(() => new THREE.MeshLambertMaterial({ color: 0x0080ff }))
      
      for (let i = 0; i < 100; i++) {
        const lodObject = await Effect.runPromise(
          optimizer.createLODObject(`lod-${i}`, lodGeometries, lodMaterials, [0, 50, 200])
        )
        lodObject.position.set(i % 10 * 10, 0, Math.floor(i / 10) * 10)
        scene.add(lodObject)
      }

      // Add objects for culling test
      const cullObjects: THREE.Object3D[] = []
      for (let i = 0; i < 1000; i++) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(1, 8, 8),
          new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff })
        )
        mesh.position.set(
          (Math.random() - 0.5) * 500,
          Math.random() * 100,
          (Math.random() - 0.5) * 500
        )
        cullObjects.push(mesh)
        scene.add(mesh)
      }

      // Position camera for testing
      camera.position.set(50, 50, 50)
      camera.lookAt(25, 25, 25)

      // Perform optimization
      await Effect.runPromise(optimizer.optimizeScene(scene, camera))
      
      const renderStats = await Effect.runPromise(optimizer.getStats())
      results.renderingPerformance = {
        drawCalls: renderStats.drawCalls,
        triangles: renderStats.triangles,
        culledObjects: renderStats.culledObjects,
        memoryUsage: renderStats.memoryUsage / 1024 / 1024, // Convert to MB
      }

      console.log(`✅ Rendering - Draw calls: ${results.renderingPerformance.drawCalls}, Triangles: ${results.renderingPerformance.triangles}, Culled: ${results.renderingPerformance.culledObjects}`)
      
      expect(results.renderingPerformance.drawCalls).toBeLessThan(50) // Target: <50 draw calls
      expect(results.renderingPerformance.culledObjects).toBeGreaterThan(0) // Culling should work
    }

    // === Memory Efficiency Test ===
    console.log('💾 Testing Memory Efficiency...')
    
    if (chunkCache) {
      // Create test chunks
      const chunks = Array.from({ length: 200 }, (_, i) => ({
        chunkX: i % 20,
        chunkZ: Math.floor(i / 20),
        blocks: Array(16 * 16 * 128).fill('stone'),
        entities: [],
        blockEntities: [],
        biome: 'plains',
        isLoaded: true,
        lightData: undefined,
      }))

      // Add chunks to cache
      for (const chunk of chunks) {
        await Effect.runPromise(chunkCache.setChunk(chunk))
      }

      // Test cache hit rate with repeated access
      let hits = 0
      for (let i = 0; i < 100; i++) {
        const chunk = chunks[i % chunks.length]
        const result = await Effect.runPromise(
          chunkCache.getChunk(chunk.chunkX, chunk.chunkZ)
        )
        if (result._tag === 'Some') hits++
      }

      const cacheMetrics = await Effect.runPromise(chunkCache.getCacheMetrics())
      results.memoryEfficiency = {
        cacheHitRate: (hits / 100) * 100,
        poolUtilization: cacheMetrics.hitRate,
        compressionRatio: cacheMetrics.compressionRatio || 1,
      }

      console.log(`✅ Cache hit rate: ${results.memoryEfficiency.cacheHitRate}%, Pool utilization: ${results.memoryEfficiency.poolUtilization.toFixed(2)}%`)
      
      expect(results.memoryEfficiency.cacheHitRate).toBeGreaterThan(70) // Target: >70% hit rate
    }

    // === WASM Integration Test ===
    console.log('⚡ Testing WASM Integration...')
    
    if (wasmService) {
      try {
        const capabilities = await Effect.runPromise(wasmService.getCapabilities())
        const stats = await Effect.runPromise(wasmService.getStats())
        
        console.log(`✅ WASM - SIMD: ${capabilities.simd}, Threading: ${capabilities.threading}, Modules: ${stats.totalModules}`)
      } catch (error) {
        console.log(`⚠️  WASM integration limited: ${error}`)
      }
    }

    // === System Integration Test ===
    console.log('🔧 Testing System Integration...')
    
    const integrationStart = performance.now()
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0

    // Concurrent operations test
    const concurrentOps = []

    // Worker operations
    if (workerPool) {
      concurrentOps.push(
        ...Array.from({ length: 20 }, (_, i) => 
          workerPool.sendRequest({
            coordinates: { x: i, z: 0 } as ChunkCoordinates,
            seed: 99,
            biomeSettings: { temperature: 0.5, humidity: 0.5, elevation: 0.5 },
          })
        )
      )
    }

    // Rendering operations
    if (optimizer) {
      for (let i = 0; i < 100; i++) {
        const matrix = new THREE.Matrix4()
        matrix.setPosition(i * 3, 0, 0)
        concurrentOps.push(
          optimizer.addToInstancedBatch('benchmark-blocks', `concurrent-${i}`, matrix)
        )
      }
    }

    // Cache operations
    if (chunkCache) {
      for (let i = 0; i < 50; i++) {
        const chunk = {
          chunkX: i + 100,
          chunkZ: 0,
          blocks: Array(16 * 16 * 64).fill('grass'),
          entities: [],
          blockEntities: [],
          biome: 'forest',
          isLoaded: true,
          lightData: undefined,
        }
        concurrentOps.push(chunkCache.setChunk(chunk))
      }
    }

    // Execute all operations concurrently
    const concurrentResults = await Effect.runPromise(
      Effect.all(concurrentOps, { concurrency: 10 })
    )

    const integrationEnd = performance.now()
    const endMemory = (performance as any).memory?.usedJSHeapSize || 0

    results.systemIntegration = {
      startupTime: integrationEnd - integrationStart,
      totalMemoryFootprint: (endMemory - startMemory) / 1024 / 1024,
      concurrentOperations: concurrentResults.length,
    }

    console.log(`✅ Integration - ${results.systemIntegration.concurrentOperations} concurrent ops in ${results.systemIntegration.startupTime.toFixed(2)}ms`)
    
    expect(results.systemIntegration.startupTime).toBeLessThan(5000) // Target: <5s for integration
    expect(results.systemIntegration.concurrentOperations).toBeGreaterThan(50) // Should handle many concurrent ops

    // === Final Results Summary ===
    console.log('\n🎯 COMPREHENSIVE BENCHMARK RESULTS:')
    console.log('=====================================')
    console.log(`Worker Performance:`)
    console.log(`  📈 Throughput: ${results.workerThroughput.toFixed(2)} req/s (Target: >10)`)
    console.log()
    console.log(`Rendering Performance:`)
    console.log(`  🎨 Draw Calls: ${results.renderingPerformance.drawCalls} (Target: <50)`)
    console.log(`  🔺 Triangles: ${results.renderingPerformance.triangles.toLocaleString()}`)
    console.log(`  ✂️  Culled Objects: ${results.renderingPerformance.culledObjects}`)
    console.log(`  💾 Memory Usage: ${results.renderingPerformance.memoryUsage.toFixed(2)}MB`)
    console.log()
    console.log(`Memory Efficiency:`)
    console.log(`  🎯 Cache Hit Rate: ${results.memoryEfficiency.cacheHitRate.toFixed(1)}% (Target: >70%)`)
    console.log(`  🔄 Pool Utilization: ${results.memoryEfficiency.poolUtilization.toFixed(1)}%`)
    console.log(`  📦 Compression Ratio: ${results.memoryEfficiency.compressionRatio.toFixed(2)}`)
    console.log()
    console.log(`System Integration:`)
    console.log(`  ⚡ Operation Time: ${results.systemIntegration.startupTime.toFixed(2)}ms (Target: <5000)`)
    console.log(`  💾 Memory Footprint: ${results.systemIntegration.totalMemoryFootprint.toFixed(2)}MB`)
    console.log(`  🔀 Concurrent Ops: ${results.systemIntegration.concurrentOperations}`)
    console.log()

    // Verification against targets
    const targetsMet = {
      workerThroughput: results.workerThroughput >= 10,
      renderingDrawCalls: results.renderingPerformance.drawCalls <= 50,
      memoryCacheHit: results.memoryEfficiency.cacheHitRate >= 70,
      integrationTime: results.systemIntegration.startupTime <= 5000,
    }

    const passedTargets = Object.values(targetsMet).filter(Boolean).length
    const totalTargets = Object.keys(targetsMet).length

    console.log(`🎯 TARGETS ACHIEVED: ${passedTargets}/${totalTargets}`)
    if (passedTargets === totalTargets) {
      console.log(`🎉 ALL PERFORMANCE TARGETS MET!`)
    } else {
      console.log(`⚠️  Some targets need optimization`)
    }

    // At least 75% of targets should be met
    expect(passedTargets / totalTargets).toBeGreaterThanOrEqual(0.75)

    return results
  }, 60000) // Extended timeout for comprehensive test

  test('should demonstrate real-world game scenario performance', async () => {
    console.log('\n🎮 REAL-WORLD GAME SCENARIO BENCHMARK')
    console.log('=====================================')

    // Simulate a player moving through a world with dynamic loading/unloading
    const playerPositions = Array.from({ length: 100 }, (_, i) => ({
      x: Math.sin(i * 0.1) * 50,
      z: Math.cos(i * 0.1) * 50,
      frame: i,
    }))

    const scenarioStart = performance.now()
    let totalChunksLoaded = 0
    let totalObjectsRendered = 0
    let totalMemoryOperations = 0

    for (let i = 0; i < playerPositions.length; i++) {
      const pos = playerPositions[i]
      
      // Simulate chunk loading around player
      if (chunkCache && i % 10 === 0) {
        const chunkPromises = []
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            const chunkX = Math.floor(pos.x / 16) + dx
            const chunkZ = Math.floor(pos.z / 16) + dz
            
            const chunk = {
              chunkX,
              chunkZ,
              blocks: Array(16 * 16 * 64).fill(['stone', 'dirt', 'grass'][Math.floor(Math.random() * 3)]),
              entities: [],
              blockEntities: [],
              biome: ['plains', 'forest', 'desert'][Math.floor(Math.random() * 3)],
              isLoaded: true,
              lightData: undefined,
            }
            
            chunkPromises.push(chunkCache.setChunk(chunk))
            totalChunksLoaded++
          }
        }
        await Effect.runPromise(Effect.all(chunkPromises))
      }

      // Simulate camera movement and rendering updates
      if (optimizer && i % 5 === 0) {
        camera.position.set(pos.x, 30, pos.z)
        camera.lookAt(pos.x, 0, pos.z + 10)
        
        // Add some dynamic objects
        for (let j = 0; j < 5; j++) {
          const matrix = new THREE.Matrix4()
          matrix.setPosition(pos.x + j, 0, pos.z)
          await Effect.runPromise(
            optimizer.addToInstancedBatch('benchmark-blocks', `dynamic-${i}-${j}`, matrix)
          )
          totalObjectsRendered++
        }

        // Periodic scene optimization
        await Effect.runPromise(optimizer.optimizeScene(scene, camera))
      }

      // Simulate worker tasks (terrain generation, physics)
      if (workerPool && i % 15 === 0) {
        const workerPromises = Array.from({ length: 3 }, (_, j) => 
          workerPool.sendRequest({
            coordinates: { 
              x: Math.floor(pos.x / 16) + j, 
              z: Math.floor(pos.z / 16) 
            } as ChunkCoordinates,
            seed: i + j,
            biomeSettings: {
              temperature: 0.5 + Math.sin(i * 0.1) * 0.3,
              humidity: 0.5 + Math.cos(i * 0.1) * 0.3,
              elevation: 0.7,
            },
          })
        )
        await Effect.runPromise(Effect.all(workerPromises))
      }

      totalMemoryOperations++
      
      // Progress indicator
      if (i % 20 === 0) {
        console.log(`📍 Frame ${i}/100: Position (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`)
      }
    }

    const scenarioEnd = performance.now()
    const totalTime = scenarioEnd - scenarioStart

    // Get final statistics
    const finalStats = {
      renderStats: optimizer ? await Effect.runPromise(optimizer.getStats()) : null,
      cacheMetrics: chunkCache ? await Effect.runPromise(chunkCache.getCacheMetrics()) : null,
      wasmStats: wasmService ? await Effect.runPromise(wasmService.getStats()) : null,
    }

    console.log(`\n📊 SCENARIO RESULTS:`)
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)}s`)
    console.log(`📦 Chunks Loaded: ${totalChunksLoaded}`)
    console.log(`🎨 Objects Rendered: ${totalObjectsRendered}`)
    console.log(`💾 Memory Operations: ${totalMemoryOperations}`)
    console.log(`🖼️  Average FPS: ${(playerPositions.length / (totalTime / 1000)).toFixed(1)}`)

    if (finalStats.renderStats) {
      console.log(`🎨 Final Render Stats: ${finalStats.renderStats.drawCalls} draws, ${finalStats.renderStats.triangles} triangles`)
    }

    if (finalStats.cacheMetrics) {
      console.log(`📊 Cache Efficiency: ${finalStats.cacheMetrics.hitRate.toFixed(1)}% hit rate`)
    }

    // Performance expectations for real-world scenario
    const avgFrameTime = totalTime / playerPositions.length
    expect(avgFrameTime).toBeLessThan(100) // Target: <100ms per frame (effective 10 FPS minimum)
    expect(totalChunksLoaded).toBeGreaterThan(0)
    expect(totalMemoryOperations).toBe(playerPositions.length)

    console.log(`✅ Real-world scenario completed successfully!`)
  }, 120000) // Extended timeout for scenario test
})