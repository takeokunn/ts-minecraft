import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Data, Match, Schema } from 'effect'
import { pipe } from 'effect/Function'
import { BlockFaceSchema, Vector3Schema } from '../value_object'

const IdentifierSchema = Schema.String.pipe(
  Schema.nonEmptyString({ message: () => '識別子は1文字以上である必要があります' }),
  Schema.maxLength(64, { message: () => '識別子は64文字以内である必要があります' }),
  Schema.pattern(/^[A-Za-z0-9_-]+$/, {
    message: (value) => `無効な識別子です: ${String(value)}`,
  })
)

export const BlockIdSchema = IdentifierSchema.pipe(Schema.brand('BlockId'))
// PlayerIdは専用value_objectから再エクスポート
export { PlayerIdSchema, type PlayerId } from '@domain/player/value_object/player_id'
export const SessionIdSchema = IdentifierSchema.pipe(Schema.brand('SessionId'))

export type BlockId = Schema.Schema.Type<typeof BlockIdSchema>
export type SessionId = Schema.Schema.Type<typeof SessionIdSchema>

export const TickSchema = Schema.Number.pipe(
  Schema.int({ message: (value) => `ティックは整数である必要があります: ${value}` }),
  Schema.greaterThanOrEqualTo(0, { message: (value) => `ティックは0以上である必要があります: ${value}` }),
  Schema.brand('Tick')
)

export type Tick = Schema.Schema.Type<typeof TickSchema>

export const TimestampSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0, {
    message: (value) => `タイムスタンプは0以上である必要があります: ${value}`,
  }),
  Schema.brand('EpochMilliseconds')
)

export type EpochMilliseconds = Schema.Schema.Type<typeof TimestampSchema>

export const ProgressSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0, {
    message: (value) => `進捗は0以上である必要があります: ${value}`,
  }),
  Schema.lessThanOrEqualTo(1, {
    message: (value) => `進捗は1以下である必要があります: ${value}`,
  }),
  Schema.brand('Progress')
)

export type Progress = Schema.Schema.Type<typeof ProgressSchema>

const parseError = (error: Schema.ParseError) => TreeFormatter.formatError(error, { includeStackTrace: false })

export const decodeBlockId = Schema.decode(BlockIdSchema)
export const decodePlayerId = Schema.decode(PlayerIdSchema)
export const decodeSessionId = Schema.decode(SessionIdSchema)
export const decodeProgress = Schema.decode(ProgressSchema)
export const decodeTick = Schema.decode(TickSchema)
export const decodeTimestamp = Schema.decode(TimestampSchema)

export const decodeBlockIdEither = Schema.decodeEither(BlockIdSchema)
export const decodePlayerIdEither = Schema.decodeEither(PlayerIdSchema)
export const decodeSessionIdEither = Schema.decodeEither(SessionIdSchema)
export const decodeProgressEither = Schema.decodeEither(ProgressSchema)
export const decodeTickEither = Schema.decodeEither(TickSchema)
export const decodeTimestampEither = Schema.decodeEither(TimestampSchema)

const StartBreakingCommandSchema = Schema.Struct({
  _tag: Schema.Literal('StartBreaking'),
  playerId: PlayerIdSchema,
  blockId: BlockIdSchema,
  position: Vector3Schema,
  face: BlockFaceSchema,
})

const ContinueBreakingCommandSchema = Schema.Struct({
  _tag: Schema.Literal('ContinueBreaking'),
  sessionId: SessionIdSchema,
  progressDelta: ProgressSchema,
})

const CompleteBreakingCommandSchema = Schema.Struct({
  _tag: Schema.Literal('CompleteBreaking'),
  sessionId: SessionIdSchema,
})

const PlaceBlockCommandSchema = Schema.Struct({
  _tag: Schema.Literal('PlaceBlock'),
  playerId: PlayerIdSchema,
  blockId: BlockIdSchema,
  position: Vector3Schema,
  playerPosition: Vector3Schema,
  face: BlockFaceSchema,
})

export const InteractionCommandSchema = Schema.Union(
  StartBreakingCommandSchema,
  ContinueBreakingCommandSchema,
  CompleteBreakingCommandSchema,
  PlaceBlockCommandSchema
)

export type InteractionCommand = Schema.Schema.Type<typeof InteractionCommandSchema>

const BreakProgressedEventSchema = Schema.Struct({
  _tag: Schema.Literal('BreakProgressed'),
  sessionId: SessionIdSchema,
  progress: ProgressSchema,
  occurredAt: TimestampSchema,
})

const BlockBrokenEventSchema = Schema.Struct({
  _tag: Schema.Literal('BlockBroken'),
  sessionId: SessionIdSchema,
  blockId: BlockIdSchema,
  occurredAt: TimestampSchema,
})

const BlockPlacedEventSchema = Schema.Struct({
  _tag: Schema.Literal('BlockPlaced'),
  playerId: PlayerIdSchema,
  blockId: BlockIdSchema,
  position: Vector3Schema,
  face: BlockFaceSchema,
  occurredAt: TimestampSchema,
})

export const InteractionEventSchema = Schema.Union(
  BreakProgressedEventSchema,
  BlockBrokenEventSchema,
  BlockPlacedEventSchema
)

export type InteractionEvent = Schema.Schema.Type<typeof InteractionEventSchema>

export const InteractionError = Data.taggedEnum({
  InvalidCommand: Data.struct({ message: Schema.String }),
  UnknownSession: Data.struct({ sessionId: SessionIdSchema }),
  InvalidProgress: Data.struct({ sessionId: SessionIdSchema, progress: ProgressSchema }),
  PlacementRejected: Data.struct({ reason: Schema.String }),
})

export type InteractionError = typeof InteractionError.Type

export const parseCommand = Schema.decode(InteractionCommandSchema)
export const parseCommandEither = Schema.decodeEither(InteractionCommandSchema)
export const parseEvent = Schema.decode(InteractionEventSchema)
export const parseEventEither = Schema.decodeEither(InteractionEventSchema)

export const matchInteractionError = <A>(
  error: InteractionError,
  matchers: {
    readonly invalidCommand: (error: Extract<InteractionError, { readonly _tag: 'InvalidCommand' }>) => A
    readonly unknownSession: (error: Extract<InteractionError, { readonly _tag: 'UnknownSession' }>) => A
    readonly invalidProgress: (error: Extract<InteractionError, { readonly _tag: 'InvalidProgress' }>) => A
    readonly placementRejected: (error: Extract<InteractionError, { readonly _tag: 'PlacementRejected' }>) => A
  }
): A =>
  pipe(
    Match.value(error),
    Match.when(
      (candidate): candidate is Extract<InteractionError, { readonly _tag: 'InvalidCommand' }> =>
        candidate._tag === 'InvalidCommand',
      matchers.invalidCommand
    ),
    Match.when(
      (candidate): candidate is Extract<InteractionError, { readonly _tag: 'UnknownSession' }> =>
        candidate._tag === 'UnknownSession',
      matchers.unknownSession
    ),
    Match.when(
      (candidate): candidate is Extract<InteractionError, { readonly _tag: 'InvalidProgress' }> =>
        candidate._tag === 'InvalidProgress',
      matchers.invalidProgress
    ),
    Match.when(
      (candidate): candidate is Extract<InteractionError, { readonly _tag: 'PlacementRejected' }> =>
        candidate._tag === 'PlacementRejected',
      matchers.placementRejected
    ),
    Match.exhaustive
  )
