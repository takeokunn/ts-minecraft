import { Layer, Ref, Effect, Option, HashMap } from 'effect'
import { ThreeCameraService } from '@/infrastructure/camera-three'
import { RaycastService } from '@/infrastructure/raycast-three'
import { ThreeContext, ThreeContextService } from '@/infrastructure/types'
import { WorldContext } from '@/runtime/context'
import { createInitialWorld, World as WorldState } from '@/domain/world'
import { Scene, PerspectiveCamera, WebGLRenderer, Mesh, Material } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import {
  ChunkDataQueue,
  DeltaTime,
  GameState,
  OnCommand,
  RaycastResultService,
  RenderQueue,
  SpatialGridService,
  InputManagerService,
} from '@/runtime/services'
import { ComputationWorker } from '@/infrastructure/computation.worker'
import { MaterialManager } from '@/infrastructure/material-manager'
import { Hotbar } from '@/domain/components'
import { SpatialGrid, SpatialGridState } from '@/infrastructure/spatial-grid'

export type TestLayerContext =
  | WorldContext
  | RaycastService
  | ThreeCameraService
  | ThreeContextService
  | ComputationWorker
  | InputManagerService
  | MaterialManager
  | SpatialGridService
  | RaycastResultService
  | ChunkDataQueue
  | RenderQueue
  | OnCommand
  | GameState
  | DeltaTime

export const provideTestLayer = (
  initialState?: WorldState,
  mockOverrides?: {
    raycast?: Partial<RaycastService>
    camera?: Partial<ThreeCameraService>
    context?: Partial<ThreeContext>
    computationWorker?: Partial<ComputationWorker>
    inputManager?: Partial<InputManagerService>
    materialManager?: Partial<MaterialManager>
    spatialGrid?: Partial<SpatialGrid>
  },
): Layer.Layer<TestLayerContext, never, never> => {
  const canvas = document.createElement('canvas')
  const camera = new PerspectiveCamera()
  const controls = new PointerLockControls(camera, canvas)

  const worldLayer = Layer.effect(
    WorldContext,
    Ref.make(initialState ?? createInitialWorld()).pipe(Effect.map((ref) => ({ world: ref }))),
  )

  const mocksLayer = Layer.mergeAll(
    Layer.succeed(
      RaycastService,
      RaycastService.of({
        cast: () => Effect.succeed(Option.none()),
        ...mockOverrides?.raycast,
      }),
    ),
    Layer.succeed(
      ThreeCameraService,
      ThreeCameraService.of({
        camera: { camera, controls },
        syncToComponent: () => Effect.void,
        moveRight: () => Effect.void,
        rotatePitch: () => Effect.void,
        rotateYaw: () => Effect.void,
        getYaw: Effect.succeed(0),
        getPitch: Effect.succeed(0),
        handleResize: () => Effect.void,
        lock: Effect.void,
        unlock: Effect.void,
        ...mockOverrides?.camera,
      }),
    ),
    Layer.succeed(
      ThreeContextService,
      ThreeContextService.of({
        scene: new Scene(),
        camera: { camera, controls },
        renderer: {
          domElement: document.createElement('canvas'),
          setSize: () => {},
          render: () => {},
        } as unknown as WebGLRenderer,
        highlightMesh: new Mesh(),
        stats: { dom: document.createElement('div'), update: () => {} } as unknown as Stats,
        chunkMeshes: new Map(),
        instancedMeshes: new Map(),
        ...mockOverrides?.context,
      }),
    ),
    Layer.succeed(
      ComputationWorker,
      ComputationWorker.of({
        postTask: () => Effect.die('ComputationWorker.postTask not implemented'),
        ...mockOverrides?.computationWorker,
      }),
    ),
    Layer.succeed(
      InputManagerService,
      InputManagerService.of({
        getState: Effect.succeed({ keyboard: new Set(), mouse: { dx: 0, dy: 0 }, isLocked: false }),
        getMouseDelta: Effect.succeed({ dx: 0, dy: 0 }),
        registerListeners: () => Effect.void,
        cleanup: () => Effect.void,
        ...mockOverrides?.inputManager,
      }),
    ),
    Layer.succeed(
      MaterialManager,
      MaterialManager.of({
        get: () => Effect.succeed(new Material()),
        dispose: () => Effect.void,
        ...mockOverrides?.materialManager,
      }),
    ),
    Layer.succeed(
      SpatialGridService,
      SpatialGridService.of({
        state: Ref.unsafeMake<SpatialGridState>(HashMap.empty()),
        clear: Effect.void,
        register: () => Effect.void,
        query: () => Effect.succeed([]),
        ...mockOverrides?.spatialGrid,
      }),
    ),
    Layer.effect(RaycastResultService, Ref.make(Option.none())),
    Layer.succeed(ChunkDataQueue, []),
    Layer.succeed(RenderQueue, []),
    Layer.succeed(OnCommand, () => Effect.void),
    Layer.succeed(
      GameState,
      GameState.of({
        getHotbar: Effect.succeed(new Hotbar({ slots: [], selectedIndex: 0 })),
      }),
    ),
    Layer.succeed(DeltaTime, 0),
  )

  return Layer.merge(worldLayer, mocksLayer)
}
