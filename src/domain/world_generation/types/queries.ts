import { Schema } from 'effect'

import { GetProgressQuery as GetProgressQuerySchema } from '../domain_service/world_generation_orchestrator/orchestrator'

export const ListActiveSessionsQuerySchema = Schema.Struct({
  _tag: Schema.Literal('ListActiveSessionsQuery'),
})

export const HealthCheckQuerySchema = Schema.Struct({
  _tag: Schema.Literal('HealthCheckQuery'),
})

export const WorldGenerationQuerySchema = Schema.Union(
  GetProgressQuerySchema,
  ListActiveSessionsQuerySchema,
  HealthCheckQuerySchema
)

export type WorldGenerationQuery = Schema.Schema.Type<typeof WorldGenerationQuerySchema>
export type GetProgressQuery = Schema.Schema.Type<typeof GetProgressQuerySchema>
export type ListActiveSessionsQuery = Schema.Schema.Type<typeof ListActiveSessionsQuerySchema>
export type HealthCheckQuery = Schema.Schema.Type<typeof HealthCheckQuerySchema>
