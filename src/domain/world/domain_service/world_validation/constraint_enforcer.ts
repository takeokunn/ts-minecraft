/**
 * Constraint Enforcer Service - 制約強制ドメインサービス
 */

import type { GenerationError } from '@domain/world/types/errors'
import { Context, Effect, Layer } from 'effect'

export interface ConstraintEnforcerService {
  readonly enforceConstraints: <A>(data: A) => Effect.Effect<A, GenerationError>
}

export const ConstraintEnforcerService = Context.GenericTag<ConstraintEnforcerService>(
  '@minecraft/domain/world/ConstraintEnforcer'
)

export const ConstraintEnforcerServiceLive = Layer.effect(
  ConstraintEnforcerService,
  Effect.succeed({
    enforceConstraints: <A>(data: A) => Effect.succeed(data),
  })
)
