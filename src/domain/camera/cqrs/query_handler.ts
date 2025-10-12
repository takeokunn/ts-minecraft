import { Context, Effect, Layer, Match, Option } from 'effect'

import type { Camera } from '../aggregate/camera/camera'
import {
  CameraStateRepository,
  type CameraStateRepository as CameraStateRepositoryService,
  type RepositoryError,
} from '../repository/camera_state'
import type { CameraId, CameraQuery, CameraSnapshot } from '../types'
import { createCameraError, type CameraError } from '../types'
import { cameraToSnapshot } from './helpers'
import { CameraReadModel } from './read_model'

export type CameraQueryHandlerError = CameraError | RepositoryError

export type CameraQueryResult =
  | { readonly _tag: 'Snapshot'; readonly snapshot: CameraSnapshot }
  | { readonly _tag: 'State'; readonly camera: Camera }
  | { readonly _tag: 'ActiveCameras'; readonly cameraIds: ReadonlyArray<CameraId> }

export interface CameraQueryHandler {
  readonly execute: (query: CameraQuery) => Effect.Effect<CameraQueryResult, CameraQueryHandlerError>
}

export const CameraQueryHandler = Context.GenericTag<CameraQueryHandler>('@minecraft/domain/camera/CQRS/QueryHandler')

const ensureCameraExists = (
  repository: CameraStateRepositoryService,
  cameraId: CameraId
): Effect.Effect<Camera, CameraQueryHandlerError> =>
  repository.findById(cameraId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(createCameraError.invalidParameter('cameraId', cameraId, '既存のCamera ID')),
        onSome: Effect.succeed,
      })
    )
  )

const handleGetSnapshot = (
  repository: CameraStateRepositoryService,
  readModel: CameraReadModel,
  cameraId: CameraId
): Effect.Effect<CameraQueryResult, CameraQueryHandlerError> =>
  Effect.gen(function* () {
    const cached = yield* readModel.getSnapshot(cameraId)
    return yield* Option.match(cached, {
      onNone: () =>
        Effect.gen(function* () {
          const camera = yield* ensureCameraExists(repository, cameraId)
          yield* readModel.upsert(camera)
          return { _tag: 'Snapshot', snapshot: cameraToSnapshot(camera) } as const
        }),
      onSome: (snapshot) => Effect.succeed({ _tag: 'Snapshot', snapshot } as const),
    })
  })

const handleGetState = (
  repository: CameraStateRepositoryService,
  cameraId: CameraId
): Effect.Effect<CameraQueryResult, CameraQueryHandlerError> =>
  Effect.gen(function* () {
    const camera = yield* ensureCameraExists(repository, cameraId)
    return { _tag: 'State', camera }
  })

const handleListActive = (
  repository: CameraStateRepositoryService
): Effect.Effect<CameraQueryResult, CameraQueryHandlerError> =>
  repository.listActive().pipe(Effect.map((cameraIds) => ({ _tag: 'ActiveCameras', cameraIds }) as const))

const executeQuery = (
  repository: CameraStateRepositoryService,
  readModel: CameraReadModel,
  query: CameraQuery
): Effect.Effect<CameraQueryResult, CameraQueryHandlerError> =>
  Match.value(query).pipe(
    Match.tag('GetCameraSnapshot', (q) => handleGetSnapshot(repository, readModel, q.cameraId)),
    Match.tag('GetCameraState', (q) => handleGetState(repository, q.cameraId)),
    Match.tag('ListActiveCameras', () => handleListActive(repository)),
    Match.exhaustive
  )

export const CameraQueryHandlerLive = Layer.effect(
  CameraQueryHandler,
  Effect.gen(function* () {
    const repository = yield* CameraStateRepository
    const readModel = yield* CameraReadModel

    return CameraQueryHandler.of({
      execute: (query) => executeQuery(repository, readModel, query),
    })
  })
)
