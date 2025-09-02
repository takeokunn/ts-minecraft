import { Effect, Layer, Option, Ref } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { RendererLive } from '..'
import {
  MaterialManager,
  RenderQueueService,
  ThreeContextService,
  type Renderer,
  RendererService,
} from '@/runtime/services'
import { World } from '@/runtime/world'
import { ThreeCameraService } from '../../camera-three'
import type { ThreeContext } from '../../types'
import { Position, CameraState } from '@/domain/components'
import { type EntityId } from '@/domain/entity'
import type { RaycastResult } from '../../raycast-three'
import { RaycastResultService } from '@/runtime/services'

// Mocks
const mockWorld = {
  querySoA: vi.fn(),
  getComponent: vi.fn(),
}
const mockCameraService = {
  syncToComponent: vi.fn(() => Effect.void),
}
const mockMaterialManager = {
  get: vi.fn(() => Effect.succeed(new THREE.Material())),
  dispose: vi.fn(() => Effect.void),
}
const mockContext: ThreeContext = {
  scene: { add: vi.fn(), remove: vi.fn() },
  chunkMeshes: new Map(),
  highlightMesh: { visible: true, position: { set: vi.fn() } },
  stats: { begin: vi.fn(), end: vi.fn() },
  renderer: { render: vi.fn() },
  camera: {} as any,
  instancedMeshes: new Map(),
} as any

describe('RendererLive', () => {
  let renderQueue: any[]
  let raycastResultRef: Ref.Ref<Option.Option<RaycastResult>>
  let TestLayer: Layer.Layer<Renderer, never, never>

  beforeEach(async () => {
    vi.clearAllMocks()
    renderQueue = []
    raycastResultRef = await Effect.runPromise(Ref.make(Option.none()))

    TestLayer = Layer.provide(
      RendererLive,
      Layer.mergeAll(
        Layer.succeed(World, mockWorld as any),
        Layer.succeed(ThreeCameraService, mockCameraService as any),
        Layer.succeed(RaycastResultService, raycastResultRef),
        Layer.succeed(ThreeContextService, mockContext),
        Layer.succeed(MaterialManager, mockMaterialManager as any),
        Layer.succeed(RenderQueueService, renderQueue),
      ),
    )
  })

  const run = <A, E>(program: Effect.Effect<A, E, Renderer>) => {
    return Effect.runPromise(Effect.provide(program, TestLayer))
  }

  it('processRenderQueue should handle UpsertChunk', async () => {
    renderQueue.push({
      type: 'UpsertChunk',
      chunkX: 0,
      chunkZ: 0,
      mesh: { positions: new Float32Array(), normals: new Float32Array(), uvs: new Float32Array(), indices: new Uint32Array() },
    })

    const program = Effect.gen(function* (_) {
      const renderer = yield* _(RendererService)
      yield* _(renderer.processRenderQueue)
      expect(mockMaterialManager.get).toHaveBeenCalledWith('atlas.png')
      expect(mockContext.scene.add).toHaveBeenCalled()
    })

    await run(program)
  })

  it('processRenderQueue should handle RemoveChunk', async () => {
    const mesh = new THREE.Mesh()
    mesh.geometry.dispose = vi.fn()
    mockContext.chunkMeshes.set('0,0', mesh)
    renderQueue.push({ type: 'RemoveChunk', chunkX: 0, chunkZ: 0 })

    const program = Effect.gen(function* (_) {
      const renderer = yield* _(RendererService)
      yield* _(renderer.processRenderQueue)
      expect(mockContext.scene.remove).toHaveBeenCalledWith(mesh)
      expect(mesh.geometry.dispose).toHaveBeenCalled()
      expect(mockContext.chunkMeshes.has('0,0')).toBe(false)
    })

    await run(program)
  })

  describe('syncCameraToWorld', () => {
    it('should sync camera from world state', async () => {
      mockWorld.querySoA.mockReturnValue(
        Effect.succeed({
          entities: [1 as EntityId],
          position: { x: [1], y: [2], z: [3] },
          cameraState: { pitch: [0.1], yaw: [0.2] },
        }),
      )

      const program = Effect.gen(function* (_) {
        const renderer = yield* _(RendererService)
        yield* _(renderer.syncCameraToWorld)
        expect(mockCameraService.syncToComponent).toHaveBeenCalledWith(new Position({ x: 1, y: 2, z: 3 }), new CameraState({ pitch: 0.1, yaw: 0.2 }))
      })

      await run(program)
    })

    it('should not sync if player data is incomplete', async () => {
      mockWorld.querySoA.mockReturnValue(
        Effect.succeed({
          entities: [1 as EntityId],
          position: { x: [1], y: [2], z: [undefined] }, // Incomplete data
          cameraState: { pitch: [0.1], yaw: [0.2] },
        }),
      )

      const program = Effect.gen(function* (_) {
        const renderer = yield* _(RendererService)
        yield* _(renderer.syncCameraToWorld)
        expect(mockCameraService.syncToComponent).not.toHaveBeenCalled()
      })

      await run(program)
    })
  })

  it('updateHighlight should show highlight on raycast hit', async () => {
    const entityId = 1 as EntityId
    const position = new Position({ x: 10, y: 20, z: 30 })
    await Effect.runPromise(Ref.set(raycastResultRef, Option.some({ entityId } as any)))
    mockWorld.getComponent.mockReturnValue(Effect.succeed(Option.some(position)))

    const program = Effect.gen(function* (_) {
      const renderer = yield* _(RendererService)
      yield* _(renderer.updateHighlight)
      expect(mockContext.highlightMesh.visible).toBe(true)
      expect(mockContext.highlightMesh.position.set).toHaveBeenCalledWith(10.5, 20.5, 30.5)
    })

    await run(program)
  })

  it('updateHighlight should hide highlight on no raycast hit', async () => {
    await Effect.runPromise(Ref.set(raycastResultRef, Option.none()))

    const program = Effect.gen(function* (_) {
      const renderer = yield* _(RendererService)
      yield* _(renderer.updateHighlight)
      expect(mockContext.highlightMesh.visible).toBe(false)
    })

    await run(program)
  })

  it('renderScene should call renderer', async () => {
    const program = Effect.gen(function* (_) {
      const renderer = yield* _(RendererService)
      yield* _(renderer.renderScene)
      expect(mockContext.stats.begin).toHaveBeenCalled()
      expect(mockContext.renderer.render).toHaveBeenCalledWith(mockContext.scene, mockContext.camera.camera)
      expect(mockContext.stats.end).toHaveBeenCalled()
    })

    await run(program)
  })
})