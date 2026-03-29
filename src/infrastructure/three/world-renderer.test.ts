import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// DOM mocks — vitest runs in 'node' (no real DOM)
// chunk-mesh.ts needs document.createElement (canvas) and Image for atlas build.
// ---------------------------------------------------------------------------
if (typeof globalThis.document === 'undefined') {
  const ctx = {
    fillStyle: '',
    fillRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
  }
  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement: vi.fn(() => ({
        width: 256, height: 256,
        getContext: () => ctx,
      })),
      body: { appendChild: vi.fn() },
    },
    writable: true,
  })
}

if (typeof globalThis.Image === 'undefined') {
  class MockImage {
    onload: (() => void) | null = null
    onerror: ((_e: unknown) => void) | null = null
    private _src = ''
    get src(): string { return this._src }
    set src(url: string) {
      this._src = url
      // Trigger onload synchronously — simulates successful texture load
      if (this.onload) this.onload()
    }
  }
  Object.defineProperty(globalThis, 'Image', { value: MockImage, writable: true })
}

// ---------------------------------------------------------------------------
// THREE.js mock — must be declared before any imports that touch 'three'
// ---------------------------------------------------------------------------
vi.mock('three', () => ({
  Mesh: vi.fn((geometry?: unknown, material?: unknown) => ({
    geometry: geometry ?? { dispose: vi.fn() },
    material: material ?? {},
    visible: true,
    userData: {} as Record<string, unknown>,
    position: { set: vi.fn() },
    renderOrder: 0,
    castShadow: false,
    receiveShadow: false,
  })),
  BufferGeometry: vi.fn(() => {
    const attributes: Record<string, unknown> = {}
    let index: unknown = null
    return {
      setAttribute: vi.fn((name: string, attr: unknown) => { attributes[name] = attr }),
      getAttribute: vi.fn((name: string) => attributes[name]),
      setIndex: vi.fn((attr: unknown) => { index = attr }),
      getIndex: vi.fn(() => index),
      setDrawRange: vi.fn(),
      computeBoundingSphere: vi.fn(),
      dispose: vi.fn(),
    }
  }),
  BufferAttribute: vi.fn((array: ArrayLike<number>, _itemSize: number) => ({
    array,
    needsUpdate: false,
  })),
  Scene: vi.fn(() => ({ add: vi.fn(), remove: vi.fn(), children: [] })),
  Frustum: vi.fn(() => ({ setFromProjectionMatrix: vi.fn(), intersectsBox: vi.fn(() => true) })),
  Box3: vi.fn(() => ({ set: vi.fn() })),
  Vector3: vi.fn(() => ({ set: vi.fn(), copy: vi.fn(), x: 0, y: 0, z: 0 })),
  Vector2: vi.fn(() => ({ set: vi.fn(), x: 0, y: 0 })),
  Matrix4: vi.fn(() => ({ multiplyMatrices: vi.fn(), elements: Arr.makeBy(16, () => 0) })),
  PerspectiveCamera: vi.fn(() => ({
    updateMatrixWorld: vi.fn(),
    updateProjectionMatrix: vi.fn(),
    projectionMatrix: { elements: Arr.makeBy(16, () => 0) },
    matrixWorldInverse: { elements: Arr.makeBy(16, () => 0) },
    isCamera: true,
    isPerspectiveCamera: true,
    far: 1000,
    aspect: 1,
    position: { set: vi.fn(), copy: vi.fn(), x: 0, y: 0, z: 0 },
    quaternion: { copy: vi.fn() },
  })),
  MeshLambertMaterial: vi.fn(() => ({ map: null, dispose: vi.fn() })),
  ShaderMaterial: vi.fn((params: { uniforms?: Record<string, { value: unknown }> } = {}) => ({
    uniforms: params.uniforms ?? {},
    transparent: true,
    depthWrite: false,
    dispose: vi.fn(),
  })),
  CanvasTexture: vi.fn(() => ({ magFilter: 0, minFilter: 0, wrapS: 0, wrapT: 0, dispose: vi.fn() })),
  WebGLRenderTarget: vi.fn((width: number, height: number) => ({ texture: { width, height }, setSize: vi.fn(), dispose: vi.fn() })),
  NearestFilter: 0,
  LinearFilter: 1,
  ClampToEdgeWrapping: 0,
  RGBAFormat: 0,
  FrontSide: 0,
}))

import { WorldRendererService, WorldRendererServiceLive } from './world-renderer'
import { ChunkMeshService } from './meshing/chunk-mesh'
import { SceneService } from './scene/scene-service'
import type { Chunk } from '@/domain/chunk'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeChunk = (x: number, z: number): Chunk => ({
  coord: { x, z },
  blocks: new Uint8Array(16 * 256 * 16),
  fluid: Option.none(),
})

const makeMockMesh = (coord: { x: number; z: number }) => ({
  geometry: { dispose: vi.fn(), getAttribute: vi.fn(() => undefined) },
  material: {},
  visible: true,
  userData: { chunkCoord: coord },
  position: { set: vi.fn() },
})

// Build a test-specific Layer that bypasses WorldRendererServiceLive's bundled dependencies.
// We use Layer.effect to construct WorldRendererService with injected mocks.
const buildTestLayer = (
  createChunkMesh: ReturnType<typeof vi.fn> = vi.fn((chunk: Chunk) =>
    Effect.succeed({ opaqueMesh: makeMockMesh(chunk.coord) as unknown as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>() })
  ),
  updateChunkMesh: ReturnType<typeof vi.fn> = vi.fn((_m: THREE.Mesh, w: Option.Option<THREE.Mesh>) => Effect.succeed(w)),
  sceneAdd: ReturnType<typeof vi.fn> = vi.fn((_s: unknown, _m: unknown) => Effect.void),
  sceneRemove: ReturnType<typeof vi.fn> = vi.fn((_s: unknown, _m: unknown) => Effect.void)
) => {
  const chunkMeshLayer = Layer.succeed(ChunkMeshService, {
    atlasTexture: {} as THREE.Texture,
    createChunkMesh,
    updateChunkMesh,
    disposeMesh: vi.fn((_m: THREE.Mesh) => Effect.void),
  } as unknown as ChunkMeshService)

  const sceneLayer = Layer.succeed(SceneService, {
    create: () => Effect.succeed({} as THREE.Scene),
    add: sceneAdd,
    remove: sceneRemove,
  } as unknown as SceneService)

  return Layer.provide(WorldRendererServiceLive, Layer.mergeAll(chunkMeshLayer, sceneLayer))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('infrastructure/three/world-renderer', () => {
  describe('WorldRendererServiceLive', () => {
    it('should be defined', () => {
      expect(WorldRendererServiceLive).toBeDefined()
    })

    it.effect('creates the refraction render target at reduced resolution', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        yield* WorldRendererService
        expect(THREE.WebGLRenderTarget).toHaveBeenCalledWith(400, 300, expect.any(Object))
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should expose all required methods', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        expect(typeof s.syncChunksToScene === 'function').toBe(true)
        expect(typeof s.updateChunkInScene === 'function').toBe(true)
        expect(typeof s.applyFrustumCulling === 'function').toBe(true)
        expect(typeof s.clearScene === 'function').toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // SceneService.Default calls scene.add(object) and scene.remove(object) directly.
  // The THREE.js mock provides Scene with add/remove spy functions, so we use that.
const makeScene = (): THREE.Scene => new THREE.Scene()

const makeRenderer = (): THREE.WebGLRenderer =>
  ({
    setRenderTarget: vi.fn(),
    render: vi.fn(),
    shadowMap: { autoUpdate: true, needsUpdate: false },
  } as unknown as THREE.WebGLRenderer)

  describe('syncChunksToScene', () => {
    it.effect('should add new chunk meshes to scene', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0)], scene)
        // scene.add should be called once per new chunk
        expect(scene.add).toHaveBeenCalledTimes(2)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should not add mesh again when chunks are unchanged', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunks = [makeChunk(0, 0)]
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene(chunks, scene)
        const addCountAfterFirst = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length
        yield* s.syncChunksToScene(chunks, scene)
        const addCountAfterSecond = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length
        expect(addCountAfterFirst).toBe(1)
        expect(addCountAfterSecond).toBe(1) // no additional adds
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should remove meshes for stale chunks', () => {
      const createChunkMesh = vi.fn((chunk: Chunk) =>
        Effect.succeed({ opaqueMesh: makeMockMesh(chunk.coord) as unknown as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>() })
      )
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0)], scene)
        yield* s.syncChunksToScene([makeChunk(0, 0)], scene)
        expect(scene.remove).toHaveBeenCalledTimes(1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should handle empty chunk list without error', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([], scene)
        expect(true).toBe(true) // completes without error
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('clearScene', () => {
    it.effect('should remove all tracked chunk meshes', () => {
      const createChunkMesh = vi.fn((chunk: Chunk) =>
        Effect.succeed({ opaqueMesh: makeMockMesh(chunk.coord) as unknown as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>() })
      )
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0), makeChunk(0, 1)], scene)
        yield* s.clearScene(scene)
        // 3 added, then 3 removed
        expect(scene.remove).toHaveBeenCalledTimes(3)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should be safe to call on empty state', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.clearScene(scene)
        expect(true).toBe(true) // completes without error
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('doRefractionPrePass', () => {
    it.effect('should skip the refraction pass when there are no water meshes', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const renderer = makeRenderer()
      const camera = new THREE.PerspectiveCamera()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0)], scene)
        yield* s.doRefractionPrePass(renderer, scene, camera)
        expect(renderer.setRenderTarget).not.toHaveBeenCalled()
        expect(renderer.render).not.toHaveBeenCalled()
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should skip a repeated refraction pass when camera and scene are unchanged', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const renderer = makeRenderer()
      const camera = new THREE.PerspectiveCamera()
      const chunk = makeChunk(0, 0)
      chunk.blocks[0] = 6

      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([chunk], scene)

        yield* s.doRefractionPrePass(renderer, scene, camera)
        const renderCallsAfterFirstPass = (renderer.render as ReturnType<typeof vi.fn>).mock.calls.length

        yield* s.doRefractionPrePass(renderer, scene, camera)
        const renderCallsAfterSecondPass = (renderer.render as ReturnType<typeof vi.fn>).mock.calls.length

        expect(renderCallsAfterFirstPass).toBe(1)
        expect(renderCallsAfterSecondPass).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('updateWaterUniforms', () => {
    it.effect('updates time and camera position uniforms in place', () => {
      const TestLayer = buildTestLayer()
      const cameraPosition = new THREE.Vector3()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.updateWaterUniforms(42, cameraPosition)
        type WaterMat = { uniforms: { uTime: { value: number }; uCameraPosition: { value: { copy: ReturnType<typeof vi.fn> } }; uResolution: { value: { set: ReturnType<typeof vi.fn> } } } }
        const mockResults = (THREE.ShaderMaterial as ReturnType<typeof vi.fn>).mock.results as Array<{ value: WaterMat }>
        const shaderMaterial = Option.getOrThrow(Arr.last(mockResults)).value
        expect(shaderMaterial.uniforms.uTime.value).toBe(42)
        expect(shaderMaterial.uniforms.uCameraPosition.value.copy).toHaveBeenCalledWith(cameraPosition)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('updateWaterResolution', () => {
    it.effect('updates the resolution uniform in place', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.updateWaterResolution(1280, 720)
        type WaterMat = { uniforms: { uResolution: { value: { set: ReturnType<typeof vi.fn> } } } }
        const mockResults = (THREE.ShaderMaterial as ReturnType<typeof vi.fn>).mock.results as Array<{ value: WaterMat }>
        const shaderMaterial = Option.getOrThrow(Arr.last(mockResults)).value
        expect(shaderMaterial.uniforms.uResolution.value.set).toHaveBeenCalledWith(1280, 720)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // D8: Block placement → worldRenderer mesh rebuild test
  // ---------------------------------------------------------------------------

  describe('updateChunkInScene', () => {
    it.effect('updateChunkInScene on a known chunk does not call scene.add again', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunk = makeChunk(2, 3)
      return Effect.gen(function* () {
        const s = yield* WorldRendererService

        // First: sync puts the chunk in the scene (1 scene.add call)
        yield* s.syncChunksToScene([chunk], scene)
        const addCountAfterSync = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        // Modify the chunk blocks to simulate a block placement
        chunk.blocks[0] = 1 // GRASS

        // Update: must NOT add a second mesh to the scene
        yield* s.updateChunkInScene(chunk, scene)
        const addCountAfterUpdate = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        expect(addCountAfterSync).toBe(1)
        expect(addCountAfterUpdate).toBe(1) // no extra scene.add on in-place update
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('updateChunkInScene on an unknown chunk adds it to the scene once', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunk = makeChunk(7, 9)
      return Effect.gen(function* () {
        const s = yield* WorldRendererService

        // Call updateChunkInScene WITHOUT prior syncChunksToScene
        yield* s.updateChunkInScene(chunk, scene)

        // The new mesh must be added to the scene exactly once
        expect((scene.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('does not call scene.add again when updating an already-tracked chunk mesh', () => {
      const createChunkMesh = vi.fn((chunk: Chunk) =>
        Effect.succeed({ opaqueMesh: makeMockMesh(chunk.coord) as unknown as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>() })
      )
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      const chunk = makeChunk(4, 4)
      return Effect.gen(function* () {
        const s = yield* WorldRendererService

        // First sync adds the chunk mesh (one scene.add call)
        yield* s.syncChunksToScene([chunk], scene)
        const addCountAfterSync = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        // Modify block and call update — should NOT call scene.add again
        chunk.blocks[0] = 2
        yield* s.updateChunkInScene(chunk, scene)
        const addCountAfterUpdate = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length

        expect(addCountAfterSync).toBe(1)
        expect(addCountAfterUpdate).toBe(1) // no extra scene.add on update
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('adds a water mesh when an updated chunk gains water', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunk = makeChunk(2, 3)

      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([chunk], scene)
        const addCountBeforeUpdate = (scene.add as ReturnType<typeof vi.fn>).mock.calls.length
        chunk.blocks[0] = 6
        yield* s.updateChunkInScene(chunk, scene)

        expect((scene.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(addCountBeforeUpdate + 1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('removes a water mesh when an updated chunk loses water', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const chunk = makeChunk(4, 4)
      chunk.blocks[0] = 6

      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([chunk], scene)
        const removeCountBeforeUpdate = (scene.remove as ReturnType<typeof vi.fn>).mock.calls.length
        chunk.blocks[0] = 0
        yield* s.updateChunkInScene(chunk, scene)

        expect((scene.remove as ReturnType<typeof vi.fn>).mock.calls.length).toBe(removeCountBeforeUpdate + 1)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // applyFrustumCulling behavioral tests
  //
  // applyFrustumCulling(camera) takes only a PerspectiveCamera (no scene arg).
  // The THREE mocks provide:
  //   - PerspectiveCamera: updateMatrixWorld() vi.fn, projectionMatrix, matrixWorldInverse
  //   - Frustum: setFromProjectionMatrix() vi.fn, intersectsBox() returns true by default
  // ---------------------------------------------------------------------------

  describe('applyFrustumCulling', () => {
    it.effect('sets mesh.visible = true for chunks inside the frustum', () => {
      // Default Frustum mock: intersectsBox returns true → all meshes visible.
      const mockMeshes: ReturnType<typeof makeMockMesh>[] = []
      const createChunkMesh = vi.fn((chunk: Chunk) => {
        const mesh = makeMockMesh(chunk.coord)
        mockMeshes.push(mesh)
        return Effect.succeed({ opaqueMesh: mesh as unknown as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>() })
      })
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      const camera = new THREE.PerspectiveCamera()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0)], scene)
        yield* s.applyFrustumCulling(camera)
        // All meshes visible (intersectsBox = true from default mock)
        Arr.forEach(mockMeshes, (mesh) => {
          expect(mesh.visible).toBe(true)
        })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('reuses the frustum cache when the camera pose is unchanged', () => {
      const mockMeshes: ReturnType<typeof makeMockMesh>[] = []
      const createChunkMesh = vi.fn((chunk: Chunk) => {
        const mesh = makeMockMesh(chunk.coord)
        mockMeshes.push(mesh)
        return Effect.succeed({ opaqueMesh: mesh as unknown as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>() })
      })
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      const camera = new THREE.PerspectiveCamera()
      const updateMatrixWorldSpy = vi.spyOn(camera, 'updateMatrixWorld')

      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0)], scene)
        yield* s.applyFrustumCulling(camera)
        yield* s.applyFrustumCulling(camera)

        expect(updateMatrixWorldSpy).toHaveBeenCalledTimes(1)
        Arr.forEach(mockMeshes, (mesh) => {
          expect(mesh.visible).toBe(true)
        })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('invalidates the frustum cache after chunk sync changes the scene', () => {
      const mockMeshes: ReturnType<typeof makeMockMesh>[] = []
      const createChunkMesh = vi.fn((chunk: Chunk) => {
        const mesh = makeMockMesh(chunk.coord)
        mockMeshes.push(mesh)
        return Effect.succeed({ opaqueMesh: mesh as unknown as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>() })
      })
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      const camera = new THREE.PerspectiveCamera()
      const updateMatrixWorldSpy = vi.spyOn(camera, 'updateMatrixWorld')

      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0)], scene)
        yield* s.applyFrustumCulling(camera)

        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0)], scene)
        yield* s.applyFrustumCulling(camera)

        expect(updateMatrixWorldSpy).toHaveBeenCalledTimes(2)
        Arr.forEach(mockMeshes, (mesh) => {
          expect(mesh.visible).toBe(true)
        })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('sets mesh.visible = false for chunks outside the frustum', () => {
      // Temporarily override Frustum mock to return intersectsBox = false.
      const FrustumCtor = THREE.Frustum as ReturnType<typeof vi.fn>
      const originalImpl = FrustumCtor.getMockImplementation()
      FrustumCtor.mockImplementation(() => ({
        setFromProjectionMatrix: vi.fn(),
        intersectsBox: vi.fn(() => false),
      }))

      const mockMeshes: ReturnType<typeof makeMockMesh>[] = []
      const createChunkMesh = vi.fn((chunk: Chunk) => {
        const mesh = makeMockMesh(chunk.coord)
        mesh.visible = true // start visible so we can detect the change
        mockMeshes.push(mesh)
        return Effect.succeed({ opaqueMesh: mesh as unknown as THREE.Mesh, waterMesh: Option.none<THREE.Mesh>() })
      })
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      const camera = new THREE.PerspectiveCamera()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0)], scene)
        yield* s.applyFrustumCulling(camera)

        // Restore original Frustum implementation
        Option.match(Option.fromNullable(originalImpl), {
          onSome: (impl) => FrustumCtor.mockImplementation(impl),
          onNone: () => FrustumCtor.mockImplementation(() => ({
            setFromProjectionMatrix: vi.fn(),
            intersectsBox: vi.fn(() => true),
          })),
        })

        // All meshes hidden (intersectsBox = false)
        Arr.forEach(mockMeshes, (mesh) => {
          expect(mesh.visible).toBe(false)
        })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('sets water mesh visibility in sync with opaque mesh when water is present', () => {
      // Create chunk meshes that include a water mesh (Option.some)
      const mockOpaqueMeshes: ReturnType<typeof makeMockMesh>[] = []
      const mockWaterMeshes: ReturnType<typeof makeMockMesh>[] = []
      const createChunkMesh = vi.fn((chunk: Chunk) => {
        const opaqueMesh = makeMockMesh(chunk.coord)
        const waterMesh = makeMockMesh(chunk.coord)
        waterMesh.visible = true
        mockOpaqueMeshes.push(opaqueMesh)
        mockWaterMeshes.push(waterMesh)
        return Effect.succeed({
          opaqueMesh: opaqueMesh as unknown as THREE.Mesh,
          waterMesh: Option.some(waterMesh as unknown as THREE.Mesh),
        })
      })
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      const camera = new THREE.PerspectiveCamera()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0), makeChunk(1, 0)], scene)
        yield* s.applyFrustumCulling(camera)
        // Default Frustum mock: intersectsBox returns true → all meshes visible
        Arr.forEach(mockOpaqueMeshes, (mesh) => {
          expect(mesh.visible).toBe(true)
        })
        Arr.forEach(mockWaterMeshes, (mesh) => {
          expect(mesh.visible).toBe(true)
        })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('sets water mesh visibility to false when chunk is outside frustum', () => {
      // Override Frustum mock to return intersectsBox = false
      const FrustumCtor = THREE.Frustum as ReturnType<typeof vi.fn>
      const originalImpl = FrustumCtor.getMockImplementation()
      FrustumCtor.mockImplementation(() => ({
        setFromProjectionMatrix: vi.fn(),
        intersectsBox: vi.fn(() => false),
      }))

      const mockOpaqueMeshes: ReturnType<typeof makeMockMesh>[] = []
      const mockWaterMeshes: ReturnType<typeof makeMockMesh>[] = []
      const createChunkMesh = vi.fn((chunk: Chunk) => {
        const opaqueMesh = makeMockMesh(chunk.coord)
        const waterMesh = makeMockMesh(chunk.coord)
        opaqueMesh.visible = true
        waterMesh.visible = true
        mockOpaqueMeshes.push(opaqueMesh)
        mockWaterMeshes.push(waterMesh)
        return Effect.succeed({
          opaqueMesh: opaqueMesh as unknown as THREE.Mesh,
          waterMesh: Option.some(waterMesh as unknown as THREE.Mesh),
        })
      })
      const TestLayer = buildTestLayer(createChunkMesh)
      const scene = makeScene()
      const camera = new THREE.PerspectiveCamera()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.syncChunksToScene([makeChunk(0, 0)], scene)
        yield* s.applyFrustumCulling(camera)

        // Restore original Frustum implementation
        Option.match(Option.fromNullable(originalImpl), {
          onSome: (impl) => FrustumCtor.mockImplementation(impl),
          onNone: () => FrustumCtor.mockImplementation(() => ({
            setFromProjectionMatrix: vi.fn(),
            intersectsBox: vi.fn(() => true),
          })),
        })

        // Both opaque and water meshes should be hidden
        Arr.forEach(mockOpaqueMeshes, (mesh) => {
          expect(mesh.visible).toBe(false)
        })
        Arr.forEach(mockWaterMeshes, (mesh) => {
          expect(mesh.visible).toBe(false)
        })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('completes without error when no chunks are loaded', () => {
      const TestLayer = buildTestLayer()
      const camera = new THREE.PerspectiveCamera()
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* s.applyFrustumCulling(camera)
        expect(true).toBe(true) // completes without error
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
