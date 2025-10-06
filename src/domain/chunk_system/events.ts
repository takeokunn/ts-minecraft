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
  ResourceBudget,
  ResourceBudgetSchema,
  StrategyId,
  StrategyIdSchema,
} from './index'

export const ChunkEvent = Data.taggedEnum({
  RequestQueued: Data.tagged<{
    readonly _tag: 'RequestQueued'
    readonly request: ChunkRequest
  }>('RequestQueued'),
  RequestCompleted: Data.tagged<{
    readonly _tag: 'RequestCompleted'
    readonly requestId: RequestId
    readonly completedAt: EpochMilliseconds
  }>('RequestCompleted'),
  RequestFailed: Data.tagged<{
    readonly _tag: 'RequestFailed'
    readonly requestId: RequestId
    readonly occurredAt: EpochMilliseconds
    readonly reason: string
  }>('RequestFailed'),
  StrategyShifted: Data.tagged<{
    readonly _tag: 'StrategyShifted'
    readonly strategy: StrategyId
    readonly decidedAt: EpochMilliseconds
  }>('StrategyShifted'),
  BudgetChanged: Data.tagged<{
    readonly _tag: 'BudgetChanged'
    readonly budget: ResourceBudget
    readonly effectiveAt: EpochMilliseconds
  }>('BudgetChanged'),
})

export type ChunkEvent = Data.TaggedEnum.Infer<typeof ChunkEvent>

const RequestQueuedSchema = Schema.Struct({
  _tag: Schema.Literal('RequestQueued'),
  request: ChunkRequestSchema,
})

const RequestCompletedSchema = Schema.Struct({
  _tag: Schema.Literal('RequestCompleted'),
  requestId: RequestIdSchema,
  completedAt: EpochMillisecondsSchema,
})

const RequestFailedSchema = Schema.Struct({
  _tag: Schema.Literal('RequestFailed'),
  requestId: RequestIdSchema,
  occurredAt: EpochMillisecondsSchema,
  reason: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(256)),
})

const StrategyShiftedSchema = Schema.Struct({
  _tag: Schema.Literal('StrategyShifted'),
  strategy: StrategyIdSchema,
  decidedAt: EpochMillisecondsSchema,
})

const BudgetChangedSchema = Schema.Struct({
  _tag: Schema.Literal('BudgetChanged'),
  budget: ResourceBudgetSchema,
  effectiveAt: EpochMillisecondsSchema,
})

export const ChunkEventSchema = Schema.Union(
  RequestQueuedSchema,
  RequestCompletedSchema,
  RequestFailedSchema,
  StrategyShiftedSchema,
  BudgetChangedSchema
)

export type ChunkEventInput = Schema.Schema.Type<typeof ChunkEventSchema>

export const decodeEvent = (input: ChunkEventInput) =>
  Schema.decodeUnknown(ChunkEventSchema)(input).pipe(
    Effect.map((value) =>
      Match.value(value).pipe(
        Match.when({ _tag: 'RequestQueued' }, ({ request }) => ChunkEvent.RequestQueued({ request })),
        Match.when({ _tag: 'RequestCompleted' }, ({ requestId, completedAt }) =>
          ChunkEvent.RequestCompleted({ requestId, completedAt })
        ),
        Match.when({ _tag: 'RequestFailed' }, ({ requestId, occurredAt, reason }) =>
          ChunkEvent.RequestFailed({ requestId, occurredAt, reason })
        ),
        Match.when({ _tag: 'StrategyShifted' }, ({ strategy, decidedAt }) =>
          ChunkEvent.StrategyShifted({ strategy, decidedAt })
        ),
        Match.when({ _tag: 'BudgetChanged' }, ({ budget, effectiveAt }) =>
          ChunkEvent.BudgetChanged({ budget, effectiveAt })
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
