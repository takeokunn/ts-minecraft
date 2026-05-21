import { beforeEach, describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import * as THREE from 'three'

vi.mock('three', () => ({
  Mesh: vi.fn((geometry?: unknown, material?: unknown) => ({
    geometry: geometry ?? { dispose: vi.fn() },
    material: material ?? {},
    visible: true,
    userData: {} as Record<string, unknown>,
    position: { set: vi.fn(), copy: vi.fn(), x: 0, y: 0, z: 0 },
    quaternion: { copy: vi.fn(), x: 0, y: 0, z: 0, w: 1 },
    renderOrder: 0,
    castShadow: false,
    receiveShadow: false,
    updateMatrixWorld: vi.fn(),
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
    count: array.length,
    needsUpdate: false,
    copyArray: vi.fn(),
  })),
  Scene: vi.fn(() => ({ add: vi.fn(), remove: vi.fn(), children: [] })),
  Frustum: vi.fn(() => ({ setFromProjectionMatrix: vi.fn(), intersectsBox: vi.fn(() => true) })),
  Box3: vi.fn(() => ({ set: vi.fn() })),
  Vector3: vi.fn(() => ({ set: vi.fn(), copy: vi.fn(), x: 0, y: 0, z: 0 })),
  Vector4: vi.fn(() => ({
    set: vi.fn(function (this: { x: number; y: number; z: number; w: number }, x: number, y: number, z: number, w: number) {
      this.x = x; this.y = y; this.z = z; this.w = w
      return this
    }),
    applyMatrix4: vi.fn(function (this: { x: number; y: number; z: number; w: number }) { return this }),
    x: 0, y: 0, z: 0, w: 1,
  })),
  Vector2: vi.fn((x = 0, y = 0) => ({ set: vi.fn(), x, y })),
  Matrix4: vi.fn(() => ({ multiplyMatrices: vi.fn(), elements: Array.from({ length: 16 }, () => 0) })),
  PerspectiveCamera: vi.fn(() => ({
    updateMatrixWorld: vi.fn(),
    updateProjectionMatrix: vi.fn(),
    projectionMatrix: { elements: Array.from({ length: 16 }, () => 0) },
    matrixWorldInverse: { elements: Array.from({ length: 16 }, () => 0) },
    isCamera: true,
    isPerspectiveCamera: true,
    fov: 50,
    near: 0.1,
    far: 1000,
    aspect: 1,
    zoom: 1,
    position: { set: vi.fn(), copy: vi.fn(), x: 0, y: 0, z: 0 },
    quaternion: { copy: vi.fn(), x: 0, y: 0, z: 0, w: 1 },
  })),
  MeshLambertMaterial: vi.fn(() => ({ map: null, dispose: vi.fn() })),
  ShaderMaterial: vi.fn((params: { uniforms?: Record<string, { value: unknown }> } = {}) => ({
    uniforms: params.uniforms ?? {},
    transparent: true,
    depthWrite: false,
    dispose: vi.fn(),
  })),
  CanvasTexture: vi.fn(() => ({ magFilter: 0, minFilter: 0, wrapS: 0, wrapT: 0, generateMipmaps: false, anisotropy: 1, dispose: vi.fn() })),
  WebGLRenderTarget: vi.fn((width: number, height: number) => ({ texture: { width, height }, setSize: vi.fn(), dispose: vi.fn() })),
  NearestFilter: 0,
  LinearFilter: 1,
  NearestMipmapNearestFilter: 2,
  NearestMipmapLinearFilter: 3,
  LinearMipmapNearestFilter: 4,
  LinearMipmapLinearFilter: 5,
  ClampToEdgeWrapping: 0,
  RGBAFormat: 0,
  FrontSide: 0,
}))

import { Effect, MutableRef, Ref } from 'effect'
import {
  buildTestLayer,
  makeMockMesh,
  makeRenderer,
  makeScene,
  WorldRendererService,
} from './world-renderer-test-utils'
import { createWaterMaterial, type WaterMaterial } from '@ts-minecraft/rendering'
import {
  doRefractionPrePass,
  getWaterMeshes,
  resizeRefractionCamera,
  resizeRefractionRT,
  setRefractionValid,
  type RefractionContext,
  updateWaterResolution,
  updateWaterUniforms,
} from '../infrastructure/renderer/world-renderer-refraction'

beforeEach(() => {
  vi.clearAllMocks()
})

const makeWaterMaterialForTest = (): WaterMaterial =>
  createWaterMaterial(new THREE.CanvasTexture(document.createElement('canvas')), 800, 600)

const makeRefractionContext = (
  waterMeshes: ReadonlyArray<THREE.Mesh>,
  sceneVersion = 0,
): Effect.Effect<RefractionContext, never> =>
  Effect.gen(function* () {
    const waterMeshesRef = yield* Ref.make(waterMeshes)
    const sceneVersionRef = yield* Ref.make(sceneVersion)

    return {
      waterMeshesRef,
      sceneVersionRef,
      _savedWaterVisibility: MutableRef.make(new Map<THREE.Mesh, boolean>()),
      _waterMeshCache: MutableRef.make<ReadonlyArray<THREE.Mesh>>([]),
      _lastRefractionState: MutableRef.make({
        version: -1,
        x: Number.NaN,
        y: Number.NaN,
        z: Number.NaN,
        qx: Number.NaN,
        qy: Number.NaN,
        qz: Number.NaN,
        qw: Number.NaN,
        p0: Number.NaN,
        p5: Number.NaN,
        p10: Number.NaN,
        p14: Number.NaN,
      }),
      refractionCamera: new THREE.PerspectiveCamera(),
      refractionRT: new THREE.WebGLRenderTarget(400, 300),
      waterMaterial: makeWaterMaterialForTest(),
    } satisfies RefractionContext
  })

describe('infrastructure/renderer/world-renderer-refraction', () => {
  describe('doRefractionPrePass', () => {
    it.effect('returns early without rendering when no water meshes are registered', () =>
      Effect.gen(function* () {
        const ctx = yield* makeRefractionContext([])
        const renderer = makeRenderer()
        const scene = makeScene()
        const camera = new THREE.PerspectiveCamera()

        yield* doRefractionPrePass(ctx, renderer, scene, camera)

        expect(renderer.render).not.toHaveBeenCalled()
        expect(renderer.setRenderTarget).not.toHaveBeenCalled()
      })
    )

    it.effect('renders on cache miss, skips unchanged pose, and renders again after camera movement', () =>
      Effect.gen(function* () {
        const waterMesh = makeMockMesh({ x: 0, z: 0 }) as THREE.Mesh
        const ctx = yield* makeRefractionContext([waterMesh])
        const renderer = makeRenderer()
        const scene = makeScene()
        const camera = new THREE.PerspectiveCamera()

        yield* doRefractionPrePass(ctx, renderer, scene, camera)
        yield* doRefractionPrePass(ctx, renderer, scene, camera)
        camera.position.z = 4
        yield* doRefractionPrePass(ctx, renderer, scene, camera)

        expect(renderer.render).toHaveBeenCalledTimes(2)
      })
    )

    it.effect('syncs projection and refreshes when the source projection changes without movement', () =>
      Effect.gen(function* () {
        const waterMesh = makeMockMesh({ x: 0, z: 0 }) as THREE.Mesh
        const ctx = yield* makeRefractionContext([waterMesh])
        const renderer = makeRenderer()
        const scene = makeScene()
        const camera = new THREE.PerspectiveCamera()
        camera.fov = 60
        camera.aspect = 1.5
        camera.near = 0.25
        camera.far = 512
        camera.zoom = 1.25
        camera.projectionMatrix.elements[10] = -1

        yield* doRefractionPrePass(ctx, renderer, scene, camera)
        yield* doRefractionPrePass(ctx, renderer, scene, camera)

        camera.far = 1024
        camera.projectionMatrix.elements[10] = -2
        yield* doRefractionPrePass(ctx, renderer, scene, camera)

        expect(ctx.refractionCamera.fov).toBe(60)
        expect(ctx.refractionCamera.aspect).toBe(1.5)
        expect(ctx.refractionCamera.near).toBe(0.25)
        expect(ctx.refractionCamera.far).toBe(1024)
        expect(ctx.refractionCamera.zoom).toBe(1.25)
        expect(ctx.refractionCamera.updateProjectionMatrix).toHaveBeenCalledTimes(2)
        expect(renderer.render).toHaveBeenCalledTimes(2)
      })
    )

    it.effect('restores water visibility and shadow map state after rendering', () =>
      Effect.gen(function* () {
        const hiddenWater = makeMockMesh({ x: 0, z: 0 }) as THREE.Mesh
        const visibleWater = makeMockMesh({ x: 1, z: 0 }) as THREE.Mesh
        hiddenWater.visible = false
        visibleWater.visible = true

        const ctx = yield* makeRefractionContext([hiddenWater, visibleWater])
        const renderer = makeRenderer()
        renderer.shadowMap.autoUpdate = false
        const scene = makeScene()
        const camera = new THREE.PerspectiveCamera()

        yield* doRefractionPrePass(ctx, renderer, scene, camera)

        expect(hiddenWater.visible).toBe(false)
        expect(visibleWater.visible).toBe(true)
        expect(renderer.shadowMap.autoUpdate).toBe(false)
        expect(renderer.shadowMap.needsUpdate).toBe(false)
        expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null)
      })
    )
  })

  describe('helper functions', () => {
    it.effect('updates water uniforms, validity, resolution, and resize collaborators', () =>
      Effect.gen(function* () {
        const waterMaterial = makeWaterMaterialForTest()
        const refractionRT = new THREE.WebGLRenderTarget(400, 300)
        const refractionCamera = new THREE.PerspectiveCamera()
        const cameraPosition = new THREE.Vector3()
        const updateProjectionMatrix = vi.mocked(refractionCamera.updateProjectionMatrix)
        const initialProjectionUpdates = updateProjectionMatrix.mock.calls.length

        yield* updateWaterUniforms(waterMaterial, 12.5, cameraPosition)
        yield* setRefractionValid(waterMaterial, true)
        yield* updateWaterResolution(waterMaterial, 320, 180)
        yield* resizeRefractionRT(refractionRT, 512, 256)
        yield* resizeRefractionCamera(refractionCamera, 1.75)

        expect(waterMaterial.uniforms.uTime.value).toBe(12.5)
        expect(waterMaterial.uniforms.uCameraPosition.value.copy).toHaveBeenCalledWith(cameraPosition)
        expect(waterMaterial.uniforms.uRefractionValid.value).toBe(true)
        expect(waterMaterial.uniforms.uResolution.value.set).toHaveBeenCalledWith(320, 180)
        expect(refractionRT.setSize).toHaveBeenCalledWith(512, 256)
        expect(refractionCamera.aspect).toBe(1.75)
        expect(updateProjectionMatrix).toHaveBeenCalledTimes(initialProjectionUpdates + 1)
      })
    )

    it.effect('returns the cached water mesh array on hit and a new reference on miss', () =>
      Effect.gen(function* () {
        const firstMesh = makeMockMesh({ x: 0, z: 0 }) as THREE.Mesh
        const secondMesh = makeMockMesh({ x: 1, z: 0 }) as THREE.Mesh
        const waterMeshesRef = yield* Ref.make<ReadonlyArray<THREE.Mesh>>([firstMesh])
        const cache = MutableRef.make<ReadonlyArray<THREE.Mesh>>([])

        const firstRead = yield* getWaterMeshes(waterMeshesRef, cache)
        const secondRead = yield* getWaterMeshes(waterMeshesRef, cache)
        yield* Ref.set(waterMeshesRef, [firstMesh, secondMesh])
        const thirdRead = yield* getWaterMeshes(waterMeshesRef, cache)

        expect(secondRead).toBe(firstRead)
        expect(thirdRead).not.toBe(firstRead)
        expect(thirdRead).toHaveLength(2)
      })
    )
  })

  describe('WorldRendererService delegation', () => {
    it.effect('routes helper/getter calls through the service without changing test-only APIs', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      const renderer = makeRenderer()

      return Effect.gen(function* () {
        const s = yield* WorldRendererService
        const rtConstructor = vi.mocked(THREE.WebGLRenderTarget)
        const cameraConstructor = vi.mocked(THREE.PerspectiveCamera)
        const refractionRT = rtConstructor.mock.results[0]?.value
        const refractionCamera = cameraConstructor.mock.results[0]?.value
        const initialProjectionUpdates = refractionCamera?.updateProjectionMatrix.mock.calls.length ?? 0

        yield* s.doRefractionPrePass(renderer, scene, new THREE.PerspectiveCamera())
        yield* s.updateWaterUniforms(1.5, new THREE.Vector3())
        yield* s.setRefractionValid(true)
        yield* s.updateWaterResolution(640, 360)
        yield* s.resizeRefractionRT(256, 144)
        yield* s.resizeRefractionCamera(1.6)
        const waterMeshes = yield* s.getWaterMeshes()

        expect(Array.isArray(waterMeshes)).toBe(true)
        expect(refractionRT?.setSize).toHaveBeenCalledWith(256, 144)
        expect(refractionCamera?.aspect).toBe(1.6)
        expect(refractionCamera?.updateProjectionMatrix).toHaveBeenCalledTimes(initialProjectionUpdates + 1)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
