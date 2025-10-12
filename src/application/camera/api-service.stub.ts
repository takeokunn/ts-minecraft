import { Camera } from '@domain/camera/aggregate/camera/camera'
import { cameraToSnapshot } from '@domain/camera/cqrs/helpers'
import type { CameraQueryResult } from '@domain/camera/cqrs'
import type { CameraCommand, CameraQuery, CameraSnapshot } from '@domain/camera/types'
import { CameraIdSchema } from '@domain/camera/types'
import { createPosition3D } from '@domain/camera/value_object/camera_position/operations'
import { createCameraRotation } from '@domain/camera/value_object/camera_rotation/operations'
import { createCameraSettings } from '@domain/camera/value_object/camera_settings/operations'
import { ViewModeFactory } from '@domain/camera/value_object/view_mode/operations'
import { CameraAPIService } from '@application/camera/api-service'
import { DateTime, Effect, Layer, Option, Ref, Schema } from 'effect'
import { CameraHUDServiceLive } from './hud-service'

const makeInitialCamera = Effect.gen(function* () {
  const cameraId = yield* Schema.decodeUnknown(CameraIdSchema)('camera-hud-primary').pipe(Effect.orDie)
  const position = yield* createPosition3D(128.5, 72.2, -48.25).pipe(Effect.orDie)
  const rotation = yield* createCameraRotation(-12, 42, 0).pipe(Effect.orDie)
  const viewMode = yield* ViewModeFactory.createFirstPerson({
    bobbing: true,
    mouseSensitivity: 1.05,
    smoothing: 0.18,
    headOffset: 0.1,
  }).pipe(Effect.orDie)
  const settings = yield* createCameraSettings(90, 1.2, 0.18, 16 / 9, 0.1, 512, 144, 20, 3).pipe(Effect.orDie)
  const lastUpdated = yield* DateTime.nowAsDate

  return Camera({
    _tag: 'Camera',
    id: cameraId,
    position,
    rotation,
    viewMode,
    settings,
    animationState: Option.none(),
    events: [],
    isEnabled: true,
    lastUpdated,
  })
})

export const CameraAPIServiceStub = Layer.effect(
  CameraAPIService,
  Effect.gen(function* () {
    const initialCamera = yield* makeInitialCamera
    const cameraRef = yield* Ref.make(initialCamera)

    const executeCommand = (_command: CameraCommand): Effect.Effect<CameraSnapshot, never> =>
      Effect.gen(function* () {
        const camera = yield* Ref.get(cameraRef)
        return cameraToSnapshot(camera)
      })

    const executeQuery = (query: CameraQuery): Effect.Effect<CameraQueryResult, never> =>
      Effect.gen(function* () {
        const camera = yield* Ref.get(cameraRef)

        switch (query._tag) {
          case 'GetCameraSnapshot':
            return {
              _tag: 'Snapshot',
              snapshot: cameraToSnapshot(camera),
            } as const
          case 'GetCameraState':
            return {
              _tag: 'State',
              camera,
            } as const
          case 'ListActiveCameras':
            return {
              _tag: 'ActiveCameras',
              cameraIds: [camera.id],
            } as const
        }
      })

    return CameraAPIService.of({
      executeCommand,
      executeQuery,
    })
  })
)

export const CameraHUDPreviewLayer = CameraHUDServiceLive.pipe(Layer.provide(CameraAPIServiceStub))
