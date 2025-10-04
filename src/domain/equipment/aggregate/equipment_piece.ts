import { Schema } from '@effect/schema'
import { Effect, Match } from 'effect'
import type {
  EquipmentDescription,
  EquipmentDomainError,
  EquipmentId,
  EquipmentName,
  UnixTime,
  WeightKg,
} from '../types/core'
import {
  EquipmentDescriptionSchema,
  EquipmentIdSchema,
  EquipmentNameSchema,
  UnixTimeSchema,
  WeightSchema,
  makeRequirementViolation,
  makeSchemaViolation,
} from '../types/core'
import {
  EquipmentStatsSchema,
  EquipmentTierSchema,
  applyTierWeight,
  mergeStats,
  type EquipmentStats,
  type EquipmentTier,
} from '../value_object/item_attributes'
import { EquipmentSlotSchema, ensureSlotAllowed, getSlotCategory, type EquipmentSlot } from '../value_object/slot'

export const EquipmentTagSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z_]+(?::[a-z_]+)?$/i),
  Schema.maxLength(64),
  Schema.brand('EquipmentTag')
)

export type EquipmentTag = Schema.Schema.Type<typeof EquipmentTagSchema>

export const EquipmentPieceSchema = Schema.Struct({
  id: EquipmentIdSchema,
  name: EquipmentNameSchema,
  description: Schema.optional(EquipmentDescriptionSchema),
  slot: EquipmentSlotSchema,
  tier: EquipmentTierSchema,
  stats: EquipmentStatsSchema,
  weight: WeightSchema,
  tags: Schema.Array(EquipmentTagSchema),
  createdAt: UnixTimeSchema,
  updatedAt: UnixTimeSchema,
})
export type EquipmentPiece = Schema.Schema.Type<typeof EquipmentPieceSchema>

export interface EquipmentPieceComponents {
  readonly id: EquipmentId
  readonly name: EquipmentName
  readonly description?: EquipmentDescription
  readonly slot: EquipmentSlot
  readonly tier: EquipmentTier
  readonly stats: EquipmentStats
  readonly weight: WeightKg
  readonly tags: ReadonlyArray<EquipmentTag>
  readonly createdAt: UnixTime
  readonly updatedAt: UnixTime
}

const decodePiece = Schema.decodeUnknown(EquipmentPieceSchema)
const decodePieceSync = Schema.decodeUnknownSync(EquipmentPieceSchema)

const pieceError = (message: string): EquipmentDomainError => makeSchemaViolation({ field: 'EquipmentPiece', message })

export const createEquipmentPiece = (
  components: EquipmentPieceComponents
): Effect.Effect<EquipmentPiece, EquipmentDomainError> =>
  Effect.gen(function* () {
    const primaryTag = components.tags[0]
    if (primaryTag !== undefined) {
      yield* ensureSlotAllowed(components.slot, primaryTag)
    }

    const adjustedWeight = applyTierWeight(components.tier, components.weight)
    const mergedStats = mergeStats([components.stats])

    return yield* decodePiece({
      ...components,
      stats: mergedStats,
      weight: adjustedWeight,
    }).pipe(Effect.mapError(() => pieceError('invalid equipment piece components')))
  })

export const withUpdatedTimestamp = (piece: EquipmentPiece, timestamp: UnixTime): EquipmentPiece =>
  decodePieceSync({ ...piece, updatedAt: timestamp })

export const assignBonusStats = (piece: EquipmentPiece, bonus: EquipmentStats): EquipmentPiece =>
  decodePieceSync({
    ...piece,
    stats: mergeStats([piece.stats, bonus]),
  })

export const promoteTier = (piece: EquipmentPiece, nextTier: EquipmentTier): EquipmentPiece =>
  decodePieceSync({
    ...piece,
    tier: nextTier,
    weight: applyTierWeight(nextTier, piece.weight),
  })

export const ensureFitsSlot = (
  piece: EquipmentPiece,
  targetSlot: EquipmentSlot
): Effect.Effect<EquipmentPiece, EquipmentDomainError> =>
  Match.value(piece.slot).pipe(
    Match.when(targetSlot, () => Effect.succeed(piece)),
    Match.orElse(() =>
      Effect.gen(function* () {
        const currentCategory = yield* getSlotCategory(piece.slot)
        const targetCategory = yield* getSlotCategory(targetSlot)
        return yield* Match.value(currentCategory._tag === targetCategory._tag).pipe(
          Match.when(true, () => Effect.succeed(piece)),
          Match.orElse(() =>
            Effect.fail(
              makeRequirementViolation({
                requirement: targetCategory._tag,
                detail: `slot mismatch: ${piece.slot} cannot be equipped in ${targetSlot}`,
              })
            )
          )
        )
      })
    )
  )
