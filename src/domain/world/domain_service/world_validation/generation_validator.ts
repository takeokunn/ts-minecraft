/**
 * Generation Validator Service - 生成検証ドメインサービス
 */

import { Context, Effect, Layer } from 'effect'
import type { GenerationError } from '../../types/errors/generation_errors.js'

export interface GenerationValidatorService {
  readonly validateGeneration: (data: any) => Effect.Effect<boolean, GenerationError>
}

export const GenerationValidatorService = Context.GenericTag<GenerationValidatorService>(
  '@minecraft/domain/world/GenerationValidator'
)

export const GenerationValidatorServiceLive = Layer.effect(
  GenerationValidatorService,
  Effect.succeed({
    validateGeneration: (data) => Effect.succeed(true),
  })
)
