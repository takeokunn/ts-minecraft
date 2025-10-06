import { Effect, Match, Schema } from 'effect'
import {
  ChunkEvent,
  ChunkRequestSchema,
  ChunkSystemError,
  EpochMillisecondsSchema,
  RequestIdSchema,
  ResourceBudgetSchema,
  StrategyIdSchema,
} from './index'

export { ChunkEvent } from './index'

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
