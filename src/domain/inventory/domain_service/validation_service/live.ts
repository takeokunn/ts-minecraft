/**
 * Validation Service Live Implementation
 *
 * インベントリ検証ドメインサービスの純粋なドメインロジック実装。
 * Effect-TSパターンに従い、包括的な検証機能を提供します。
 */

import { Effect, HashSet, Layer, pipe, ReadonlyArray } from 'effect'
import type { Inventory } from '../../types'
import {
  runAllValidators,
  ValidationError,
  ValidationService,
  type CorrectionSuggestion,
  type ValidationResult,
} from './index'

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
        // Match.whenによる範囲チェック
        yield* pipe(
          Match.value(slotIndex >= 0 && slotIndex < inventory.slots.length),
          Match.when(false, () =>
            Effect.fail(new ValidationError('INVALID_SLOT_INDEX', `Slot ${slotIndex} out of bounds`))
          ),
          Match.orElse(() => Effect.void)
        )

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

        // 重複チェック
        const duplicateResult = pipe(
          inventory.hotbar,
          ReadonlyArray.reduce(
            { seen: HashSet.empty<number>(), duplicates: [] as const satisfies readonly number[] } as {
              seen: HashSet.HashSet<number>
              duplicates: readonly number[]
            },
            (acc, slot) =>
              HashSet.has(acc.seen, slot)
                ? { ...acc, duplicates: [...acc.duplicates, slot] }
                : { ...acc, seen: HashSet.add(acc.seen, slot) }
          )
        )
        const duplicateReferences = duplicateResult.duplicates

        // 範囲外チェック
        const outOfBoundsReferences = pipe(
          inventory.hotbar,
          ReadonlyArray.filter((slot) => slot < 0 || slot >= 36)
        )

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
        const armorSlots = [
          { name: 'helmet' as const, item: inventory.armor.helmet },
          { name: 'chestplate' as const, item: inventory.armor.chestplate },
          { name: 'leggings' as const, item: inventory.armor.leggings },
          { name: 'boots' as const, item: inventory.armor.boots },
        ]

        const issues = pipe(
          armorSlots,
          ReadonlyArray.filterMap(({ name, item }) =>
            item !== null && !item.itemId.includes(name)
              ? ReadonlyArray.of({
                  slot: name,
                  issue: `Invalid armor type: ${item.itemId}`,
                  severity: 'ERROR' as const,
                  suggestion: `Replace with valid ${name} item`,
                })
              : ReadonlyArray.empty()
          ),
          ReadonlyArray.flatten
        )

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
        const automatedSuggestions = pipe(
          suggestions,
          ReadonlyArray.filter((s) => s.automated)
        )

        const results = yield* Effect.forEach(
          automatedSuggestions,
          (suggestion) =>
            Effect.gen(function* () {
              // Match.whenによるdryRun分岐
              return yield* pipe(
                Match.value(dryRun),
                Match.when(true, () => Effect.succeed({ type: 'applied' as const, suggestion, inventory })),
                Match.orElse(() =>
                  pipe(
                    applyCorrectionSuggestion(inventory, suggestion),
                    Effect.map((inv) => ({ type: 'applied' as const, suggestion, inventory: inv })),
                    Effect.catchAll((error) =>
                      Effect.succeed({
                        type: 'failed' as const,
                        suggestion,
                        reason: error instanceof Error ? error.message : 'Unknown error',
                      })
                    )
                  )
                )
              )
            }),
          { concurrency: 4 }
        )

        const appliedCorrections = pipe(
          results,
          ReadonlyArray.filter((r) => r.type === 'applied'),
          ReadonlyArray.map((r) => r.suggestion)
        )
        const failedCorrections = pipe(
          results,
          ReadonlyArray.filterMap((r) =>
            r.type === 'failed'
              ? ReadonlyArray.of({ suggestion: r.suggestion, reason: r.reason })
              : ReadonlyArray.empty()
          ),
          ReadonlyArray.flatten
        )
        const correctedInventory = pipe(
          results,
          ReadonlyArray.findLast((r) => r.type === 'applied'),
          ReadonlyArray.match({
            onEmpty: () => inventory,
            onNonEmpty: (arr) => arr[arr.length - 1].inventory,
          })
        )

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

        const factorResults = yield* Effect.forEach(
          factors,
          (factor) =>
            Effect.gen(function* () {
              const score = yield* factor.calculator(inventory)
              return {
                name: factor.name,
                score,
                weight: factor.weight,
                description: `${factor.name} assessment`,
              }
            }),
          { concurrency: 4 }
        )

        const totalScore = pipe(
          factorResults,
          ReadonlyArray.reduce(0, (acc, result) => acc + result.score * result.weight)
        )

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

    // Match.whenによる条件付き警告追加
    yield* pipe(
      Match.value(usageRate > 0.9),
      Match.when(true, () =>
        Effect.sync(() => {
          warnings.push({
            type: 'HIGH_USAGE',
            description: 'Inventory is nearly full',
            recommendation: 'Consider consolidating items or using storage',
            impact: 'USABILITY',
          })
        })
      ),
      Match.orElse(() => Effect.void)
    )

    return warnings
  })

const generateCorrectionSuggestions = (
  violations: ValidationResult['violations']
): Effect.Effect<CorrectionSuggestion[], never> =>
  Effect.gen(function* () {
    return pipe(
      violations,
      ReadonlyArray.filterMap((violation) =>
        violation.canAutoCorrect
          ? ReadonlyArray.of({
              description: `Auto-fix: ${violation.description}`,
              automated: true,
              impact: violation.severity === 'CRITICAL' ? ('HIGH' as const) : ('MEDIUM' as const),
              prerequisites: [],
              correctionSteps: [
                {
                  action: 'UPDATE' as const,
                  target: 'SLOT' as const,
                  slotIndex: violation.affectedSlots[0],
                  newValue: violation.expectedValue,
                  reason: violation.description,
                },
              ],
            })
          : ReadonlyArray.empty()
      ),
      ReadonlyArray.flatten
    )
  })

const generateValidationSummary = (
  inventory: Inventory,
  violations: ValidationResult['violations']
): Effect.Effect<ValidationResult['validationSummary'], never> =>
  Effect.gen(function* () {
    const occupiedSlots = pipe(
      inventory.slots,
      ReadonlyArray.filter((slot) => slot !== null)
    ).length

    const uniqueItems = pipe(
      inventory.slots,
      ReadonlyArray.filterMap((slot) => (slot !== null ? ReadonlyArray.of(slot.itemId) : ReadonlyArray.empty())),
      ReadonlyArray.flatten,
      (items) => HashSet.fromIterable(items),
      HashSet.size
    )

    const totalItems = pipe(
      inventory.slots,
      ReadonlyArray.reduce(0, (sum, slot) => sum + (slot?.count ?? 0))
    )

    return {
      totalSlots: inventory.slots.length,
      occupiedSlots,
      emptySlots: inventory.slots.length - occupiedSlots,
      uniqueItems,
      totalItems,
      healthScore: violations.length === 0 ? 100 : Math.max(0, 100 - violations.length * 10),
      recommendedActions: pipe(
        violations,
        ReadonlyArray.map((v) => v.description)
      ),
    }
  })

const validateSingleSlot = (
  inventory: Inventory,
  slotIndex: number
): Effect.Effect<ValidationResult['violations'], never> =>
  Effect.gen(function* () {
    const violations: ValidationResult['violations'] = []
    const slot = inventory.slots[slotIndex]

    // Option.matchによるnullチェック + Match.whenによるスタックサイズ検証
    yield* pipe(
      Option.fromNullable(slot),
      Option.match({
        onNone: () => Effect.void,
        onSome: (stackSlot) =>
          pipe(
            Match.value(stackSlot.count > 0 && stackSlot.count <= 64),
            Match.when(false, () =>
              Effect.sync(() => {
                violations.push({
                  type: 'INVALID_STACK_SIZE',
                  severity: 'ERROR',
                  description: `Invalid stack size: ${stackSlot.count}`,
                  affectedSlots: [slotIndex],
                  detectedValue: stackSlot.count,
                  expectedValue: 'between 1 and 64',
                  canAutoCorrect: true,
                })
              })
            ),
            Match.orElse(() => Effect.void)
          ),
      })
    )

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
