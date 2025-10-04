import { Schema } from '@effect/schema'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Effect, Match } from 'effect'
import { pipe } from 'effect/Function'
import { BlockFace, BlockFaceError, fromNormalVector, toUnitNormal } from '../value_object/block-face'
import {
  Vector3,
  Vector3Error,
  clamp,
  dot,
  fromNumbers,
  magnitude,
  normalize,
  translate,
} from '../value_object/vector3'
import {
  InteractionError,
  ProgressSchema,
} from '../types'

const PositiveNumberSchema = Schema.Number.pipe(
  Schema.greaterThan(0, { message: (value) => `正の数が必要です: ${value}` })
)

const NonNegativeNumberSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0, { message: (value) => `0以上の数が必要です: ${value}` })
)

const parseError = (error: Schema.ParseError) =>
  TreeFormatter.formatError(error, { includeStackTrace: false })

const toInvalidCommand = (message: string) =>
  InteractionError.InvalidCommand({ message })

const fromVectorError = (error: Vector3Error) =>
  pipe(
    Match.value(error),
    Match.when(
      (candidate): candidate is Extract<Vector3Error, { readonly _tag: 'SchemaViolation' }> =>
        candidate._tag === 'SchemaViolation',
      (candidate) => toInvalidCommand(candidate.message)
    ),
    Match.when(
      (candidate) => candidate._tag === 'ZeroVector',
      () => toInvalidCommand('ゼロベクトルは利用できません')
    ),
    Match.exhaustive
  )

const fromBlockFaceError = (error: BlockFaceError) =>
  pipe(
    Match.value(error),
    Match.when(
      (candidate): candidate is Extract<BlockFaceError, { readonly _tag: 'SchemaViolation' }> =>
        candidate._tag === 'SchemaViolation',
      (candidate) => toInvalidCommand(candidate.message)
    ),
    Match.when(
      (candidate) => candidate._tag === 'Indeterminate',
      (candidate) => toInvalidCommand(candidate.reason)
    ),
    Match.exhaustive
  )

export const calculateBreakDuration = (input: {
  readonly blockHardness: number
  readonly toolEfficiency: number
  readonly hasteLevel: number
}) =>
  Effect.gen(function* () {
    const hardness = yield* pipe(
      Schema.decode(PositiveNumberSchema)(input.blockHardness),
      Effect.mapError((error) => toInvalidCommand(parseError(error)))
    )

    const efficiency = yield* pipe(
      Schema.decode(PositiveNumberSchema)(input.toolEfficiency),
      Effect.mapError((error) => toInvalidCommand(parseError(error)))
    )

    const haste = yield* pipe(
      Schema.decode(NonNegativeNumberSchema)(input.hasteLevel),
      Effect.mapError((error) => toInvalidCommand(parseError(error)))
    )

    const baseDuration = hardness / efficiency
    const hasteModifier = 1 - Math.min(haste * 0.1, 0.7)
    const clamped = Math.max(baseDuration * hasteModifier, 0.05)

    return clamped
  })

export const validatePlacement = (input: {
  readonly face: BlockFace
  readonly playerPosition: Vector3
  readonly blockPosition: Vector3
}) =>
  Effect.gen(function* () {
    const normal = yield* pipe(toUnitNormal(input.face), Effect.mapError(fromBlockFaceError))

    const offset = yield* pipe(
      fromNumbers(-input.playerPosition.x, -input.playerPosition.y, -input.playerPosition.z),
      Effect.mapError(fromVectorError)
    )

    const delta = yield* pipe(translate(input.blockPosition, offset), Effect.mapError(fromVectorError))

    const alignment = yield* dot(delta, normal)

    yield* pipe(
      Effect.succeed(alignment),
      Effect.filterOrFail(
        (value) => value > 0,
        () => InteractionError.PlacementRejected({ reason: 'プレイヤーが対象ブロックの面とは逆向きです' })
      )
    )

    const distance = yield* pipe(magnitude(delta), Effect.mapError(fromVectorError))

    yield* pipe(
      Effect.succeed(distance),
      Effect.filterOrFail(
        (value) => value <= 6,
        () => InteractionError.PlacementRejected({ reason: 'ブロックまで距離が遠すぎます' })
      )
    )
  })

export const performRaycast = (input: {
  readonly origin: Vector3
  readonly direction: Vector3
  readonly maxDistance: number
  readonly step: number
}) =>
  Effect.gen(function* () {
    const unit = yield* pipe(normalize(input.direction), Effect.mapError(fromVectorError))

    const maxDistance = yield* pipe(
      Schema.decode(PositiveNumberSchema)(input.maxDistance),
      Effect.mapError((error) => toInvalidCommand(parseError(error)))
    )

    const step = yield* pipe(
      Schema.decode(PositiveNumberSchema)(input.step),
      Effect.mapError((error) => toInvalidCommand(parseError(error)))
    )

    const steps = Math.max(1, Math.floor(maxDistance / step))
    const indices: ReadonlyArray<number> = Array.from({ length: steps }, (_, index) => index + 1)

    const initial: Array<Vector3> = []

    const positions = yield* Effect.reduce(indices, initial, (acc, index) =>
      pipe(
        fromNumbers(unit.x * step * index, unit.y * step * index, unit.z * step * index),
        Effect.mapError(fromVectorError),
        Effect.flatMap((offset) => pipe(translate(input.origin, offset), Effect.mapError(fromVectorError))),
        Effect.flatMap((position) => Effect.succeed(acc.concat([position])))
      )
    )

    return positions
  })
