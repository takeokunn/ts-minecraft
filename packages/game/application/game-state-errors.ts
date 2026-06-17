import { Effect } from 'effect'
import { PlayerError } from '@ts-minecraft/entity/domain/errors'
import { GameStateError } from '../domain/errors'
import { PhysicsServiceError } from './physics-service-error'

const PHYSICS_NOT_INITIALIZED = 'Physics not initialized. Call initialize() first.'

const failGameStateError = (operation: string, reason: string, cause?: unknown): Effect.Effect<never, GameStateError> =>
  Effect.fail(new GameStateError({ operation, reason, cause }))

export const failMissingPhysicsBody = (operation: string): Effect.Effect<never, GameStateError> =>
  failGameStateError(operation, PHYSICS_NOT_INITIALIZED)

export const mapPhysicsServiceError = (operation: string) => (error: PhysicsServiceError): Effect.Effect<never, GameStateError> =>
  failGameStateError(operation, error.operation, error)

export const mapPlayerError = (operation: string) => (error: PlayerError): Effect.Effect<never, GameStateError> =>
  failGameStateError(operation, error.reason, error)
