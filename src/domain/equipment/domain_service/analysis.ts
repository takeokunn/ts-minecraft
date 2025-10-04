import { Effect } from 'effect'
import type { EquipmentSet } from '../aggregate/equipment_set'
import { equipmentSlotLiterals } from '../value_object/slot'

export interface EquipmentAnalysisSummary {
  readonly totalWeight: number
  readonly offensiveScore: number
  readonly defensiveScore: number
  readonly occupiedSlots: number
}

export const analyseEquipmentSet = (
  set: EquipmentSet
): Effect.Effect<EquipmentAnalysisSummary> =>
  Effect.gen(function* () {
    const pieces = equipmentSlotLiterals
      .map((slot) => set.slots[slot])
      .filter((piece): piece is NonNullable<typeof piece> => piece !== undefined)

    const totalWeight = pieces.reduce((total, piece) => total + piece.weight, 0)
    const offensiveScore = pieces.reduce((total, piece) => total + piece.stats.attack, 0)
    const defensiveScore = pieces.reduce((total, piece) => total + piece.stats.defense, 0)

    return {
      totalWeight,
      offensiveScore,
      defensiveScore,
      occupiedSlots: pieces.length,
    }
  })
