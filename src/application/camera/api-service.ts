import { Context, Effect, Layer } from 'effect'

import type { CameraCommand, CameraQuery, CameraSnapshot } from '@/domain/camera/types'
import {
  CameraCommandHandler,
  CameraCommandHandlerLive,
  type CameraCommandHandlerError,
  CameraQueryHandler,
  CameraQueryHandlerLive,
  type CameraQueryHandlerError,
  type CameraQueryResult,
} from '@/domain/camera/cqrs'

export type CameraAPIError = CameraCommandHandlerError | CameraQueryHandlerError

export interface CameraAPIService {
  readonly executeCommand: (command: CameraCommand) => Effect.Effect<CameraSnapshot, CameraAPIError>
  readonly executeQuery: (query: CameraQuery) => Effect.Effect<CameraQueryResult, CameraAPIError>
}

export const CameraAPIService = Context.GenericTag<CameraAPIService>('@minecraft/application/camera/APIService')

const CameraAPIServiceLayer = Layer.effect(
  CameraAPIService,
  Effect.gen(function* () {
    const commandHandler = yield* CameraCommandHandler
    const queryHandler = yield* CameraQueryHandler

    return CameraAPIService.of({
      executeCommand: (command) => commandHandler.handle(command),
      executeQuery: (query) => queryHandler.execute(query),
    })
  })
)

export const CameraAPIServiceLive = Layer.mergeAll(
  CameraCommandHandlerLive,
  CameraQueryHandlerLive,
  CameraAPIServiceLayer
)
