import { Schema } from 'effect'

import {
  CancelGenerationCommand as CancelGenerationCommandSchema,
  GenerateChunkCommand as GenerateChunkCommandSchema,
  GenerateWorldCommand as GenerateWorldCommandSchema,
  UpdateSettingsCommand as UpdateSettingsCommandSchema,
  WorldGenerationResult,
  ChunkGenerationResult,
} from '../domain_service/world_generation_orchestrator/orchestrator'

export const WorldGenerationCommandSchema = Schema.Union(
  GenerateWorldCommandSchema,
  GenerateChunkCommandSchema,
  UpdateSettingsCommandSchema,
  CancelGenerationCommandSchema
)

export type WorldGenerationCommand = Schema.Schema.Type<typeof WorldGenerationCommandSchema>

export type GenerateWorldCommand = Schema.Schema.Type<typeof GenerateWorldCommandSchema>
export type GenerateChunkCommand = Schema.Schema.Type<typeof GenerateChunkCommandSchema>
export type UpdateSettingsCommand = Schema.Schema.Type<typeof UpdateSettingsCommandSchema>
export type CancelGenerationCommand = Schema.Schema.Type<typeof CancelGenerationCommandSchema>

export type WorldGenerationResultType = Schema.Schema.Type<typeof WorldGenerationResult>
export type ChunkGenerationResultType = Schema.Schema.Type<typeof ChunkGenerationResult>
