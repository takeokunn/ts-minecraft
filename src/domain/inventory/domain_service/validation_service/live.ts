/**
 * Validation Service Live Implementation
 *
 * インベントリ検証ドメインサービスの純粋なドメインロジック実装。
 * Effect-TSパターンに従い、包括的な検証機能を提供します。
 */

import { Effect, Layer } from 'effect'
import type { Inventory } from '../../types'
import { ValidationError, ValidationService, type CorrectionSuggestion, type ValidationResult } from './service'
import { runAllValidators } from './validators'

/**
 * 検証サービスのLive実装
 */
export const ValidationServiceLive = Layer.succeed(
  ValidationService,
  ValidationService.of({
    /**
     * 包括的インベントリ検証
     */
    validateInventory: (inventory, options) =>
      Effect.gen(function* () {
        const violations = yield* runAllValidators(inventory, options)
        const warnings = yield* generateWarnings(inventory)
        const suggestions = yield* generateCorrectionSuggestions(violations)
        const summary = yield* generateValidationSummary(inventory, violations)

        return {
          isValid: violations.length === 0,
          violations,
          warnings,
          correctionSuggestions: suggestions,
          validationSummary: summary,
        }
      }),

    /**
     * 高速整合性チェック
     */
    quickIntegrityCheck: (inventory) =>
      Effect.gen(function* () {
        // 基本的なチェックのみ実行
        const hasValidSlotCount = inventory.slots.length === 36
        const hasValidHotbar = inventory.hotbar.length === 9
        const hasValidSelection = inventory.selectedSlot >= 0 && inventory.selectedSlot <= 8

        return hasValidSlotCount && hasValidHotbar && hasValidSelection
      }),

    /**
     * 特定スロットの検証
     */
    validateSlot: (inventory, slotIndex) =>
      Effect.gen(function* () {
        if (slotIndex < 0 || slotIndex >= inventory.slots.length) {
          yield* Effect.fail(new ValidationError('INVALID_SLOT_INDEX', `Slot ${slotIndex} out of bounds`))
        }

        const violations = yield* validateSingleSlot(inventory, slotIndex)
        const suggestions = yield* generateSlotSuggestions(violations)

        return {
          isValid: violations.length === 0,
          violations,
          suggestions,
        }
      }),

    /**
     * ホットバー整合性検証
     */
    validateHotbar: (inventory) =>
      Effect.gen(function* () {
        const invalidSlots: number[] = []
        const duplicateReferences: number[] = []
        const outOfBoundsReferences: number[] = []

        // 重複チェック
        const seen = new Set<number>()
        for (const slot of inventory.hotbar) {
          if (seen.has(slot)) {
            duplicateReferences.push(slot)
          } else {
            seen.add(slot)
          }
        }

        // 範囲外チェック
        for (const slot of inventory.hotbar) {
          if (slot < 0 || slot >= 36) {
            outOfBoundsReferences.push(slot)
          }
        }

        return {
          isValid: duplicateReferences.length === 0 && outOfBoundsReferences.length === 0,
          invalidSlots,
          duplicateReferences,
          outOfBoundsReferences,
          recommendations: generateHotbarRecommendations(duplicateReferences, outOfBoundsReferences),
        }
      }),

    /**
     * 防具スロット検証
     */
    validateArmorSlots: (inventory) =>
      Effect.gen(function* () {
        const issues: Array<{
          slot: 'helmet' | 'chestplate' | 'leggings' | 'boots'
          issue: string
          severity: 'ERROR' | 'WARNING'
          suggestion?: string
        }> = []

        const armorSlots = [
          { name: 'helmet' as const, item: inventory.armor.helmet },
          { name: 'chestplate' as const, item: inventory.armor.chestplate },
          { name: 'leggings' as const, item: inventory.armor.leggings },
          { name: 'boots' as const, item: inventory.armor.boots },
        ]

        for (const { name, item } of armorSlots) {
          if (item !== null && !item.itemId.includes(name)) {
            issues.push({
              slot: name,
              issue: `Invalid armor type: ${item.itemId}`,
              severity: 'ERROR',
              suggestion: `Replace with valid ${name} item`,
            })
          }
        }

        return {
          isValid: issues.length === 0,
          issues,
        }
      }),

    /**
     * 自動修正の実行
     */
    autoCorrectIssues: (inventory, suggestions, dryRun = false) =>
      Effect.gen(function* () {
        const appliedCorrections: CorrectionSuggestion[] = []
        const failedCorrections: Array<{ suggestion: CorrectionSuggestion; reason: string }> = []
        let correctedInventory = inventory

        for (const suggestion of suggestions) {
          if (suggestion.automated) {
            try {
              if (!dryRun) {
                correctedInventory = yield* applyCorrectionSuggestion(correctedInventory, suggestion)
              }
              appliedCorrections.push(suggestion)
            } catch (error) {
              failedCorrections.push({
                suggestion,
                reason: error instanceof Error ? error.message : 'Unknown error',
              })
            }
          }
        }

        const impactAnalysis = yield* analyzeImpact(inventory, correctedInventory)

        return {
          correctedInventory,
          appliedCorrections,
          failedCorrections,
          impactAnalysis,
        }
      }),

    /**
     * インベントリ健全性スコア計算
     */
    calculateHealthScore: (inventory) =>
      Effect.gen(function* () {
        const factors = [
          { name: 'Structure Integrity', weight: 0.3, calculator: calculateStructureScore },
          { name: 'Data Consistency', weight: 0.2, calculator: calculateConsistencyScore },
          { name: 'Optimization Level', weight: 0.2, calculator: calculateOptimizationScore },
          { name: 'Usability', weight: 0.3, calculator: calculateUsabilityScore },
        ]

        let totalScore = 0
        const factorResults: Array<{
          name: string
          score: number
          weight: number
          description: string
        }> = []

        for (const factor of factors) {
          const score = yield* factor.calculator(inventory)
          totalScore += score * factor.weight
          factorResults.push({
            name: factor.name,
            score,
            weight: factor.weight,
            description: `${factor.name} assessment`,
          })
        }

        return {
          score: Math.round(totalScore),
          factors: factorResults,
          improvementSuggestions: yield* generateImprovementSuggestions(totalScore, factorResults),
        }
      }),

    /**
     * 検証パフォーマンス統計
     */
    getValidationPerformanceStats: () =>
      Effect.gen(function* () {
        return {
          totalValidations: 0,
          averageValidationTime: 0,
          cacheHitRate: 0,
          mostCommonViolationType: null,
          validationThroughput: 0,
        }
      }),
  })
)

// =============================================================================
// Helper Functions
// =============================================================================

const generateWarnings = (inventory: Inventory): Effect.Effect<ValidationResult['warnings'], never> =>
  Effect.gen(function* () {
    const warnings: ValidationResult['warnings'] = []

    // 使用率の警告
    const occupiedSlots = inventory.slots.filter((slot) => slot !== null).length
    const usageRate = occupiedSlots / inventory.slots.length

    if (usageRate > 0.9) {
      warnings.push({
        type: 'HIGH_USAGE',
        description: 'Inventory is nearly full',
        recommendation: 'Consider consolidating items or using storage',
        impact: 'USABILITY',
      })
    }

    return warnings
  })

const generateCorrectionSuggestions = (
  violations: ValidationResult['violations']
): Effect.Effect<CorrectionSuggestion[], never> =>
  Effect.gen(function* () {
    const suggestions: CorrectionSuggestion[] = []

    for (const violation of violations) {
      if (violation.canAutoCorrect) {
        suggestions.push({
          description: `Auto-fix: ${violation.description}`,
          automated: true,
          impact: violation.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          prerequisites: [],
          correctionSteps: [
            {
              action: 'UPDATE',
              target: 'SLOT',
              slotIndex: violation.affectedSlots[0],
              newValue: violation.expectedValue,
              reason: violation.description,
            },
          ],
        })
      }
    }

    return suggestions
  })

const generateValidationSummary = (
  inventory: Inventory,
  violations: ValidationResult['violations']
): Effect.Effect<ValidationResult['validationSummary'], never> =>
  Effect.gen(function* () {
    const occupiedSlots = inventory.slots.filter((slot) => slot !== null).length
    const uniqueItems = new Set(inventory.slots.filter((slot) => slot !== null).map((slot) => slot!.itemId)).size
    const totalItems = inventory.slots.reduce((sum, slot) => sum + (slot?.count ?? 0), 0)

    return {
      totalSlots: inventory.slots.length,
      occupiedSlots,
      emptySlots: inventory.slots.length - occupiedSlots,
      uniqueItems,
      totalItems,
      healthScore: violations.length === 0 ? 100 : Math.max(0, 100 - violations.length * 10),
      recommendedActions: violations.map((v) => v.description),
    }
  })

const validateSingleSlot = (
  inventory: Inventory,
  slotIndex: number
): Effect.Effect<ValidationResult['violations'], never> =>
  Effect.gen(function* () {
    const violations: ValidationResult['violations'] = []
    const slot = inventory.slots[slotIndex]

    if (slot !== null) {
      if (slot.count <= 0 || slot.count > 64) {
        violations.push({
          type: 'INVALID_STACK_SIZE',
          severity: 'ERROR',
          description: `Invalid stack size: ${slot.count}`,
          affectedSlots: [slotIndex],
          detectedValue: slot.count,
          expectedValue: 'between 1 and 64',
          canAutoCorrect: true,
        })
      }
    }

    return violations
  })

const generateSlotSuggestions = (
  violations: ValidationResult['violations']
): Effect.Effect<CorrectionSuggestion[], never> =>
  Effect.gen(function* () {
    return violations.map((violation) => ({
      description: `Fix ${violation.type}`,
      automated: violation.canAutoCorrect,
      impact: 'MEDIUM' as const,
      prerequisites: [],
      correctionSteps: [
        {
          action: 'UPDATE' as const,
          target: 'SLOT' as const,
          reason: violation.description,
        },
      ],
    }))
  })

const generateHotbarRecommendations = (duplicates: number[], outOfBounds: number[]): string[] => {
  const recommendations: string[] = []

  if (duplicates.length > 0) {
    recommendations.push('Remove duplicate hotbar slot references')
  }

  if (outOfBounds.length > 0) {
    recommendations.push('Fix out-of-bounds hotbar slot references')
  }

  return recommendations
}

const applyCorrectionSuggestion = (
  inventory: Inventory,
  suggestion: CorrectionSuggestion
): Effect.Effect<Inventory, Error> =>
  Effect.gen(function* () {
    // 自動修正の実装（基本的な例）
    return inventory // プレースホルダー実装
  })

const analyzeImpact = (
  originalInventory: Inventory,
  correctedInventory: Inventory
): Effect.Effect<
  {
    itemsAffected: number
    slotsModified: number
    functionalityImpact: 'NONE' | 'MINOR' | 'MODERATE' | 'MAJOR'
  },
  never
> =>
  Effect.gen(function* () {
    return {
      itemsAffected: 0,
      slotsModified: 0,
      functionalityImpact: 'NONE' as const,
    }
  })

const calculateStructureScore = (inventory: Inventory): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    return inventory.slots.length === 36 ? 100 : 0
  })

const calculateConsistencyScore = (inventory: Inventory): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    return 100 // プレースホルダー
  })

const calculateOptimizationScore = (inventory: Inventory): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    return 100 // プレースホルダー
  })

const calculateUsabilityScore = (inventory: Inventory): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    return 100 // プレースホルダー
  })

const generateImprovementSuggestions = (
  totalScore: number,
  factors: Array<{ name: string; score: number }>
): Effect.Effect<string[], never> =>
  Effect.gen(function* () {
    const suggestions: string[] = []

    if (totalScore < 80) {
      suggestions.push('Consider optimizing inventory layout')
    }

    return suggestions
  })
