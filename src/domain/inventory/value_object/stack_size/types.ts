import { Brand, Data } from 'effect'

/**
 * StackSize Brand型（1-64制約）
 */
export type StackSize = Brand.Brand<number, 'StackSize'> & {
  readonly min: 1
  readonly max: 64
}

/**
 * MaxStackSize Brand型（アイテム種別ごとの最大スタック数）
 */
export type MaxStackSize = Brand.Brand<number, 'MaxStackSize'> & {
  readonly min: 1
  readonly max: 64
  readonly category: 'single' | 'tool' | 'food' | 'material' | 'block'
}

/**
 * スタック可能性の判定結果ADT
 */
export type StackabilityResult = Data.TaggedEnum<{
  FullyStackable: { readonly combinedSize: StackSize }
  PartiallyStackable: { readonly stackedSize: StackSize; readonly remainder: StackSize }
  NotStackable: { readonly reason: string }
}>

/**
 * StackabilityResult コンストラクタ
 */
export const StackabilityResult = Data.taggedEnum<StackabilityResult>()

/**
 * スタック操作の種類ADT
 */
export type StackOperation = Data.TaggedEnum<{
  Add: { readonly amount: StackSize }
  Remove: { readonly amount: StackSize }
  Split: { readonly ratio: number }
  Merge: { readonly otherStack: StackSize }
  SetMax: { readonly newMax: MaxStackSize }
}>

/**
 * StackOperation コンストラクタ
 */
export const StackOperation = Data.taggedEnum<StackOperation>()

/**
 * スタック操作の結果ADT
 */
export type StackOperationResult = Data.TaggedEnum<{
  Success: { readonly newSize: StackSize; readonly overflow?: StackSize }
  Overflow: { readonly maxSize: StackSize; readonly overflow: StackSize }
  Underflow: { readonly currentSize: StackSize; readonly requested: StackSize }
  InvalidOperation: { readonly operation: StackOperation; readonly reason: string }
}>

/**
 * StackOperationResult コンストラクタ
 */
export const StackOperationResult = Data.taggedEnum<StackOperationResult>()

/**
 * StackSize関連のエラーADT
 */
export type StackSizeError = Data.TaggedEnum<{
  InvalidSize: { readonly size: number; readonly min: number; readonly max: number }
  InvalidMaxSize: { readonly maxSize: number; readonly category: string; readonly allowedRange: readonly number[] }
  ExceedsLimit: { readonly current: StackSize; readonly addition: StackSize; readonly limit: MaxStackSize }
  InsufficientAmount: { readonly current: StackSize; readonly requested: StackSize }
  IncompatibleStacks: { readonly stack1: StackSize; readonly stack2: StackSize; readonly reason: string }
  DivisionByZero: { readonly operation: string }
  InvalidRatio: { readonly ratio: number; readonly expected: string }
}>

/**
 * StackSizeError コンストラクタ
 */
export const StackSizeError = Data.taggedEnum<StackSizeError>()

/**
 * アイテムカテゴリ別スタック制約
 */
export type StackConstraint = {
  readonly category: 'single' | 'tool' | 'food' | 'material' | 'block'
  readonly maxSize: MaxStackSize
  readonly stackable: boolean
  readonly description: string
}

/**
 * スタック分割情報
 */
export type SplitResult = {
  readonly original: StackSize
  readonly parts: readonly StackSize[]
  readonly totalParts: number
}

/**
 * スタック統計情報
 */
export type StackStats = {
  readonly totalStacks: number
  readonly totalItems: number
  readonly averageStackSize: number
  readonly maxPossibleStacks: number
  readonly efficiency: number // 0-1の範囲で表される効率性
}
