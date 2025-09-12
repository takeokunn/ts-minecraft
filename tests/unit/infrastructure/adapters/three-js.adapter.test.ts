/**
 * Three.js Adapter Unit Tests
 * 
 * Comprehensive test suite for the Three.js rendering adapter,
 * testing all adapter methods, error conditions, and Effect-TS patterns.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Queue from 'effect/Queue'
import * as Ref from 'effect/Ref'
import * as Context from 'effect/Context'
import { 
  expectEffect, 
  runEffect, 
  runEffectExit, 
  createMockCanvas, 
  createMockWebGLContext 
} from '../../../setup/infrastructure.setup'
import {
  ThreeJsAdapter,
  ThreeJsAdapterLive,
  ThreeJsContext,
  ThreeJsContextLive,
  IThreeJsAdapter,
  IThreeJsContext,
  RenderCommand
} from '@infrastructure/adapters/three-js.adapter'
import {
  ChunkMeshData,
  Camera,
  ViewportConfig,
  FogConfig,
  LightingConfig,
  MeshHandle,
  RenderStats,
  RenderError,
  MeshError,
  CameraError,
  ResourceError
} from '@domain/ports/render.port'

// Mock THREE.js completely
vi.mock('three', () => {
  const mockGeometry = {
    setAttribute: vi.fn(),
    setIndex: vi.fn(),
    dispose: vi.fn(),
    attributes: {
      position: { array: new Float32Array([1, 2, 3, 4, 5, 6]) },
      normal: { array: new Float32Array([0, 1, 0, 0, 1, 0]) },
      uv: { array: new Float32Array([0, 0, 1, 1]) }
    },
    index: { array: new Uint32Array([0, 1, 2, 3, 4, 5]) }
  }

  const mockMesh = {
    position: { set: vi.fn() },
    rotation: { set: vi.fn() },
    geometry: mockGeometry,
    material: null,
    dispose: vi.fn()
  }

  const mockCamera = {
    position: { set: vi.fn() },
    rotation: { set: vi.fn() },
    fov: 75,
    aspect: 1.33,
    near: 0.1,
    far: 1000,
    updateProjectionMatrix: vi.fn()
  }

  const mockRenderer = {
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    setClearColor: vi.fn(),
    render: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    renderLists: { dispose: vi.fn() },
    shadowMap: { enabled: false, type: null },
    info: {
      render: { calls: 5, triangles: 100 },
      memory: { geometries: 10, textures: 5 }
    }
  }

  const mockScene = {
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
    fog: null
  }

  const mockLight = {
    color: { setRGB: vi.fn() },
    intensity: 1,
    position: { set: vi.fn() },
    type: 'AmbientLight'
  }

  const mockColor = {
    r: 0.5, g: 0.5, b: 1
  }

  const mockMaterial = {
    dispose: vi.fn(),
    wireframe: false
  }

  return {
    Scene: vi.fn(() => mockScene),
    PerspectiveCamera: vi.fn(() => mockCamera),
    WebGLRenderer: vi.fn(() => mockRenderer),
    BufferGeometry: vi.fn(() => mockGeometry),
    BufferAttribute: vi.fn((array, itemSize) => ({ array, itemSize })),
    Mesh: vi.fn(() => mockMesh),
    MeshLambertMaterial: vi.fn(() => mockMaterial),
    AmbientLight: vi.fn(() => ({ ...mockLight, type: 'AmbientLight' })),
    DirectionalLight: vi.fn(() => ({ ...mockLight, type: 'DirectionalLight' })),
    Color: vi.fn(() => mockColor),
    Fog: vi.fn((color, near, far) => ({ color, near, far })),
    FogExp2: vi.fn((color, density) => ({ color, density })),
    PCFSoftShadowMap: 'PCFSoftShadowMap'
  }
})

describe('ThreeJsAdapter', () => {
  let mockCanvas: HTMLCanvasElement
  let mockThreeJsContext: IThreeJsContext
  let adapter: IThreeJsAdapter

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup mock canvas and context
    mockCanvas = createMockCanvas()
    const THREE = await import('three')
    
    mockThreeJsContext = {
      canvas: mockCanvas,
      renderer: new THREE.WebGLRenderer({ canvas: mockCanvas }),
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000)
    }

    // Create adapter instance for testing
    const testLayer = Layer.succeed(ThreeJsContext, mockThreeJsContext).pipe(
      Layer.provide(ThreeJsAdapterLive)
    )
    
    adapter = await runEffect(Layer.build(testLayer).pipe(
      Effect.map(context => Context.get(context, ThreeJsAdapter))
    ))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Layer Creation', () => {
    it('should create ThreeJsContextLive layer successfully', async () => {
      // Mock DOM methods
      const mockAppendChild = vi.fn()
      const mockCreateElement = vi.fn(() => mockCanvas)
      
      Object.defineProperty(document, 'createElement', {
        value: mockCreateElement,
        writable: true
      })
      
      Object.defineProperty(document.body, 'appendChild', {
        value: mockAppendChild,
        writable: true
      })

      const result = await expectEffect.toSucceed(
        Layer.build(ThreeJsContextLive).pipe(
          Effect.map(context => Context.get(context, ThreeJsContext))
        )
      )

      expect(result).toBeDefined()
      expect(mockCreateElement).toHaveBeenCalledWith('canvas')
      expect(mockAppendChild).toHaveBeenCalledWith(mockCanvas)
    })

    it('should create ThreeJsAdapterLive layer successfully', async () => {
      const testLayer = Layer.succeed(ThreeJsContext, mockThreeJsContext).pipe(
        Layer.provide(ThreeJsAdapterLive)
      )

      const result = await expectEffect.toSucceed(
        Layer.build(testLayer).pipe(
          Effect.map(context => Context.get(context, ThreeJsAdapter))
        )
      )

      expect(result).toBeDefined()
      expect(result.render).toBeDefined()
      expect(result.createMesh).toBeDefined()
      expect(result.updateCamera).toBeDefined()
    })
  })

  describe('Basic Operations', () => {
    it('should render frame successfully', async () => {
      await expectEffect.toSucceed(adapter.render())
      
      // Verify render command was queued
      expect(mockThreeJsContext.renderer.render).toHaveBeenCalled()
    })

    it('should clear renderer successfully', async () => {
      await expectEffect.toSucceed(adapter.clear())
      
      expect(mockThreeJsContext.renderer.clear).toHaveBeenCalled()
    })

    it('should check if adapter is ready', async () => {
      // Mock canvas connection
      Object.defineProperty(mockCanvas, 'isConnected', {
        value: true,
        writable: true
      })

      const isReady = await expectEffect.toSucceed(adapter.isReady())
      expect(isReady).toBe(true)
    })

    it('should wait for adapter to be ready', async () => {
      Object.defineProperty(mockCanvas, 'isConnected', {
        value: true,
        writable: true
      })

      await expectEffect.toSucceed(adapter.waitForReady())
    })

    it('should fail when adapter is not ready', async () => {
      Object.defineProperty(mockCanvas, 'isConnected', {
        value: false,
        writable: true
      })

      await expectEffect.toFail(adapter.waitForReady())
    })
  })

  describe('Camera Operations', () => {
    it('should update camera successfully', async () => {
      const camera: Camera = {
        position: { x: 10, y: 20, z: 30 },
        rotation: { x: 0.1, y: 0.2, z: 0.3 },
        fov: 90,
        aspect: 16/9,
        near: 0.5,
        far: 2000
      }

      await expectEffect.toSucceed(adapter.updateCamera(camera))
      
      expect(mockThreeJsContext.camera.position.set).toHaveBeenCalledWith(10, 20, 30)
      expect(mockThreeJsContext.camera.rotation.set).toHaveBeenCalledWith(0.1, 0.2, 0.3)
      expect(mockThreeJsContext.camera.updateProjectionMatrix).toHaveBeenCalled()
    })

    it('should get current camera state', async () => {
      const camera = await expectEffect.toSucceed(adapter.getCamera())
      
      expect(camera).toBeDefined()
      expect(camera.position).toBeDefined()
      expect(camera.rotation).toBeDefined()
    })

    it('should handle camera update errors', async () => {
      // Mock camera position.set to throw error
      mockThreeJsContext.camera.position.set = vi.fn(() => {
        throw new Error('Camera update failed')
      })

      const camera: Camera = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        fov: 75,
        aspect: 1,
        near: 0.1,
        far: 1000
      }

      const result = await runEffectExit(adapter.updateCamera(camera))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('Mesh Operations', () => {
    let meshData: ChunkMeshData

    beforeEach(() => {
      meshData = {
        chunkX: 0,
        chunkZ: 0,
        positions: new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]),
        normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
        uvs: new Float32Array([0, 0, 1, 0, 0.5, 1]),
        indices: new Uint32Array([0, 1, 2])
      }
    })

    it('should create mesh successfully', async () => {
      const handle = await expectEffect.toSucceed(adapter.createMesh(meshData))
      
      expect(handle).toBeDefined()
      expect(handle.id).toBeDefined()
      expect(handle.chunkX).toBe(0)
      expect(handle.chunkZ).toBe(0)
      expect(mockThreeJsContext.scene.add).toHaveBeenCalled()
    })

    it('should update mesh successfully', async () => {
      const handle = await expectEffect.toSucceed(adapter.createMesh(meshData))
      const updatedMeshData = { ...meshData, positions: new Float32Array([1, 1, 1, 2, 2, 2, 3, 3, 3]) }
      
      await expectEffect.toSucceed(adapter.updateMesh(handle, updatedMeshData))
    })

    it('should remove mesh successfully', async () => {
      const handle = await expectEffect.toSucceed(adapter.createMesh(meshData))
      
      await expectEffect.toSucceed(adapter.removeMesh(handle))
      expect(mockThreeJsContext.scene.remove).toHaveBeenCalled()
    })

    it('should get mesh data', async () => {
      const handle = await expectEffect.toSucceed(adapter.createMesh(meshData))
      const retrievedMeshData = await expectEffect.toSucceed(adapter.getMesh(handle))
      
      expect(retrievedMeshData._tag).toBe('Some')
    })

    it('should handle mesh creation errors', async () => {
      // Mock BufferGeometry constructor to throw
      const THREE = await import('three')
      vi.mocked(THREE.BufferGeometry).mockImplementation(() => {
        throw new Error('Geometry creation failed')
      })

      const result = await runEffectExit(adapter.createMesh(meshData))
      expect(result._tag).toBe('Failure')
    })

    it('should handle update of non-existent mesh', async () => {
      const invalidHandle: MeshHandle = { id: 'invalid', chunkX: 0, chunkZ: 0 }
      
      const result = await runEffectExit(adapter.updateMesh(invalidHandle, meshData))
      expect(result._tag).toBe('Failure')
    })

    it('should create multiple meshes', async () => {
      const meshes = [meshData, { ...meshData, chunkX: 1 }, { ...meshData, chunkX: 2 }]
      
      const handles = await expectEffect.toSucceed(adapter.createMeshes(meshes))
      expect(handles).toHaveLength(3)
      expect(mockThreeJsContext.scene.add).toHaveBeenCalledTimes(3)
    })

    it('should update multiple meshes', async () => {
      const handle1 = await expectEffect.toSucceed(adapter.createMesh(meshData))
      const handle2 = await expectEffect.toSucceed(adapter.createMesh({ ...meshData, chunkX: 1 }))
      
      const updates = [
        { handle: handle1, meshData },
        { handle: handle2, meshData: { ...meshData, chunkX: 1 } }
      ]
      
      await expectEffect.toSucceed(adapter.updateMeshes(updates))
    })

    it('should remove multiple meshes', async () => {
      const handle1 = await expectEffect.toSucceed(adapter.createMesh(meshData))
      const handle2 = await expectEffect.toSucceed(adapter.createMesh({ ...meshData, chunkX: 1 }))
      
      await expectEffect.toSucceed(adapter.removeMeshes([handle1, handle2]))
      expect(mockThreeJsContext.scene.remove).toHaveBeenCalledTimes(2)
    })
  })

  describe('Chunk Operations (Backward Compatibility)', () => {
    let meshData: ChunkMeshData

    beforeEach(() => {
      meshData = {
        chunkX: 5,
        chunkZ: 10,
        positions: new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]),
        normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
        uvs: new Float32Array([0, 0, 1, 0, 0.5, 1]),
        indices: new Uint32Array([0, 1, 2])
      }
    })

    it('should add chunk mesh successfully', async () => {
      await expectEffect.toSucceed(adapter.addChunkMesh(meshData))
      expect(mockThreeJsContext.scene.add).toHaveBeenCalled()
    })

    it('should remove chunk mesh successfully', async () => {
      await expectEffect.toSucceed(adapter.addChunkMesh(meshData))
      await expectEffect.toSucceed(adapter.removeChunkMesh(5, 10))
      expect(mockThreeJsContext.scene.remove).toHaveBeenCalled()
    })

    it('should update chunk mesh successfully', async () => {
      await expectEffect.toSucceed(adapter.addChunkMesh(meshData))
      await expectEffect.toSucceed(adapter.updateChunkMesh(meshData))
    })

    it('should handle chunk removal of non-existent chunk', async () => {
      // Should not throw error for non-existent chunk
      await expectEffect.toSucceed(adapter.removeChunkMesh(999, 999))
    })
  })

  describe('Viewport Operations', () => {
    it('should resize viewport successfully', async () => {
      const config: ViewportConfig = {
        width: 1920,
        height: 1080,
        pixelRatio: 2
      }

      await expectEffect.toSucceed(adapter.resize(config))
      
      expect(mockThreeJsContext.renderer.setSize).toHaveBeenCalledWith(1920, 1080)
      expect(mockThreeJsContext.renderer.setPixelRatio).toHaveBeenCalledWith(2)
      expect(mockThreeJsContext.camera.updateProjectionMatrix).toHaveBeenCalled()
    })

    it('should handle resize without pixelRatio', async () => {
      const config: ViewportConfig = {
        width: 800,
        height: 600
      }

      await expectEffect.toSucceed(adapter.resize(config))
      expect(mockThreeJsContext.renderer.setSize).toHaveBeenCalledWith(800, 600)
    })

    it('should handle resize errors', async () => {
      mockThreeJsContext.renderer.setSize = vi.fn(() => {
        throw new Error('Resize failed')
      })

      const config: ViewportConfig = { width: 800, height: 600 }
      const result = await runEffectExit(adapter.resize(config))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('Rendering Effects', () => {
    it('should set fog successfully', async () => {
      const fogConfig: FogConfig = {
        enabled: true,
        color: { r: 0.5, g: 0.6, b: 0.7 },
        near: 10,
        far: 100
      }

      await expectEffect.toSucceed(adapter.setFog(fogConfig))
      expect(mockThreeJsContext.scene.fog).toBeDefined()
    })

    it('should set fog with density', async () => {
      const fogConfig: FogConfig = {
        enabled: true,
        color: { r: 0.5, g: 0.6, b: 0.7 },
        density: 0.01
      }

      await expectEffect.toSucceed(adapter.setFog(fogConfig))
    })

    it('should disable fog', async () => {
      const fogConfig: FogConfig = {
        enabled: false
      }

      await expectEffect.toSucceed(adapter.setFog(fogConfig))
      expect(mockThreeJsContext.scene.fog).toBeNull()
    })

    it('should set lighting configuration', async () => {
      const lightingConfig: LightingConfig = {
        ambient: {
          color: { r: 0.2, g: 0.2, b: 0.2 },
          intensity: 0.4
        },
        directional: [{
          color: { r: 1, g: 1, b: 1 },
          intensity: 0.8,
          direction: { x: 1, y: 1, z: 1 }
        }]
      }

      await expectEffect.toSucceed(adapter.setLighting(lightingConfig))
      expect(mockThreeJsContext.scene.add).toHaveBeenCalled()
    })

    it('should toggle wireframe mode', async () => {
      await expectEffect.toSucceed(adapter.setWireframe(true))
      await expectEffect.toSucceed(adapter.setWireframe(false))
    })

    it('should handle lighting errors', async () => {
      mockThreeJsContext.scene.add = vi.fn(() => {
        throw new Error('Lighting setup failed')
      })

      const lightingConfig: LightingConfig = {
        ambient: { color: { r: 1, g: 1, b: 1 }, intensity: 1 }
      }

      const result = await runEffectExit(adapter.setLighting(lightingConfig))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('Statistics and Monitoring', () => {
    it('should get render statistics', async () => {
      const stats = await expectEffect.toSucceed(adapter.getStats())
      
      expect(stats).toBeDefined()
      expect(stats.drawCalls).toBe(5)
      expect(stats.triangles).toBe(100)
      expect(stats.memoryUsage).toBe(15)
      expect(typeof stats.activeMeshes).toBe('number')
    })

    it('should get memory usage', async () => {
      const memoryUsage = await expectEffect.toSucceed(adapter.getMemoryUsage())
      
      expect(memoryUsage).toBeDefined()
      expect(memoryUsage.totalBytes).toBeDefined()
      expect(memoryUsage.textureBytes).toBeDefined()
      expect(memoryUsage.geometryBytes).toBeDefined()
    })

    it('should collect garbage', async () => {
      const result = await expectEffect.toSucceed(adapter.collectGarbage())
      
      expect(result).toBeDefined()
      expect(result.freedBytes).toBeGreaterThanOrEqual(0)
      expect(mockThreeJsContext.renderer.renderLists.dispose).toHaveBeenCalled()
    })

    it('should handle stats errors', async () => {
      // Mock renderer.info to throw
      Object.defineProperty(mockThreeJsContext.renderer, 'info', {
        get: () => { throw new Error('Stats error') }
      })

      const result = await runEffectExit(adapter.getStats())
      expect(result._tag).toBe('Failure')
    })
  })

  describe('Resource Management', () => {
    it('should dispose resources successfully', async () => {
      // Create some meshes first
      const meshData: ChunkMeshData = {
        chunkX: 0, chunkZ: 0,
        positions: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 1, 0]),
        uvs: new Float32Array([0, 0]),
        indices: new Uint32Array([0])
      }
      
      await expectEffect.toSucceed(adapter.createMesh(meshData))
      await expectEffect.toSucceed(adapter.dispose())
      
      expect(mockThreeJsContext.renderer.dispose).toHaveBeenCalled()
    })

    it('should handle disposal errors', async () => {
      mockThreeJsContext.renderer.dispose = vi.fn(() => {
        throw new Error('Disposal failed')
      })

      const result = await runEffectExit(adapter.dispose())
      expect(result._tag).toBe('Failure')
    })
  })

  describe('Queue Processing', () => {
    it('should process render queue commands', async () => {
      // The adapter should be processing commands in background
      // We can verify by checking that operations complete successfully
      const meshData: ChunkMeshData = {
        chunkX: 0, chunkZ: 0,
        positions: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 1, 0]),
        uvs: new Float32Array([0, 0]),
        indices: new Uint32Array([0])
      }
      
      const handle = await expectEffect.toSucceed(adapter.createMesh(meshData))
      await expectEffect.toSucceed(adapter.render())
      
      expect(handle).toBeDefined()
    })

    it('should access render queue', () => {
      expect(adapter.renderQueue).toBeDefined()
      expect(adapter.processRenderQueue).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle render errors gracefully', async () => {
      mockThreeJsContext.renderer.render = vi.fn(() => {
        throw new Error('Render failed')
      })

      const result = await runEffectExit(adapter.render())
      expect(result._tag).toBe('Failure')
    })

    it('should handle clear errors gracefully', async () => {
      mockThreeJsContext.renderer.clear = vi.fn(() => {
        throw new Error('Clear failed')
      })

      const result = await runEffectExit(adapter.clear())
      expect(result._tag).toBe('Failure')
    })

    it('should validate error types', async () => {
      const invalidHandle: MeshHandle = { id: 'invalid', chunkX: 0, chunkZ: 0 }
      const meshData: ChunkMeshData = {
        chunkX: 0, chunkZ: 0,
        positions: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 1, 0]),
        uvs: new Float32Array([0, 0]),
        indices: new Uint32Array([0])
      }

      const result = await runEffectExit(adapter.updateMesh(invalidHandle, meshData))
      
      if (result._tag === 'Failure') {
        // Should be a MeshError
        expect(result.cause).toBeDefined()
      }
    })
  })

  describe('Integration with Domain Types', () => {
    it('should handle all Camera properties', async () => {
      const camera: Camera = {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0.1, y: 0.2, z: 0.3 },
        fov: 60,
        aspect: 16/9,
        near: 0.1,
        far: 1000
      }

      await expectEffect.toSucceed(adapter.updateCamera(camera))
      
      expect(mockThreeJsContext.camera.fov).toBe(60)
      expect(mockThreeJsContext.camera.aspect).toBe(16/9)
      expect(mockThreeJsContext.camera.near).toBe(0.1)
      expect(mockThreeJsContext.camera.far).toBe(1000)
    })

    it('should handle partial Camera updates', async () => {
      const partialCamera: Camera = {
        position: { x: 5, y: 5, z: 5 },
        rotation: { x: 0, y: 0, z: 0 }
        // Missing optional properties
      }

      await expectEffect.toSucceed(adapter.updateCamera(partialCamera))
    })

    it('should validate ChunkMeshData format', async () => {
      const meshData: ChunkMeshData = {
        chunkX: -1,
        chunkZ: -1,
        positions: new Float32Array([]),
        normals: new Float32Array([]),
        uvs: new Float32Array([]),
        indices: new Uint32Array([])
      }

      // Should handle empty mesh data gracefully
      const handle = await expectEffect.toSucceed(adapter.createMesh(meshData))
      expect(handle.chunkX).toBe(-1)
      expect(handle.chunkZ).toBe(-1)
    })
  })

  describe('Performance Considerations', () => {
    it('should handle large mesh data efficiently', async () => {
      const largePositions = new Float32Array(30000) // 10k vertices
      const largeNormals = new Float32Array(30000)
      const largeUvs = new Float32Array(20000)
      const largeIndices = new Uint32Array(15000)

      largePositions.fill(1)
      largeNormals.fill(0)
      largeUvs.fill(0.5)
      largeIndices.fill(0)

      const largeMeshData: ChunkMeshData = {
        chunkX: 0, chunkZ: 0,
        positions: largePositions,
        normals: largeNormals,
        uvs: largeUvs,
        indices: largeIndices
      }

      const startTime = performance.now()
      await expectEffect.toSucceed(adapter.createMesh(largeMeshData))
      const endTime = performance.now()

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should handle multiple concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        adapter.createMesh({
          chunkX: i, chunkZ: i,
          positions: new Float32Array([i, i, i]),
          normals: new Float32Array([0, 1, 0]),
          uvs: new Float32Array([0, 0]),
          indices: new Uint32Array([0])
        })
      )

      const results = await Promise.all(operations.map(op => expectEffect.toSucceed(op)))
      expect(results).toHaveLength(10)
    })
  })
})