import { Effect, Layer, Ref } from 'effect'
import { describe, it, expect, vi } from 'vitest'
import * as main from '@/main'
import * as World from '@/domain/world'
import {
  ChunkDataQueue,
  DeltaTime,
  GameState,
  InputManagerService,
  OnCommand,
  RenderQueue,
  RendererService,
  SpatialGridService,
  ThreeContextService,
} from '@/runtime/services'
import { MaterialManager } from '@/infrastructure/material-manager'
import { ThreeCameraService } from '@/infrastructure/camera-three'
import { ComputationWorker } from '@/infrastructure/computation.worker'
import { RaycastService } from '@/infrastructure/raycast-three'
import { Hotbar } from '@/domain/components'
import { ChunkGenerationResult } from '@/domain/types'
import { SpatialGridState } from '@/infrastructure/spatial-grid'
import * as THREE from 'three'
import { ThreeCamera, ThreeContext } from '@/infrastructure/types'
import Stats from 'three/examples/jsm/libs/stats.module.js'

vi.mock('@/runtime/loop', () => ({
  gameLoop: () => Effect.void,
}))

const MockRendererLive = Layer.succeed(RendererService, {
  processRenderQueue: Effect.void,
  syncCameraToWorld: Effect.void,
  updateHighlight: Effect.void,
  updateInstancedMeshes: Effect.void,
  renderScene: Effect.void,
})

const MockInputManagerLive = Layer.succeed(InputManagerService, {
  getState: Effect.succeed({ keyboard: new Set<string>(), mouse: { dx: 0, dy: 0 }, isLocked: false }),
  getMouseDelta: Effect.succeed({ dx: 0, dy: 0 }),
  registerListeners: () => Effect.void,
})

const MockThreeCameraLive = Layer.succeed(
  ThreeCameraService,
  {
    camera: {
      camera: new THREE.PerspectiveCamera(),
      controls: {
        getObject: () => new THREE.Object3D(),
      },
    } as unknown as ThreeCamera,
    syncToComponent: () => Effect.void,
    moveRight: () => Effect.void,
    rotatePitch: () => Effect.void,
    rotateYaw: () => Effect.void,
    getYaw: Effect.succeed(0),
    getPitch: Effect.succeed(0),
    handleResize: () => Effect.void,
    lock: Effect.void,
    unlock: Effect.void,
  },
)

const MockComputationWorkerLive = Layer.succeed(ComputationWorker, {
  postTask: (): Effect.Effect<ChunkGenerationResult> => Effect.succeed({} as any),
})

const MockMaterialManagerLive = Layer.succeed(MaterialManager, {
  get: () => Effect.succeed(new THREE.Material()),
  dispose: () => Effect.void,
})

const MockRaycastServiceLive = Layer.succeed(RaycastService, {
  cast: () => Effect.succeed(null) as any,
})

const MockSpatialGridLive = Layer.succeed(
  SpatialGridService,
  {
    state: Ref.unsafeMake({} as SpatialGridState),
    clear: Effect.void,
    register: () => Effect.void,
    query: () => Effect.succeed([]),
  },
)

const MockThreeContextLive = Layer.succeed(
  ThreeContextService,
  {
    scene: new THREE.Scene(),
    camera: {
      camera: new THREE.PerspectiveCamera(),
      controls: {
        getObject: () => new THREE.Object3D(),
      },
    } as unknown as ThreeCamera,
    renderer: {
      domElement: document.createElement('canvas'),
    } as any,
    highlightMesh: new THREE.Mesh(),
    stats: new Stats(),
    chunkMeshes: new Map(),
    instancedMeshes: new Map(),
  } as ThreeContext,
)

const MockOnCommandLive = Layer.succeed(OnCommand, () => Effect.void)

const MockGameStateLive = Layer.succeed(
  GameState,
  {
    getHotbar: Effect.succeed(new Hotbar({ slots: [], selectedIndex: 0 })),
  },
)

const MockDeltaTimeLive = Layer.succeed(DeltaTime, 0)
const MockChunkDataQueueLive = Layer.succeed(ChunkDataQueue, [])
const MockRenderQueueLive = Layer.succeed(RenderQueue, [])

describe('main', () => {
  it('should create a runnable bootstrap effect that completes without errors', async () => {
    const appElement = document.createElement('div')
    appElement.id = 'app'
    document.body.appendChild(appElement)

    const TestLayer = Layer.mergeAll(
      World.worldLayer,
      MockRendererLive,
      MockInputManagerLive,
      MockThreeCameraLive,
      MockComputationWorkerLive,
      MockMaterialManagerLive,
      MockRaycastServiceLive,
      MockSpatialGridLive,
      MockThreeContextLive,
      MockOnCommandLive,
      MockGameStateLive,
      MockDeltaTimeLive,
      MockChunkDataQueueLive,
      MockRenderQueueLive,
    )

    const runnable = main.bootstrap.pipe(Effect.provide(TestLayer))

    await expect(Effect.runPromise(runnable)).resolves.toBeUndefined()
  })

  it('should log an error if the root element is not found', async () => {
    const logErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    document.body.innerHTML = ''

    const TestLayer = Layer.mergeAll(
      World.worldLayer,
      MockRendererLive,
      MockInputManagerLive,
      MockThreeCameraLive,
      MockComputationWorkerLive,
      MockMaterialManagerLive,
      MockRaycastServiceLive,
      MockSpatialGridLive,
      MockThreeContextLive,
      MockOnCommandLive,
      MockGameStateLive,
      MockDeltaTimeLive,
      MockChunkDataQueueLive,
      MockRenderQueueLive,
    )

    const runnable = main.bootstrap.pipe(Effect.provide(TestLayer))
    await Effect.runPromise(runnable)

    expect(logErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Root element not found'))
    logErrorSpy.mockRestore()
  })
})
