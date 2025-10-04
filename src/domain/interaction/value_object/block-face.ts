import { Schema } from '@effect/schema'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Data, Effect, Either, Match, Option } from 'effect'
import { pipe } from 'effect/Function'
import { Vector3, Vector3Error, fromNumbers, normalize } from './vector3'

const BlockFaceLiteralSchema = Schema.Literal('north', 'south', 'east', 'west', 'up', 'down')

export const BlockFaceSchema = BlockFaceLiteralSchema.pipe(Schema.brand('BlockFace'))

export type BlockFace = Schema.Schema.Type<typeof BlockFaceSchema>

type BlockFaceLiteral = Schema.Schema.To<typeof BlockFaceLiteralSchema>

type Candidate = {
  readonly face: BlockFaceLiteral
  readonly strength: number
}

export const BlockFaceError = Data.taggedEnum({
  SchemaViolation: Data.struct({ message: Schema.String }),
  Indeterminate: Data.struct({ reason: Schema.String }),
})

export type BlockFaceError = typeof BlockFaceError.Type

const decodeFaceEffect = Schema.decode(BlockFaceSchema)
const decodeFaceEither = Schema.decodeEither(BlockFaceSchema)

const formatParseError = (error: Schema.ParseError) =>
  TreeFormatter.formatError(error, { includeStackTrace: false })

const toSchemaViolation = (error: Schema.ParseError) =>
  BlockFaceError.SchemaViolation({ message: formatParseError(error) })

const fromVector3Error = (error: Vector3Error): BlockFaceError =>
  pipe(
    Match.value(error),
    Match.when(
      (candidate): candidate is Extract<Vector3Error, { readonly _tag: 'SchemaViolation' }> =>
        candidate._tag === 'SchemaViolation',
      (candidate) => BlockFaceError.SchemaViolation({ message: candidate.message })
    ),
    Match.when(
      (candidate) => candidate._tag === 'ZeroVector',
      () => BlockFaceError.Indeterminate({ reason: 'ゼロベクトルでは面を特定できません' })
    ),
    Match.exhaustive
  )

const candidates = (vector: Vector3): ReadonlyArray<Candidate> => [
  { face: vector.x >= 0 ? 'east' : 'west', strength: Math.abs(vector.x) },
  { face: vector.y >= 0 ? 'up' : 'down', strength: Math.abs(vector.y) },
  { face: vector.z >= 0 ? 'south' : 'north', strength: Math.abs(vector.z) },
]

const selectDominantFace = (cands: ReadonlyArray<Candidate>) =>
  pipe(
    Option.fromNullable(cands[0]),
    Option.match({
      onNone: () => Effect.fail(BlockFaceError.Indeterminate({ reason: '候補が存在しません' })),
      onSome: (initial) =>
        Effect.reduce(cands.slice(1), initial, (best, candidate) =>
          pipe(
            Effect.succeed(Math.abs(candidate.strength) > Math.abs(best.strength)),
            Effect.flatMap((useCandidate) =>
              useCandidate ? Effect.succeed(candidate) : Effect.succeed(best)
            )
          )
        ),
    })
  )

const fromLiteral = (literal: BlockFaceLiteral) =>
  pipe(decodeFaceEffect(literal), Effect.mapError(toSchemaViolation))

const opposites: Record<BlockFaceLiteral, BlockFaceLiteral> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  up: 'down',
  down: 'up',
}

const normalVectors: Record<BlockFaceLiteral, { readonly x: number; readonly y: number; readonly z: number }> = {
  north: { x: 0, y: 0, z: -1 },
  south: { x: 0, y: 0, z: 1 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 },
}

const ensureNonZeroStrength = (candidate: Candidate) =>
  pipe(
    Effect.succeed(candidate),
    Effect.filterOrFail(
      (value) => Math.abs(value.strength) > 0,
      () => BlockFaceError.Indeterminate({ reason: '方向を決定できません' })
    )
  )

export const fromNormalVector = (vector: Vector3) =>
  pipe(
    normalize(vector),
    Effect.mapError(fromVector3Error),
    Effect.flatMap((unit) =>
      pipe(
        selectDominantFace(candidates(unit)),
        Effect.flatMap(ensureNonZeroStrength),
        Effect.flatMap((candidate) => fromLiteral(candidate.face))
      )
    )
  )

export const safeFromNormalVector = (vector: Vector3) =>
  Effect.runSync(Effect.either(fromNormalVector(vector)))

export const opposite = (face: BlockFace) =>
  pipe(
    Effect.succeed(opposites[face]),
    Effect.flatMap(fromLiteral)
  )

export const toUnitNormal = (face: BlockFace) =>
  pipe(
    Effect.succeed(normalVectors[face]),
    Effect.flatMap((vector) => fromNumbers(vector.x, vector.y, vector.z)),
    Effect.mapError(fromVector3Error)
  )
