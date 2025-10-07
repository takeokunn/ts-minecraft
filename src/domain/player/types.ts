import { Schema } from 'effect'

// -----------------------------------------------------------------------------
// 基本Brand型
// -----------------------------------------------------------------------------

// 共有カーネルから再エクスポート
export { PlayerIdSchema, type PlayerId } from '../shared/entities/player_id'
export { WorldIdSchema, type WorldId } from '../shared/entities/world_id'

export const PlayerNameSchema = Schema.String.pipe(
  Schema.trimmed(),
  Schema.minLength(1),
  Schema.maxLength(48),
  Schema.brand('PlayerName')
)

export type PlayerName = Schema.Schema.Type<typeof PlayerNameSchema>

export const TimestampSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.nonNegative(),
  Schema.brand('PlayerTimestamp')
)

export type PlayerTimestamp = Schema.Schema.Type<typeof TimestampSchema>

export const HealthValueSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0, 20),
  Schema.brand('PlayerHealth')
)

export type PlayerHealthValue = Schema.Schema.Type<typeof HealthValueSchema>

export const HungerValueSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0, 20),
  Schema.brand('PlayerHunger')
)

export type PlayerHungerValue = Schema.Schema.Type<typeof HungerValueSchema>

export const SaturationValueSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(0, 20),
  Schema.brand('PlayerSaturation')
)

export type PlayerSaturationValue = Schema.Schema.Type<typeof SaturationValueSchema>

export const ExperienceLevelSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('PlayerExperienceLevel')
)

export type PlayerExperienceLevel = Schema.Schema.Type<typeof ExperienceLevelSchema>

export const CoordinateSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(-30_000_000, 30_000_000),
  Schema.brand('PlayerCoordinate')
)

export type PlayerCoordinate = Schema.Schema.Type<typeof CoordinateSchema>

export const VelocitySchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.between(-1024, 1024),
  Schema.brand('PlayerVelocity')
)

export type PlayerVelocity = Schema.Schema.Type<typeof VelocitySchema>

export const SpeedSchema = Schema.Number.pipe(Schema.finite(), Schema.positive(), Schema.brand('PlayerSpeed'))

export type PlayerSpeed = Schema.Schema.Type<typeof SpeedSchema>

export const AccelerationSchema = Schema.Number.pipe(Schema.finite(), Schema.brand('PlayerAcceleration'))

export type PlayerAcceleration = Schema.Schema.Type<typeof AccelerationSchema>

// -----------------------------------------------------------------------------
// 値オブジェクト
// -----------------------------------------------------------------------------

export const PlayerPositionSchema = Schema.Struct({
  x: CoordinateSchema,
  y: CoordinateSchema,
  z: CoordinateSchema,
  worldId: WorldIdSchema,
  yaw: Schema.Number.pipe(Schema.finite(), Schema.between(-180, 180)),
  pitch: Schema.Number.pipe(Schema.finite(), Schema.between(-90, 90)),
}).pipe(Schema.brand('PlayerPosition'))

export type PlayerPosition = Schema.Schema.Type<typeof PlayerPositionSchema>

export const PlayerMotionSchema = Schema.Struct({
  velocityX: VelocitySchema,
  velocityY: VelocitySchema,
  velocityZ: VelocitySchema,
  isOnGround: Schema.Boolean,
}).pipe(Schema.brand('PlayerMotion'))

export type PlayerMotion = Schema.Schema.Type<typeof PlayerMotionSchema>

export const PlayerVitalsSchema = Schema.Struct({
  health: HealthValueSchema,
  hunger: HungerValueSchema,
  saturation: SaturationValueSchema,
  experienceLevel: ExperienceLevelSchema,
}).pipe(
  Schema.filter(({ health, hunger }) => health + hunger > 0, {
    message: () => '健康状態と空腹状態の合計は0より大きい必要があります',
  }),
  Schema.brand('PlayerVitals')
)

export type PlayerVitals = Schema.Schema.Type<typeof PlayerVitalsSchema>

// -----------------------------------------------------------------------------
// 状態定義
// -----------------------------------------------------------------------------

export const PlayerLifecycleStateSchema = Schema.Literal(
  'loading',
  'alive',
  'dead',
  'respawning',
  'teleporting',
  'disconnected'
)

export type PlayerLifecycleState = Schema.Schema.Type<typeof PlayerLifecycleStateSchema>

export const PlayerGameModeSchema = Schema.Literal('survival', 'creative', 'adventure', 'spectator')

export type PlayerGameMode = Schema.Schema.Type<typeof PlayerGameModeSchema>

// -----------------------------------------------------------------------------
// Player集約
// -----------------------------------------------------------------------------

export const PlayerAggregateSchema = Schema.Struct({
  id: PlayerIdSchema,
  name: PlayerNameSchema,
  state: PlayerLifecycleStateSchema,
  gameMode: PlayerGameModeSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  vitals: PlayerVitalsSchema,
  position: PlayerPositionSchema,
  motion: PlayerMotionSchema,
}).pipe(
  Schema.filter((aggregate) => aggregate.updatedAt >= aggregate.createdAt, {
    message: () => 'updatedAtはcreatedAt以上である必要があります',
  }),
  Schema.brand('PlayerAggregate')
)

export type PlayerAggregate = Schema.Schema.Type<typeof PlayerAggregateSchema>

export const PlayerSnapshotSchema = Schema.Struct({
  aggregate: PlayerAggregateSchema,
  capturedAt: TimestampSchema,
}).pipe(
  Schema.filter(({ aggregate, capturedAt }) => capturedAt >= aggregate.createdAt, {
    message: () => 'スナップショット時刻が作成時刻以前です',
  }),
  Schema.brand('PlayerSnapshot')
)

export type PlayerSnapshot = Schema.Schema.Type<typeof PlayerSnapshotSchema>

const PlayerCreatedEvent = Schema.Struct({
  _tag: Schema.Literal('PlayerCreated'),
  aggregate: PlayerAggregateSchema,
})

const PlayerVitalsChangedEvent = Schema.Struct({
  _tag: Schema.Literal('PlayerVitalsChanged'),
  aggregate: PlayerAggregateSchema,
})

const PlayerPositionChangedEvent = Schema.Struct({
  _tag: Schema.Literal('PlayerPositionChanged'),
  aggregate: PlayerAggregateSchema,
})

const PlayerStateChangedEvent = Schema.Struct({
  _tag: Schema.Literal('PlayerStateChanged'),
  aggregate: PlayerAggregateSchema,
  previousState: PlayerLifecycleStateSchema,
})

export const PlayerEventSchema = Schema.Union(
  PlayerCreatedEvent,
  PlayerVitalsChangedEvent,
  PlayerPositionChangedEvent,
  PlayerStateChangedEvent
)

export type PlayerEvent = Schema.Schema.Type<typeof PlayerEventSchema>

const CreatePlayerCommand = Schema.Struct({
  _tag: Schema.Literal('CreatePlayer'),
  id: PlayerIdSchema,
  name: PlayerNameSchema,
  gameMode: PlayerGameModeSchema,
  timestamp: TimestampSchema,
})

const UpdateVitalsCommand = Schema.Struct({
  _tag: Schema.Literal('UpdateVitals'),
  id: PlayerIdSchema,
  health: HealthValueSchema,
  hunger: HungerValueSchema,
  saturation: SaturationValueSchema,
  experienceLevel: ExperienceLevelSchema,
  timestamp: TimestampSchema,
})

const UpdatePositionCommand = Schema.Struct({
  _tag: Schema.Literal('UpdatePosition'),
  id: PlayerIdSchema,
  position: PlayerPositionSchema,
  motion: PlayerMotionSchema,
  timestamp: TimestampSchema,
})

const TransitionStateCommand = Schema.Struct({
  _tag: Schema.Literal('TransitionState'),
  id: PlayerIdSchema,
  from: PlayerLifecycleStateSchema,
  to: PlayerLifecycleStateSchema,
  timestamp: TimestampSchema,
})

export const PlayerCommandSchema = Schema.Union(
  CreatePlayerCommand,
  UpdateVitalsCommand,
  UpdatePositionCommand,
  TransitionStateCommand
)

export type PlayerCommand = Schema.Schema.Type<typeof PlayerCommandSchema>

// -----------------------------------------------------------------------------
// 入力用型
// -----------------------------------------------------------------------------

export const PlayerCreationInputSchema = Schema.Struct({
  id: PlayerIdSchema,
  name: PlayerNameSchema,
  gameMode: PlayerGameModeSchema,
  position: PlayerPositionSchema,
  timestamp: TimestampSchema,
}).pipe(Schema.brand('PlayerCreationInput'))

export type PlayerCreationInput = Schema.Schema.Type<typeof PlayerCreationInputSchema>

export const PlayerUpdateContextSchema = Schema.Struct({
  timestamp: TimestampSchema,
}).pipe(Schema.brand('PlayerUpdateContext'))

export type PlayerUpdateContext = Schema.Schema.Type<typeof PlayerUpdateContextSchema>
