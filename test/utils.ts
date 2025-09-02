import { Layer, Ref, Effect, Option } from 'effect'
import { ThreeCameraService } from '@/infrastructure/camera-three'
import { RaycastService } from '@/infrastructure/raycast-three'
import { ThreeContext, ThreeContextService } from '@/infrastructure/types'
import { WorldContext } from '@/runtime/context'
import { createInitialWorld, World as WorldState } from '@/runtime/world-pure'
import { mock } from 'vitest-mock-extended'
import { Scene } from 'three'
import {
  ChunkDataQueueService,
  DeltaTime,
  GameStateService,
  OnCommand,
  RaycastResultService,
  RenderQueueService,
} from '@/runtime/services'
import { ComputationWorkerTag } from '@/infrastructure/computation.worker'
import { InputManager } from '@/infrastructure/input-browser'
import { MaterialManager } from '@/infrastructure/material-manager'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import { Hotbar } from '@/domain/components'

export const provideTestLayer = (
  initialState?: WorldState,
  mockOverrides?: {
    raycast?: RaycastService
    camera?: ThreeCameraService
    context?: ThreeContext
  },
) => {
  const raycastMock = mockOverrides?.raycast ?? mock<RaycastService>()
  const cameraMock = mockOverrides?.camera ?? mock<ThreeCameraService>()
  const contextMock =
    mockOverrides?.context ??
    ({
      ...mock<ThreeContext>(),
      scene: new Scene(),
    } as ThreeContext)

  const worldLayer = Layer.effect(
    WorldContext,
    Ref.make(initialState ?? createInitialWorld()).pipe(Effect.map((ref) => ({ world: ref }))),
  )

  const mocksLayer = Layer.mergeAll(
    Layer.succeed(RaycastService, raycastMock),
    Layer.succeed(ThreeCameraService, cameraMock),
    Layer.succeed(ThreeContextService, contextMock),
    Layer.succeed(ComputationWorkerTag, mock()),
    Layer.succeed(InputManager, mock()),
    Layer.succeed(MaterialManager, mock()),
    Layer.succeed(SpatialGrid, mock()),
    Layer.effect(RaycastResultService, Ref.make(Option.none())),
    Layer.succeed(ChunkDataQueueService, []),
    Layer.succeed(RenderQueueService, []),
    Layer.succeed(OnCommand, () => Effect.void),
    Layer.succeed(GameStateService, { hotbar: new Hotbar({ slots: [], selectedIndex: 0 }) }),
    Layer.succeed(DeltaTime, 0),
  )

  return Layer.provide(worldLayer, mocksLayer)
}
  
