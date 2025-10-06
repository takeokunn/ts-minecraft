import type { ParseError } from '@effect/schema/ParseResult'
import { TreeFormatter } from '@effect/schema/TreeFormatter'
import { Effect, Either, Match, pipe, ReadonlyArray, Schema } from 'effect'
import {
  HEALTH_CONSTANTS,
  HUNGER_CONSTANTS,
  JUMP_VELOCITY,
  MOVEMENT_SPEEDS,
  PHYSICS_CONSTANTS,
  PlayerAggregate,
  PlayerAggregateSchema,
  PlayerCommand,
  PlayerCommandSchema,
  PlayerCreationInput,
  PlayerCreationInputSchema,
  PlayerErrorBuilders,
  PlayerEvent,
  PlayerEventSchema,
  PlayerGameMode,
  PlayerLifecycleState,
  PlayerMotionSchema,
  PlayerPosition,
  PlayerPositionSchema,
  PlayerSnapshot,
  PlayerSnapshotSchema,
  PlayerUpdateContext,
  PlayerUpdateContextSchema,
  PlayerVitalsSchema,
  SATURATION_CONSTANTS,
} from './index'

// -----------------------------------------------------------------------------
// 型エイリアス
// -----------------------------------------------------------------------------

type ConstraintError = ReturnType<typeof PlayerErrorBuilders.constraint>
type TransitionError = ReturnType<typeof PlayerErrorBuilders.invalidTransition>

// -----------------------------------------------------------------------------
// ヘルパー
// -----------------------------------------------------------------------------

const toDetails = (label: string, error: ParseError): ReadonlyMap<string, unknown> =>
  new Map([
    ['label', label],
    ['message', TreeFormatter.formatErrorSync(error)],
  ])

const decodeWith = <A>(schema: Schema.Schema<unknown, A>, label: string, value: unknown) =>
  pipe(
    Schema.decodeUnknownEither(schema)(value),
    Either.mapLeft((parseError) => PlayerErrorBuilders.constraint(label, toDetails(label, parseError))),
    Effect.fromEither
  )

const ensureContext = (context: PlayerUpdateContext) =>
  decodeWith(PlayerUpdateContextSchema, 'PlayerUpdateContext', context)

const ensureTimestampOrder = (current: PlayerAggregate, context: PlayerUpdateContext) =>
  pipe(
    ensureContext(context),
    Effect.flatMap(({ timestamp }) =>
      pipe(
        Effect.succeed(timestamp),
        Effect.filterOrFail(
          (value) => value >= current.updatedAt,
          () =>
            PlayerErrorBuilders.constraint(
              'TimestampOrder',
              new Map([
                ['previous', current.updatedAt],
                ['next', context.timestamp],
              ])
            )
        ),
        Effect.map(() => context.timestamp)
      )
    )
  )

const allowedTransitions: ReadonlyArray<readonly [PlayerLifecycleState, PlayerLifecycleState]> = [
  ['loading', 'alive'],
  ['alive', 'dead'],
  ['dead', 'respawning'],
  ['respawning', 'alive'],
  ['alive', 'teleporting'],
  ['teleporting', 'alive'],
  ['alive', 'disconnected'],
  ['dead', 'disconnected'],
  ['respawning', 'disconnected'],
  ['teleporting', 'disconnected'],
  ['loading', 'disconnected'],
  ['disconnected', 'loading'],
  ['alive', 'loading'],
  ['dead', 'alive'],
]

const ensureTransition = (
  from: PlayerLifecycleState,
  to: PlayerLifecycleState,
  trigger: string
): Effect.Effect<boolean, TransitionError> =>
  pipe(
    allowedTransitions,
    ReadonlyArray.some(([source, target]) => source === from && target === to),
    Effect.succeed,
    Effect.filterOrFail(
      (isAllowed) => isAllowed,
      () =>
        PlayerErrorBuilders.invalidTransition({
          from,
          to,
          trigger,
          explanation: '許可されていない状態遷移です',
        })
    )
  )

const stationaryMotion = pipe(
  Schema.decodeUnknownEither(PlayerMotionSchema)({
    velocityX: 0,
    velocityY: 0,
    velocityZ: 0,
    isOnGround: true,
  }),
  Effect.fromEither,
  Effect.orDie
)

const defaultVitals = pipe(
  Schema.decodeUnknownEither(PlayerVitalsSchema)({
    health: HEALTH_CONSTANTS.maximum,
    hunger: HUNGER_CONSTANTS.replenished,
    saturation: SATURATION_CONSTANTS.maximum,
    experienceLevel: 0,
  }),
  Effect.fromEither,
  Effect.orDie
)

const eventOf = (input: unknown) => decodeWith(PlayerEventSchema, 'PlayerEvent', input)

const aggregateOf = (input: unknown) => decodeWith(PlayerAggregateSchema, 'PlayerAggregate', input)

// -----------------------------------------------------------------------------
// 操作結果型
// -----------------------------------------------------------------------------

export interface PlayerOperationResult {
  readonly aggregate: PlayerAggregate
  readonly event: PlayerEvent
}

// -----------------------------------------------------------------------------
// プレイヤー作成
// -----------------------------------------------------------------------------

export const createPlayer = (input: PlayerCreationInput): Effect.Effect<PlayerOperationResult, ConstraintError> =>
  pipe(
    decodeWith(PlayerCreationInputSchema, 'PlayerCreationInput', input),
    Effect.zipWith(stationaryMotion, (payload, motion) => ({ payload, motion })),
    Effect.zipWith(defaultVitals, ({ payload, motion }, vitals) => ({ payload, motion, vitals })),
    Effect.flatMap(({ payload, motion, vitals }) =>
      aggregateOf({
        id: payload.id,
        name: payload.name,
        state: 'loading',
        gameMode: payload.gameMode,
        createdAt: payload.timestamp,
        updatedAt: payload.timestamp,
        vitals,
        position: payload.position,
        motion,
      })
    ),
    Effect.flatMap((aggregate) =>
      eventOf({
        _tag: 'PlayerCreated',
        aggregate,
      }).pipe(Effect.map((event) => ({ aggregate, event })))
    )
  )

// -----------------------------------------------------------------------------
// 体力・空腹更新
// -----------------------------------------------------------------------------

export const updateVitals = (
  aggregate: PlayerAggregate,
  params: {
    readonly health: number
    readonly hunger: number
    readonly saturation: number
    readonly experienceLevel: number
  },
  context: PlayerUpdateContext
): Effect.Effect<PlayerOperationResult, ConstraintError> =>
  pipe(
    ensureTimestampOrder(aggregate, context),
    Effect.flatMap((timestamp) =>
      decodeWith(PlayerVitalsSchema, 'PlayerVitals', {
        health: params.health,
        hunger: params.hunger,
        saturation: params.saturation,
        experienceLevel: params.experienceLevel,
      }).pipe(Effect.map((vitals) => ({ vitals, timestamp })))
    ),
    Effect.flatMap(({ vitals, timestamp }) =>
      aggregateOf({
        ...aggregate,
        vitals,
        updatedAt: timestamp,
      })
    ),
    Effect.flatMap((nextAggregate) =>
      eventOf({
        _tag: 'PlayerVitalsChanged',
        aggregate: nextAggregate,
      }).pipe(Effect.map((event) => ({ aggregate: nextAggregate, event })))
    )
  )

// -----------------------------------------------------------------------------
// 位置・モーション更新
// -----------------------------------------------------------------------------

export const updatePosition = (
  aggregate: PlayerAggregate,
  params: { readonly position: PlayerPosition; readonly motion: unknown },
  context: PlayerUpdateContext
): Effect.Effect<PlayerOperationResult, ConstraintError> =>
  pipe(
    ensureTimestampOrder(aggregate, context),
    Effect.flatMap((timestamp) =>
      decodeWith(PlayerMotionSchema, 'PlayerMotion', params.motion).pipe(
        Effect.zipWith(decodeWith(PlayerPositionSchema, 'PlayerPosition', params.position), (motion, position) => ({
          motion,
          position,
          timestamp,
        }))
      )
    ),
    Effect.flatMap(({ motion, position, timestamp }) =>
      aggregateOf({
        ...aggregate,
        motion,
        position,
        updatedAt: timestamp,
      })
    ),
    Effect.flatMap((nextAggregate) =>
      eventOf({
        _tag: 'PlayerPositionChanged',
        aggregate: nextAggregate,
      }).pipe(Effect.map((event) => ({ aggregate: nextAggregate, event })))
    )
  )

// -----------------------------------------------------------------------------
// 状態遷移
// -----------------------------------------------------------------------------

export const transitionState = (
  aggregate: PlayerAggregate,
  to: PlayerLifecycleState,
  context: PlayerUpdateContext,
  trigger: string
): Effect.Effect<PlayerOperationResult, TransitionError | ConstraintError> =>
  pipe(
    ensureTimestampOrder(aggregate, context),
    Effect.flatMap(() => ensureTransition(aggregate.state, to, trigger)),
    Effect.flatMap(() =>
      aggregateOf({
        ...aggregate,
        state: to,
        updatedAt: context.timestamp,
      })
    ),
    Effect.flatMap((nextAggregate) =>
      eventOf({
        _tag: 'PlayerStateChanged',
        aggregate: nextAggregate,
        previousState: aggregate.state,
      }).pipe(Effect.map((event) => ({ aggregate: nextAggregate, event })))
    )
  )

// -----------------------------------------------------------------------------
// コマンド適用
// -----------------------------------------------------------------------------

export const applyCommand = (
  aggregate: PlayerAggregate,
  command: PlayerCommand
): Effect.Effect<PlayerOperationResult, ConstraintError | TransitionError> =>
  pipe(
    decodeWith(PlayerCommandSchema, 'PlayerCommand', command),
    Effect.flatMap((validated) =>
      pipe(
        Match.value(validated),
        Match.tag('UpdateVitals', ({ health, hunger, saturation, experienceLevel, timestamp }) =>
          updateVitals(aggregate, { health, hunger, saturation, experienceLevel }, { timestamp })
        ),
        Match.tag('UpdatePosition', ({ position, motion, timestamp }) =>
          updatePosition(aggregate, { position, motion }, { timestamp })
        ),
        Match.tag('TransitionState', ({ to, timestamp, from }) =>
          transitionState(aggregate, to, { timestamp }, `${from}->${to}`)
        ),
        Match.tag('CreatePlayer', () =>
          Effect.fail(
            PlayerErrorBuilders.constraint(
              'CreateCommand',
              new Map([['message', '既存プレイヤーにCreateコマンドは適用できません']])
            )
          )
        ),
        Match.exhaustive
      )
    )
  )

// -----------------------------------------------------------------------------
// スナップショット
// -----------------------------------------------------------------------------

export const snapshot = (
  aggregate: PlayerAggregate,
  timestamp: number
): Effect.Effect<PlayerSnapshot, ConstraintError> =>
  decodeWith(PlayerSnapshotSchema, 'PlayerSnapshot', {
    aggregate,
    capturedAt: timestamp,
  })

// -----------------------------------------------------------------------------
// ドメイン固有ユーティリティ
// -----------------------------------------------------------------------------

export const computeJumpVelocity = (mode: PlayerGameMode): Effect.Effect<number, never> =>
  pipe(
    Match.value(mode),
    Match.when('creative', () => JUMP_VELOCITY * 1.2),
    Match.when('spectator', () => JUMP_VELOCITY * 1.5),
    Match.orElse(() => JUMP_VELOCITY),
    Effect.succeed
  )

export const maxHorizontalSpeed = (isSprinting: boolean, isSneaking: boolean): Effect.Effect<number, never> =>
  pipe(
    Match.value(true),
    Match.when(
      () => isSprinting,
      () => MOVEMENT_SPEEDS.sprint
    ),
    Match.when(
      () => isSneaking,
      () => MOVEMENT_SPEEDS.crouch
    ),
    Match.orElse(() => MOVEMENT_SPEEDS.walk),
    Effect.succeed
  )

export const computeFallDamage = (fallDistance: number): Effect.Effect<number, never> =>
  pipe(
    Effect.succeed(Math.max(0, fallDistance - 3)),
    Effect.map((adjusted) => adjusted * PHYSICS_CONSTANTS.gravity * -1)
  )

export const regenerateHunger = (
  aggregate: PlayerAggregate,
  context: PlayerUpdateContext
): Effect.Effect<PlayerOperationResult, ConstraintError> =>
  updateVitals(
    aggregate,
    {
      health: Math.min(HEALTH_CONSTANTS.maximum, aggregate.vitals.health + 1),
      hunger: Math.min(HUNGER_CONSTANTS.maximum, aggregate.vitals.hunger + 1),
      saturation: Math.min(SATURATION_CONSTANTS.maximum, aggregate.vitals.saturation + 0.5),
      experienceLevel: aggregate.vitals.experienceLevel,
    },
    context
  )
