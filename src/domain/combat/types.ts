import { Brand, Effect } from 'effect'
import { Clock } from 'effect/Clock'

// ============================================================
// Error Types
// ============================================================

export type StatField = 'health' | 'damage' | 'defense' | 'criticalChance' | 'cooldown' | 'range' | 'timestamp'

export interface InvalidIdentifierError {
  readonly kind: 'InvalidIdentifier'
  readonly entity: 'combatantId' | 'sessionId'
  readonly value: string
  readonly reason: string
}

export interface InvalidStatError {
  readonly kind: 'InvalidStat'
  readonly stat: StatField
  readonly value: number
  readonly constraint: string
}

export interface InvalidAttackError {
  readonly kind: 'InvalidAttack'
  readonly details: string
}

export interface CooldownViolationError {
  readonly kind: 'CooldownViolation'
  readonly combatant: CombatantId
  readonly attack: AttackLabel
  readonly remaining: Cooldown
}

export interface CombatantNotFoundError {
  readonly kind: 'CombatantNotFound'
  readonly combatant: CombatantId
}

export interface SessionNotFoundError {
  readonly kind: 'SessionNotFound'
  readonly session: SessionId
}

export interface DuplicateCombatantError {
  readonly kind: 'DuplicateCombatant'
  readonly session: SessionId
  readonly combatant: CombatantId
}

export type CombatDomainError =
  | InvalidIdentifierError
  | InvalidStatError
  | InvalidAttackError
  | CooldownViolationError
  | CombatantNotFoundError
  | SessionNotFoundError
  | DuplicateCombatantError

export const CombatError = {
  invalidIdentifier: (
    entity: InvalidIdentifierError['entity'],
    value: string,
    reason: string
  ): InvalidIdentifierError => ({
    kind: 'InvalidIdentifier',
    entity,
    value,
    reason,
  }),

  invalidStat: (stat: StatField, value: number, constraint: string): InvalidStatError => ({
    kind: 'InvalidStat',
    stat,
    value,
    constraint,
  }),

  invalidAttack: (details: string): InvalidAttackError => ({
    kind: 'InvalidAttack',
    details,
  }),

  cooldownViolation: (combatant: CombatantId, attack: AttackLabel, remaining: Cooldown): CooldownViolationError => ({
    kind: 'CooldownViolation',
    combatant,
    attack,
    remaining,
  }),

  combatantNotFound: (combatant: CombatantId): CombatantNotFoundError => ({
    kind: 'CombatantNotFound',
    combatant,
  }),

  sessionNotFound: (session: SessionId): SessionNotFoundError => ({
    kind: 'SessionNotFound',
    session,
  }),

  duplicateCombatant: (session: SessionId, combatant: CombatantId): DuplicateCombatantError => ({
    kind: 'DuplicateCombatant',
    session,
    combatant,
  }),
} as const

// ============================================================
// Branded Primitive Types
// ============================================================

export type CombatantId = string & Brand.Brand<'CombatantId'>
export type SessionId = string & Brand.Brand<'SessionId'>
export type Health = number & Brand.Brand<'Health'>
export type Damage = number & Brand.Brand<'Damage'>
export type Defense = number & Brand.Brand<'Defense'>
export type CriticalChance = number & Brand.Brand<'CriticalChance'>
export type Cooldown = number & Brand.Brand<'Cooldown'>
export type AttackRange = number & Brand.Brand<'AttackRange'>
export type Timestamp = number & Brand.Brand<'Timestamp'>

const CombatantIdBrand = Brand.nominal<CombatantId>()
const SessionIdBrand = Brand.nominal<SessionId>()
const HealthBrand = Brand.nominal<Health>()
const DamageBrand = Brand.nominal<Damage>()
const DefenseBrand = Brand.nominal<Defense>()
const CriticalChanceBrand = Brand.nominal<CriticalChance>()
const CooldownBrand = Brand.nominal<Cooldown>()
const AttackRangeBrand = Brand.nominal<AttackRange>()
const TimestampBrand = Brand.nominal<Timestamp>()

const identifierPipeline = (
  value: string,
  entity: InvalidIdentifierError['entity']
): Effect.Effect<string, CombatDomainError> =>
  Effect.gen(function* () {
    const trimmed = value.trim()

    yield* pipe(
      trimmed.length < 3,
      Effect.when({
        onTrue: () => Effect.fail(CombatError.invalidIdentifier(entity, trimmed, 'length must be >= 3')),
        onFalse: () => Effect.void,
      })
    )

    yield* pipe(
      trimmed.length > 32,
      Effect.when({
        onTrue: () => Effect.fail(CombatError.invalidIdentifier(entity, trimmed, 'length must be <= 32')),
        onFalse: () => Effect.void,
      })
    )

    yield* pipe(
      !/^[a-z0-9_-]+$/i.test(trimmed),
      Effect.when({
        onTrue: () =>
          Effect.fail(
            CombatError.invalidIdentifier(
              entity,
              trimmed,
              'accepts only alphanumeric characters, underscore, or hyphen'
            )
          ),
        onFalse: () => Effect.void,
      })
    )

    return trimmed.toLowerCase()
  })

const createNumericFactory =
  <A>(options: {
    readonly field: StatField
    readonly min: number
    readonly max: number
    readonly brand: (value: number) => A
  }): ((value: number) => Effect.Effect<A, CombatDomainError>) =>
  (value) =>
    Effect.gen(function* () {
      yield* pipe(
        !Number.isFinite(value),
        Effect.when({
          onTrue: () => Effect.fail(CombatError.invalidStat(options.field, value, 'finite number required')),
          onFalse: () => Effect.void,
        })
      )

      yield* pipe(
        value < options.min,
        Effect.when({
          onTrue: () =>
            Effect.fail(CombatError.invalidStat(options.field, value, `value must be >= ${String(options.min)}`)),
          onFalse: () => Effect.void,
        })
      )

      yield* pipe(
        value > options.max,
        Effect.when({
          onTrue: () =>
            Effect.fail(CombatError.invalidStat(options.field, value, `value must be <= ${String(options.max)}`)),
          onFalse: () => Effect.void,
        })
      )

      return options.brand(value)
    })

export const makeCombatantId = (value: string): Effect.Effect<CombatantId, CombatDomainError> =>
  identifierPipeline(value, 'combatantId').pipe(Effect.map(CombatantIdBrand))

export const makeSessionId = (value: string): Effect.Effect<SessionId, CombatDomainError> =>
  identifierPipeline(value, 'sessionId').pipe(Effect.map(SessionIdBrand))

export const makeHealth = createNumericFactory<Health>({
  field: 'health',
  min: 0,
  max: 1000,
  brand: HealthBrand,
})

export const makeDamage = createNumericFactory<Damage>({
  field: 'damage',
  min: 0,
  max: 5000,
  brand: DamageBrand,
})

export const makeDefense = createNumericFactory<Defense>({
  field: 'defense',
  min: 0,
  max: 2000,
  brand: DefenseBrand,
})

export const makeCriticalChance = createNumericFactory<CriticalChance>({
  field: 'criticalChance',
  min: 0,
  max: 1,
  brand: CriticalChanceBrand,
})

export const makeCooldown = createNumericFactory<Cooldown>({
  field: 'cooldown',
  min: 0,
  max: 120000,
  brand: CooldownBrand,
})

export const makeAttackRange = createNumericFactory<AttackRange>({
  field: 'range',
  min: 0,
  max: 300,
  brand: AttackRangeBrand,
})

export const makeTimestamp = createNumericFactory<Timestamp>({
  field: 'timestamp',
  min: 0,
  max: Number.MAX_SAFE_INTEGER,
  brand: TimestampBrand,
})

export const currentTimestamp: Effect.Effect<Timestamp, never> = Effect.map(Clock.currentTimeMillis, (millis) =>
  TimestampBrand(millis)
)

// ============================================================
// Attack and Event Algebraic Data Types
// ============================================================

export type AttackLabel = 'Melee' | 'Ranged' | 'Magic'

export interface MeleeAttack {
  readonly tag: 'Melee'
  readonly baseDamage: Damage
  readonly cooldown: Cooldown
}

export interface RangedAttack {
  readonly tag: 'Ranged'
  readonly baseDamage: Damage
  readonly cooldown: Cooldown
  readonly range: AttackRange
}

export interface MagicAttack {
  readonly tag: 'Magic'
  readonly baseDamage: Damage
  readonly cooldown: Cooldown
  readonly manaCost: Cooldown
}

export type AttackKind = MeleeAttack | RangedAttack | MagicAttack

export const AttackKindFactory = {
  melee: (baseDamage: Damage, cooldown: Cooldown): AttackKind => ({
    tag: 'Melee',
    baseDamage,
    cooldown,
  }),
  ranged: (baseDamage: Damage, cooldown: Cooldown, range: AttackRange): AttackKind => ({
    tag: 'Ranged',
    baseDamage,
    cooldown,
    range,
  }),
  magic: (baseDamage: Damage, cooldown: Cooldown, manaCost: Cooldown): AttackKind => ({
    tag: 'Magic',
    baseDamage,
    cooldown,
    manaCost,
  }),
} as const

export interface AttackResolvedEvent {
  readonly kind: 'AttackResolved'
  readonly attacker: CombatantId
  readonly target: CombatantId
  readonly attack: AttackLabel
  readonly damage: Damage
  readonly timestamp: Timestamp
  readonly critical: boolean
}

export interface CombatantDefeatedEvent {
  readonly kind: 'CombatantDefeated'
  readonly combatant: CombatantId
  readonly timestamp: Timestamp
}

export interface CooldownUpdatedEvent {
  readonly kind: 'CooldownUpdated'
  readonly combatant: CombatantId
  readonly attack: AttackLabel
  readonly remaining: Cooldown
  readonly timestamp: Timestamp
}

export type CombatEvent = AttackResolvedEvent | CombatantDefeatedEvent | CooldownUpdatedEvent

export const CombatEventFactory = {
  attackResolved: (
    attacker: CombatantId,
    target: CombatantId,
    attack: AttackLabel,
    damage: Damage,
    timestamp: Timestamp,
    critical: boolean
  ): AttackResolvedEvent => ({
    kind: 'AttackResolved',
    attacker,
    target,
    attack,
    damage,
    timestamp,
    critical,
  }),
  combatantDefeated: (combatant: CombatantId, timestamp: Timestamp): CombatantDefeatedEvent => ({
    kind: 'CombatantDefeated',
    combatant,
    timestamp,
  }),
  cooldownUpdated: (
    combatant: CombatantId,
    attack: AttackLabel,
    remaining: Cooldown,
    timestamp: Timestamp
  ): CooldownUpdatedEvent => ({
    kind: 'CooldownUpdated',
    combatant,
    attack,
    remaining,
    timestamp,
  }),
} as const
