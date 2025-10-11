/**
 * Inventory Validation Domain Service
 *
 * インベントリ検証の統合サービス。
 * 不正状態の検出、整合性チェック、修復提案などの
 * 複雑な検証ロジックを提供します。
 */

import { Context, Effect, Schema } from 'effect'
import { JsonValueSchema } from '@/shared/schema/json'
import type { Inventory, InventoryErrorReason } from '../../types'

// =============================================================================
// Validation Service Types
// =============================================================================

/**
 * 検証結果
 */
export interface ValidationResult {
  readonly isValid: boolean
  readonly violations: ReadonlyArray<ValidationViolation>
  readonly warnings: ReadonlyArray<ValidationWarning>
  readonly correctionSuggestions: ReadonlyArray<CorrectionSuggestion>
  readonly validationSummary: ValidationSummary
}

/**
 * 検証違反
 */
export interface ValidationViolation {
  readonly type: ValidationViolationType
  readonly severity: 'CRITICAL' | 'ERROR' | 'WARNING'
  readonly description: string
  readonly affectedSlots: ReadonlyArray<number>
  readonly detectedValue: unknown
  readonly expectedValue?: unknown
  readonly canAutoCorrect: boolean
}

/**
 * 検証違反の種類
 */
export type ValidationViolationType =
  | 'INVALID_SLOT_COUNT'
  | 'INVALID_STACK_SIZE'
  | 'INVALID_ITEM_ID'
  | 'DUPLICATE_HOTBAR_SLOT'
  | 'HOTBAR_SLOT_OUT_OF_BOUNDS'
  | 'INVALID_ARMOR_SLOT'
  | 'INVALID_SELECTED_SLOT'
  | 'METADATA_CORRUPTION'
  | 'DURABILITY_OUT_OF_RANGE'
  | 'INCONSISTENT_DATA'
  | 'MISSING_REQUIRED_FIELD'

/**
 * 検証警告
 */
export interface ValidationWarning {
  readonly type: string
  readonly description: string
  readonly recommendation: string
  readonly impact: 'PERFORMANCE' | 'USABILITY' | 'MAINTENANCE'
}

/**
 * 修正提案
 */
export interface CorrectionSuggestion {
  readonly description: string
  readonly automated: boolean
  readonly impact: 'LOW' | 'MEDIUM' | 'HIGH'
  readonly prerequisites: ReadonlyArray<string>
  readonly correctionSteps: ReadonlyArray<CorrectionStep>
}

/**
 * 修正ステップ
 */
export interface CorrectionStep {
  readonly action: 'REMOVE' | 'UPDATE' | 'MOVE' | 'RESET'
  readonly target: 'SLOT' | 'METADATA' | 'HOTBAR' | 'ARMOR'
  readonly slotIndex?: number
  readonly newValue?: unknown
  readonly reason: string
}

/**
 * 検証サマリー
 */
export interface ValidationSummary {
  readonly totalSlots: number
  readonly occupiedSlots: number
  readonly emptySlots: number
  readonly uniqueItems: number
  readonly totalItems: number
  readonly healthScore: number // 0-100の健全性スコア
  readonly recommendedActions: ReadonlyArray<string>
}

/**
 * 詳細検証オプション
 */
export interface ValidationOptions {
  readonly checkItemRegistry: boolean
  readonly validateMetadata: boolean
  readonly checkStackLimits: boolean
  readonly verifyHotbarIntegrity: boolean
  readonly validateArmorSlots: boolean
  readonly checkDurabilityRanges: boolean
  readonly detectDuplicates: boolean
  readonly performDeepValidation: boolean
}

// =============================================================================
// Domain Errors
// =============================================================================

export const ValidationErrorSchema = Schema.TaggedStruct('ValidationError', {
  reason: Schema.String,
  details: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Validation Error',
    description: 'Error when inventory validation fails',
  })
)
export type ValidationError = Schema.Schema.Type<typeof ValidationErrorSchema>

/**
 * ValidationErrorのメッセージを取得する操作関数
 */
export const getValidationErrorMessage = (error: ValidationError): string =>
  error.details ? `${error.reason}: ${error.details}` : error.reason

/**
 * ValidationErrorを作成するFactory関数
 */
export const createValidationError = (
  reason: InventoryErrorReason,
  details?: string
): Effect.Effect<ValidationError, Schema.ParseError> =>
  Schema.decode(ValidationErrorSchema)({
    _tag: 'ValidationError' as const,
    reason,
    details,
  })

/**
 * 型ガード関数
 */
export const isValidationError = (error: unknown): error is ValidationError => Schema.is(ValidationErrorSchema)(error)

export const CorrectionErrorSchema = Schema.TaggedStruct('CorrectionError', {
  failedCorrections: Schema.Array(
    Schema.Struct({
      step: Schema.Struct({
        action: Schema.Literal('REMOVE', 'UPDATE', 'MOVE', 'RESET'),
        target: Schema.Literal('SLOT', 'METADATA', 'HOTBAR', 'ARMOR'),
        slotIndex: Schema.optional(Schema.Number),
        newValue: Schema.optional(JsonValueSchema),
        reason: Schema.String,
      }),
      error: Schema.String,
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Correction Error',
    description: 'Error when auto-correction of inventory issues fails',
  })
)
export type CorrectionError = Schema.Schema.Type<typeof CorrectionErrorSchema>

/**
 * CorrectionErrorのメッセージを取得する操作関数
 */
export const getCorrectionErrorMessage = (error: CorrectionError): string =>
  `Correction failed with ${error.failedCorrections.length} failed corrections`

/**
 * CorrectionErrorを作成するFactory関数
 */
export const createCorrectionError = (
  failedCorrections: ReadonlyArray<{
    step: CorrectionStep
    error: string
  }>
): Effect.Effect<CorrectionError, Schema.ParseError> =>
  Schema.decode(CorrectionErrorSchema)({
    _tag: 'CorrectionError' as const,
    failedCorrections,
  })

/**
 * 型ガード関数
 */
export const isCorrectionError = (error: unknown): error is CorrectionError => Schema.is(CorrectionErrorSchema)(error)

// =============================================================================
// Validation Service Interface
// =============================================================================

/**
 * インベントリ検証ドメインサービス
 *
 * インベントリの整合性、有効性、最適化可能性を検証する統合サービス。
 * DDD原則に従い、純粋なドメインロジックのみを含み、技術的詳細は排除。
 *
 * 責務:
 * - インベントリ構造の整合性検証
 * - アイテムデータの有効性チェック
 * - ホットバー・防具スロットの検証
 * - 不正状態の検出と修復提案
 * - パフォーマンス影響の分析
 *
 * 設計原則:
 * - 包括的な検証ルールの適用
 * - 自動修復可能な問題の特定
 * - 段階的な検証レベルの提供
 * - 詳細な診断情報の提供
 */
export interface ValidationService {
  /**
   * 包括的インベントリ検証
   *
   * インベントリの全側面を検証し、問題点と修正提案を提供する。
   * 最も包括的な検証を行う主要メソッド。
   *
   * @param inventory - 検証対象のインベントリ
   * @param options - 検証オプション
   * @returns 詳細な検証結果
   *
   * @example
   * ```typescript
   * const result = yield* validationService.validateInventory(inventory, {
   *   checkItemRegistry: true,
   *   validateMetadata: true,
   *   checkStackLimits: true,
   *   verifyHotbarIntegrity: true,
   *   validateArmorSlots: true,
   *   checkDurabilityRanges: true,
   *   detectDuplicates: true,
   *   performDeepValidation: true
   * })
   *
   * if (!result.isValid) {
   *   yield* Effect.log(`検証失敗: ${result.violations.length}個の違反を検出`)
   *   for (const violation of result.violations) {
   *     yield* Effect.log(`- ${violation.description}`)
   *   }
   * }
   * ```
   */
  readonly validateInventory: (
    inventory: Inventory,
    options: ValidationOptions
  ) => Effect.Effect<ValidationResult, ValidationError>

  /**
   * 高速整合性チェック
   *
   * 基本的な整合性のみを高速でチェックする。
   * パフォーマンスが重要な場面で使用。
   *
   * @param inventory - 検証対象のインベントリ
   * @returns 基本的な検証結果
   *
   * @example
   * ```typescript
   * const isValid = yield* validationService.quickIntegrityCheck(inventory)
   * if (!isValid) {
   *   yield* Effect.log('インベントリに基本的な問題があります')
   * }
   * ```
   */
  readonly quickIntegrityCheck: (inventory: Inventory) => Effect.Effect<boolean, never>

  /**
   * 特定スロットの検証
   *
   * 指定されたスロットの内容を詳細に検証する。
   * 個別アイテムの問題を特定する際に使用。
   *
   * @param inventory - 対象のインベントリ
   * @param slotIndex - 検証するスロットのインデックス
   * @returns スロット固有の検証結果
   *
   * @example
   * ```typescript
   * const result = yield* validationService.validateSlot(inventory, 5)
   * if (result.violations.length > 0) {
   *   yield* Effect.log(`スロット5に問題: ${result.violations[0].description}`)
   * }
   * ```
   */
  readonly validateSlot: (
    inventory: Inventory,
    slotIndex: number
  ) => Effect.Effect<
    {
      readonly isValid: boolean
      readonly violations: ReadonlyArray<ValidationViolation>
      readonly suggestions: ReadonlyArray<CorrectionSuggestion>
    },
    ValidationError
  >

  /**
   * ホットバー整合性検証
   *
   * ホットバーの参照整合性と設定の有効性をチェックする。
   * ホットバー固有の問題を検出。
   *
   * @param inventory - 対象のインベントリ
   * @returns ホットバー検証結果
   *
   * @example
   * ```typescript
   * const result = yield* validationService.validateHotbar(inventory)
   * if (!result.isValid) {
   *   yield* Effect.log('ホットバー設定に問題があります')
   * }
   * ```
   */
  readonly validateHotbar: (inventory: Inventory) => Effect.Effect<
    {
      readonly isValid: boolean
      readonly invalidSlots: ReadonlyArray<number>
      readonly duplicateReferences: ReadonlyArray<number>
      readonly outOfBoundsReferences: ReadonlyArray<number>
      readonly recommendations: ReadonlyArray<string>
    },
    never
  >

  /**
   * 防具スロット検証
   *
   * 防具スロットの内容と適切性を検証する。
   * 装備可能性と互換性をチェック。
   *
   * @param inventory - 対象のインベントリ
   * @returns 防具検証結果
   *
   * @example
   * ```typescript
   * const result = yield* validationService.validateArmorSlots(inventory)
   * for (const issue of result.issues) {
   *   yield* Effect.log(`防具問題: ${issue.description}`)
   * }
   * ```
   */
  readonly validateArmorSlots: (inventory: Inventory) => Effect.Effect<
    {
      readonly isValid: boolean
      readonly issues: ReadonlyArray<{
        readonly slot: 'helmet' | 'chestplate' | 'leggings' | 'boots'
        readonly issue: string
        readonly severity: 'ERROR' | 'WARNING'
        readonly suggestion?: string
      }>
    },
    never
  >

  /**
   * 自動修正の実行
   *
   * 検出された問題のうち自動修正可能なものを修正する。
   * 修正前に影響分析を行い、安全性を確認。
   *
   * @param inventory - 修正対象のインベントリ
   * @param suggestions - 実行する修正提案
   * @param dryRun - 実際に修正せず、結果のみ返すかどうか
   * @returns 修正結果
   *
   * @example
   * ```typescript
   * const corrections = yield* validationService.autoCorrectIssues(
   *   inventory,
   *   validationResult.correctionSuggestions.filter(s => s.automated),
   *   false // 実際に修正実行
   * )
   *
   * yield* Effect.log(`${corrections.appliedCorrections.length}個の問題を修正`)
   * ```
   */
  readonly autoCorrectIssues: (
    inventory: Inventory,
    suggestions: ReadonlyArray<CorrectionSuggestion>,
    dryRun?: boolean
  ) => Effect.Effect<
    {
      readonly correctedInventory: Inventory
      readonly appliedCorrections: ReadonlyArray<CorrectionSuggestion>
      readonly failedCorrections: ReadonlyArray<{
        suggestion: CorrectionSuggestion
        reason: string
      }>
      readonly impactAnalysis: {
        readonly itemsAffected: number
        readonly slotsModified: number
        readonly functionalityImpact: 'NONE' | 'MINOR' | 'MODERATE' | 'MAJOR'
      }
    },
    CorrectionError
  >

  /**
   * インベントリ健全性スコア計算
   *
   * インベントリの全体的な健全性を0-100のスコアで評価する。
   * 継続的な監視や最適化の指標として使用。
   *
   * @param inventory - 評価対象のインベントリ
   * @returns 健全性スコアと詳細
   *
   * @example
   * ```typescript
   * const health = yield* validationService.calculateHealthScore(inventory)
   * yield* Effect.log(`インベントリ健全性: ${health.score}/100`)
   *
   * if (health.score < 80) {
   *   yield* Effect.log('最適化をお勧めします')
   * }
   * ```
   */
  readonly calculateHealthScore: (inventory: Inventory) => Effect.Effect<
    {
      readonly score: number
      readonly factors: ReadonlyArray<{
        readonly name: string
        readonly score: number
        readonly weight: number
        readonly description: string
      }>
      readonly improvementSuggestions: ReadonlyArray<string>
    },
    never
  >

  /**
   * 検証パフォーマンス統計
   *
   * 検証処理のパフォーマンス統計を取得する。
   * 最適化と監視目的で使用。
   *
   * @returns パフォーマンス統計情報
   */
  readonly getValidationPerformanceStats: () => Effect.Effect<
    {
      readonly totalValidations: number
      readonly averageValidationTime: number
      readonly cacheHitRate: number
      readonly mostCommonViolationType: ValidationViolationType | null
      readonly validationThroughput: number
    },
    never
  >
}

// =============================================================================
// Service Tag Definition
// =============================================================================

/**
 * ValidationService用のContextタグ
 *
 * Effect-TSの依存注入システムで使用される。
 * Layer.provideで実装を注入し、Effect.genで取得する。
 *
 * @example
 * ```typescript
 * // サービスの使用
 * const result = yield* ValidationService.validateInventory(inventory, options)
 *
 * // レイヤーでの提供
 * const ValidationServiceLive = Layer.effect(
 *   ValidationService,
 *   Effect.gen(function* () {
 *     // 実装を返す
 *     return new ValidationServiceImpl()
 *   })
 * )
 * ```
 */
export const ValidationService = Context.GenericTag<ValidationService>('@minecraft/domain/inventory/ValidationService')

// =============================================================================
// Type Exports
// =============================================================================

export type {
  CorrectionStep,
  CorrectionSuggestion,
  ValidationOptions,
  ValidationResult,
  ValidationSummary,
  ValidationViolation,
  ValidationViolationType,
  ValidationWarning,
}
