/**
 * Constraint Enforcer Service - 制約強制ドメインサービス
 */

import { Context, Effect, Layer } from 'effect'
import type { GenerationError } from '@domain/world/types/errors'

export interface ConstraintEnforcerService {
  readonly enforceConstraints: (data: any) => Effect.Effect<any, GenerationError>
}

export const ConstraintEnforcerService = Context.GenericTag<ConstraintEnforcerService>(
  '@minecraft/domain/world/ConstraintEnforcer'
)

export const ConstraintEnforcerServiceLive = Layer.effect(
  ConstraintEnforcerService,
  Effect.succeed({
    enforceConstraints: (data) => Effect.succeed(data),
  })
)
