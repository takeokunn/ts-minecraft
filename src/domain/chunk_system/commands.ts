import { Schema } from '@effect/schema'
import { Data, Effect, Match } from 'effect'
import {
  ChunkRequest,
  ChunkRequestSchema,
  ChunkSystemError,
  EpochMilliseconds,
  EpochMillisecondsSchema,
  RequestId,
  RequestIdSchema,
  StrategyId,
  StrategyIdSchema,
} from './index'

export const ChunkCommand = Data.taggedEnum({
  Schedule: Data.tagged<{
    readonly _tag: 'Schedule'
    readonly request: ChunkRequest
  }>('Schedule'),
  Complete: Data.tagged<{
    readonly _tag: 'Complete'
    readonly requestId: RequestId
    readonly completedAt: EpochMilliseconds
  }>('Complete'),
  Fail: Data.tagged<{
    readonly _tag: 'Fail'
    readonly requestId: RequestId
    readonly occurredAt: EpochMilliseconds
    readonly reason: string
  }>('Fail'),
  Reprioritize: Data.tagged<{
    readonly _tag: 'Reprioritize'
    readonly requestId: RequestId
    readonly newPriority: ChunkRequest['priority']
  }>('Reprioritize'),
  SwitchStrategy: Data.tagged<{
    readonly _tag: 'SwitchStrategy'
    readonly strategy: StrategyId
    readonly decidedAt: EpochMilliseconds
  }>('SwitchStrategy'),
})

export type ChunkCommand = Data.TaggedEnum.Infer<typeof ChunkCommand>

const ScheduleSchema = Schema.Struct({
  _tag: Schema.Literal('Schedule'),
  request: ChunkRequestSchema,
})

const CompleteSchema = Schema.Struct({
  _tag: Schema.Literal('Complete'),
  requestId: RequestIdSchema,
  completedAt: EpochMillisecondsSchema,
})

const FailSchema = Schema.Struct({
  _tag: Schema.Literal('Fail'),
  requestId: RequestIdSchema,
  occurredAt: EpochMillisecondsSchema,
  reason: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(256)),
})

const ReprioritizeSchema = Schema.Struct({
  _tag: Schema.Literal('Reprioritize'),
  requestId: RequestIdSchema,
  newPriority: ChunkRequestSchema.shape.priority,
})

const SwitchStrategySchema = Schema.Struct({
  _tag: Schema.Literal('SwitchStrategy'),
  strategy: StrategyIdSchema,
  decidedAt: EpochMillisecondsSchema,
})

export const ChunkCommandSchema = Schema.Union(
  ScheduleSchema,
  CompleteSchema,
  FailSchema,
  ReprioritizeSchema,
  SwitchStrategySchema
)

export type ChunkCommandInput = Schema.Schema.Type<typeof ChunkCommandSchema>

export const decodeCommand = (input: unknown) =>
  Schema.decodeUnknown(ChunkCommandSchema)(input).pipe(
    Effect.map((value) =>
      Match.value(value).pipe(
        Match.when({ _tag: 'Schedule' }, ({ request }) => ChunkCommand.Schedule({ request })),
        Match.when({ _tag: 'Complete' }, ({ requestId, completedAt }) =>
          ChunkCommand.Complete({ requestId, completedAt })
        ),
        Match.when({ _tag: 'Fail' }, ({ requestId, occurredAt, reason }) =>
          ChunkCommand.Fail({ requestId, occurredAt, reason })
        ),
        Match.when({ _tag: 'Reprioritize' }, ({ requestId, newPriority }) =>
          ChunkCommand.Reprioritize({ requestId, newPriority })
        ),
        Match.when({ _tag: 'SwitchStrategy' }, ({ strategy, decidedAt }) =>
          ChunkCommand.SwitchStrategy({ strategy, decidedAt })
        ),
        Match.exhaustive
      )
    ),
    Effect.mapError((issue) =>
      ChunkSystemError.ValidationError({
        message: issue.message,
      })
    )
  )

export const parseChunkRequest = (input: unknown) =>
  Schema.decodeUnknown(ChunkRequestSchema)(input).pipe(
    Effect.mapError((issue) =>
      ChunkSystemError.ValidationError({
        message: issue.message,
      })
    )
  )

export const parseStrategy = (input: unknown) =>
  Schema.decodeUnknown(StrategyIdSchema)(input).pipe(
    Effect.mapError((issue) =>
      ChunkSystemError.ValidationError({
        message: issue.message,
      })
    )
  )
