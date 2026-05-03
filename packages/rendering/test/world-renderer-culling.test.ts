import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import * as THREE from 'three'

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
  Matrix4: vi.fn(() => ({ multiplyMatrices: vi.fn(), elements: Array.from({ length: 16 }, () => 0) })),
  PerspectiveCamera: vi.fn(() => ({
    updateMatrixWorld: vi.fn(),
    updateProjectionMatrix: vi.fn(),
    projectionMatrix: { elements: Array.from({ length: 16 }, () => 0) },
    matrixWorldInverse: { elements: Array.from({ length: 16 }, () => 0) },
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

import { Array as Arr, Effect, Option } from 'effect'
import {
  makeChunk,
  makeMockMesh,
  buildTestLayer,
  makeScene,
  drainSync,
  WorldRendererService,
} from './world-renderer-test-utils'
import type { Chunk } from '@ts-minecraft/terrain'

describe('infrastructure/three/world-renderer', () => {
  // ---------------------------------------------------------------------------
  // applyFrustumCulling behavioral tests
  // ---------------------------------------------------------------------------

  describe('applyFrustumCulling', () => {
    it.effect('sets mesh.visible = true for chunks inside the frustum', () => {
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
      const FrustumCtor = THREE.Frustum as ReturnType<typeof vi.fn>
      const originalImpl = FrustumCtor.getMockImplementation()
      FrustumCtor.mockImplementation(() => ({
        setFromProjectionMatrix: vi.fn(),
        intersectsBox: vi.fn(() => false),
      }))

      const mockMeshes: ReturnType<typeof makeMockMesh>[] = []
      const createChunkMesh = vi.fn((chunk: Chunk) => {
        const mesh = makeMockMesh(chunk.coord)
        mesh.visible = true
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

        Option.match(Option.fromNullable(originalImpl), {
          onSome: (impl) => FrustumCtor.mockImplementation(impl),
          onNone: () => FrustumCtor.mockImplementation(() => ({
            setFromProjectionMatrix: vi.fn(),
            intersectsBox: vi.fn(() => true),
          })),
        })

        Arr.forEach(mockMeshes, (mesh) => {
          expect(mesh.visible).toBe(false)
        })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('sets water mesh visibility in sync with opaque mesh when water is present', () => {
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
        Arr.forEach(mockOpaqueMeshes, (mesh) => {
          expect(mesh.visible).toBe(true)
        })
        Arr.forEach(mockWaterMeshes, (mesh) => {
          expect(mesh.visible).toBe(true)
        })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('sets water mesh visibility to false when chunk is outside frustum', () => {
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

        Option.match(Option.fromNullable(originalImpl), {
          onSome: (impl) => FrustumCtor.mockImplementation(impl),
          onNone: () => FrustumCtor.mockImplementation(() => ({
            setFromProjectionMatrix: vi.fn(),
            intersectsBox: vi.fn(() => true),
          })),
        })

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
        expect(true).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('sets water mesh visible = true on frustum-in chunk with real water blocks', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const camera = new THREE.PerspectiveCamera()
      const waterChunk = makeChunk(0, 0)
      waterChunk.blocks[0] = 6
      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        yield* drainSync(s, [waterChunk], scene)
        yield* s.applyFrustumCulling(camera)
        const waterMeshes = yield* s.getWaterMeshes()
        expect(waterMeshes.length).toBeGreaterThan(0)
        Arr.forEach(waterMeshes, (mesh) => {
          expect(mesh.visible).toBe(true)
        })
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
