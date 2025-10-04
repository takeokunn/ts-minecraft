import { Data, Option } from 'effect'

interface IdentityShape {
  readonly reason: string
  readonly value: string
}

interface ConstraintShape {
  readonly reason: string
  readonly details: ReadonlyMap<string, unknown>
}

interface TransitionShape {
  readonly from: string
  readonly to: string
  readonly trigger: string
  readonly explanation: string
}

interface MissingShape {
  readonly entity: string
  readonly identifier: string
}

interface PersistenceShape {
  readonly operation: string
  readonly cause: Option.Option<unknown>
}

interface ClockShape {
  readonly cause: Option.Option<unknown>
}

/**
 * Playerドメイン共通エラーADT
 */
export const PlayerError = Data.taggedEnum('PlayerError')({
  IdentityViolation: Data.struct<IdentityShape>({
    reason: '',
    value: '',
  }),
  ConstraintViolation: Data.struct<ConstraintShape>({
    reason: '',
    details: new Map(),
  }),
  InvalidTransition: Data.struct<TransitionShape>({
    from: '',
    to: '',
    trigger: '',
    explanation: '',
  }),
  MissingEntity: Data.struct<MissingShape>({
    entity: '',
    identifier: '',
  }),
  PersistenceFailure: Data.struct<PersistenceShape>({
    operation: '',
    cause: Option.none<unknown>(),
  }),
  ClockFailure: Data.struct<ClockShape>({
    cause: Option.none<unknown>(),
  }),
})

export type PlayerError = Data.TaggedEnum.Infer<typeof PlayerError>

interface ConstantRangeShape {
  readonly constant: string
  readonly value: number
  readonly requirement: string
}

interface ConstantFiniteShape {
  readonly constant: string
  readonly value: number
}

/**
 * Player定数検証エラーADT
 */
export const PlayerConstantError = Data.taggedEnum('PlayerConstantError')({
  OutOfRange: Data.struct<ConstantRangeShape>({
    constant: '',
    value: 0,
    requirement: '',
  }),
  NotFinite: Data.struct<ConstantFiniteShape>({
    constant: '',
    value: 0,
  }),
})

export type PlayerConstantError = Data.TaggedEnum.Infer<typeof PlayerConstantError>

/**
 * PlayerErrorビルダー関数
 */
export const PlayerErrorBuilders = {
  identity: (reason: string, value: string) => PlayerError.IdentityViolation({ reason, value }),
  constraint: (reason: string, details: ReadonlyMap<string, unknown>) =>
    PlayerError.ConstraintViolation({ reason, details }),
  invalidTransition: (params: TransitionShape) => PlayerError.InvalidTransition(params),
  missing: (entity: string, identifier: string) => PlayerError.MissingEntity({ entity, identifier }),
  persistence: (operation: string, cause?: unknown) =>
    PlayerError.PersistenceFailure({ operation, cause: Option.fromNullable(cause) }),
  clock: (cause?: unknown) => PlayerError.ClockFailure({ cause: Option.fromNullable(cause) }),
}

export const PlayerConstantErrorBuilders = {
  outOfRange: (constant: string, value: number, requirement: string) =>
    PlayerConstantError.OutOfRange({ constant, value, requirement }),
  notFinite: (constant: string, value: number) => PlayerConstantError.NotFinite({ constant, value }),
}
