/**
 * Constraint Enforcer Service - 制約強制ドメインサービス
 */

import { Effect, Context, Schema } from 'effect'
import type { GenerationError } from '../../types/errors/generation-errors.js'

export interface ConstraintEnforcerService {
  readonly enforceConstraints: (data: any) => Effect.Effect<any, GenerationError>
}

export const ConstraintEnforcerService = Context.GenericTag<ConstraintEnforcerService>(
  '@minecraft/domain/world/ConstraintEnforcer'
)

export const makeConstraintEnforcerService = (): ConstraintEnforcerService => ({
  enforceConstraints: (data) => Effect.succeed(data),
})
