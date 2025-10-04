import { Brand, Effect, Either } from 'effect'
import { Clock } from 'effect/Clock'
import { pipe } from 'effect/Function'

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
  pipe(
    value,
    Either.right<string, CombatDomainError>,
    Either.map((input) => input.trim()),
    Either.filterOrElseWith(
      (input) => input.length >= 3,
      (input) => CombatError.invalidIdentifier(entity, input, 'length must be >= 3')
    ),
    Either.filterOrElseWith(
      (input) => input.length <= 32,
      (input) => CombatError.invalidIdentifier(entity, input, 'length must be <= 32')
    ),
    Either.filterOrElseWith(
      (input) => /^[a-z0-9_-]+$/i.test(input),
      (input) =>
        CombatError.invalidIdentifier(entity, input, 'accepts only alphanumeric characters, underscore, or hyphen')
    ),
    Either.map((input) => input.toLowerCase()),
    Effect.fromEither
  )

const createNumericFactory =
  <A>(options: {
    readonly field: StatField
    readonly min: number
    readonly max: number
    readonly brand: (value: number) => A
  }): ((value: number) => Effect.Effect<A, CombatDomainError>) =>
  (value) => {
    const validated = pipe(
      value,
      Either.right<number, CombatDomainError>,
      Either.filterOrElseWith(Number.isFinite, (invalid) =>
        CombatError.invalidStat(options.field, invalid, 'finite number required')
      ),
      Either.filterOrElseWith(
        (numeric) => numeric >= options.min,
        (invalid) => CombatError.invalidStat(options.field, invalid, `value must be >= ${String(options.min)}`)
      ),
      Either.filterOrElseWith(
        (numeric) => numeric <= options.max,
        (invalid) => CombatError.invalidStat(options.field, invalid, `value must be <= ${String(options.max)}`)
      ),
      Effect.fromEither
    )
    return validated.pipe(Effect.map(options.brand))
  }

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

export const currentTimestamp: Effect.Effect<Timestamp, never> = Clock.currentTimeMillis.pipe(
  Effect.map((millis) => TimestampBrand(millis))
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
