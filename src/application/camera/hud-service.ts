import type { Camera } from '@/domain/camera/aggregate/camera/camera'
import type { CameraId, CameraQueryResult, GetCameraStateQuery } from '@/domain/camera/types'
import { CameraAPIService, type CameraAPIError } from '@application/camera/api-service'
import { ErrorCauseSchema, toErrorCause } from '@shared/schema/error'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Clock, Context, Effect, Layer, Match, Schema } from 'effect'

export interface CameraHUDViewModel {
  readonly cameraId: CameraId
  readonly mode: string
  readonly isEnabled: boolean
  readonly position: {
    readonly x: number
    readonly y: number
    readonly z: number
  }
  readonly rotation: {
    readonly pitch: number
    readonly yaw: number
    readonly roll: number
  }
  readonly projection: {
    readonly fov: number
    readonly aspectRatio: number
    readonly near: number
    readonly far: number
  }
  readonly sensitivity: number
  readonly smoothing: number
  readonly renderDistance: number
  readonly frameRate: number
}

const CameraHUDServiceErrorSchema = Schema.TaggedError('CameraHUDServiceError', {
  cause: ErrorCauseSchema,
})

export type CameraHUDServiceError = Schema.Schema.Type<typeof CameraHUDServiceErrorSchema>

export const CameraHUDServiceError = makeErrorFactory(CameraHUDServiceErrorSchema)

export interface CameraHUDService {
  readonly getStatus: (cameraId: CameraId) => Effect.Effect<CameraHUDViewModel, CameraHUDServiceError>
}

export const CameraHUDService = Context.GenericTag<CameraHUDService>('@minecraft/application/camera/CameraHUDService')

const REQUESTER_ID = 'presentation/hud/camera-status'

const toNumber = (value: number): number => value

const describeViewMode = (viewMode: Camera['viewMode']): string =>
  Match.value(viewMode).pipe(
    Match.tag('FirstPerson', () => '一人称視点'),
    Match.tag('ThirdPerson', () => '三人称視点'),
    Match.tag('Spectator', () => 'スペクテイターモード'),
    Match.tag('Cinematic', () => 'シネマティックモード'),
    Match.exhaustive
  )

const toViewModel = (camera: Camera): CameraHUDViewModel => ({
  cameraId: camera.id,
  mode: describeViewMode(camera.viewMode),
  isEnabled: camera.isEnabled,
  position: {
    x: toNumber(camera.position.x),
    y: toNumber(camera.position.y),
    z: toNumber(camera.position.z),
  },
  rotation: {
    pitch: toNumber(camera.rotation.pitch),
    yaw: toNumber(camera.rotation.yaw),
    roll: toNumber(camera.rotation.roll),
  },
  projection: {
    fov: toNumber(camera.settings.fov),
    aspectRatio: toNumber(camera.settings.aspectRatio),
    near: toNumber(camera.settings.nearPlane),
    far: toNumber(camera.settings.farPlane),
  },
  sensitivity: toNumber(camera.settings.sensitivity),
  smoothing: toNumber(camera.settings.smoothing),
  renderDistance: toNumber(camera.settings.renderDistance),
  frameRate: toNumber(camera.settings.frameRate),
})

const queryIdEffect = Effect.sync(() =>
  typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
)

const createGetStateQuery = (cameraId: CameraId): Effect.Effect<GetCameraStateQuery> =>
  Effect.gen(function* () {
    const queryId = yield* queryIdEffect
    const requestedAt = yield* Clock.currentTimeMillis
    return {
      _tag: 'GetCameraState',
      cameraId,
      queryId,
      requesterId: REQUESTER_ID,
      requestedAt,
    }
  })

const ensureState = (result: CameraQueryResult): Effect.Effect<Camera, CameraHUDServiceError> =>
  Match.value(result).pipe(
    Match.tag('State', ({ camera }) => Effect.succeed(camera)),
    Match.orElse(() =>
      Effect.fail(
        CameraHUDServiceError({
          cause: { message: 'カメラ状態を取得できませんでした' },
        })
      )
    )
  )

const fromApiError = (error: CameraAPIError): CameraHUDServiceError =>
  CameraHUDServiceError({
    cause: toErrorCause(error) ?? { message: 'Camera API error' },
  })

export const CameraHUDServiceLive = Layer.effect(
  CameraHUDService,
  Effect.gen(function* () {
    const api = yield* CameraAPIService

    const getStatus: CameraHUDService['getStatus'] = (cameraId) =>
      Effect.gen(function* () {
        const query = yield* createGetStateQuery(cameraId)
        const result = yield* api.executeQuery(query).pipe(Effect.mapError(fromApiError))
        const camera = yield* ensureState(result)
        return toViewModel(camera)
      })

    return CameraHUDService.of({
      getStatus,
    })
  })
)
