/**
 * Generation Validator Service - 生成検証ドメインサービス
 */

import { Effect, Context, Schema } from 'effect'
import type { GenerationError } from '../../types/errors/generation-errors.js'

export interface GenerationValidatorService {
  readonly validateGeneration: (data: any) => Effect.Effect<boolean, GenerationError>
}

export const GenerationValidatorService = Context.GenericTag<GenerationValidatorService>(
  '@minecraft/domain/world/GenerationValidator'
)

export const makeGenerationValidatorService = (): GenerationValidatorService => ({
  validateGeneration: (data) => Effect.succeed(true),
})
