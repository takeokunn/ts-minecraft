import type * as WorldTypes from '@domain/world/types/core'
import type * as GenerationErrors from '@domain/world/types/errors'
import { Context, Effect, Schema } from 'effect'
import {
  type GenerateChunkCommand,
  type GenerationContext,
  type WorldGenerator,
  WorldGeneratorSchema,
} from '../aggregate/world_generator'

export type WorldGeneratorEncoded = Schema.Schema.Encoded<typeof WorldGeneratorSchema>

export interface WorldGenerationAdapterService {
  readonly generateChunkData: (
    context: GenerationContext,
    command: GenerateChunkCommand
  ) => Effect.Effect<WorldTypes.ChunkData, GenerationErrors.GenerationError>

  readonly encodeWorldGenerator: (generator: WorldGenerator) => Effect.Effect<WorldGeneratorEncoded, Schema.ParseError>

  readonly decodeWorldGenerator: (encoded: WorldGeneratorEncoded) => Effect.Effect<WorldGenerator, Schema.ParseError>
}

export const WorldGenerationAdapterService = Context.GenericTag<WorldGenerationAdapterService>(
  '@minecraft/infrastructure/world_generation/WorldGenerationAdapter'
)
