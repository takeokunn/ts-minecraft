/**
 * @fileoverview Validation Domain Errors
 * 検証システムの構造化エラー定義
 */

import { Data, Schema } from 'effect'
import { ErrorContext } from './index'

// === スキーマ検証エラー ===

/** スキーマ検証失敗エラー */
export class SchemaValidationError extends Data.TaggedError('SchemaValidationError')<{
  readonly schemaName: string
  readonly fieldPath: string
  readonly expectedType: string
  readonly actualValue: unknown
  readonly actualType: string
  readonly context: ErrorContext
  readonly validationRule?: string
}> {
  get message() {
    return `Schema validation failed for '${this.schemaName}.${this.fieldPath}': expected ${this.expectedType}, got ${this.actualType}`
  }
}

export const SchemaValidationErrorSchema = Schema.TaggedStruct('SchemaValidationError', {
  schemaName: Schema.String,
  fieldPath: Schema.String,
  expectedType: Schema.String,
  actualValue: Schema.Unknown,
  actualType: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  validationRule: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Schema Validation Error',
    description: 'Error when schema validation fails',
  })
)

/** 必須フィールド不足エラー */
export class MissingRequiredFieldError extends Data.TaggedError('MissingRequiredFieldError')<{
  readonly schemaName: string
  readonly missingFields: readonly string[]
  readonly providedFields: readonly string[]
  readonly context: ErrorContext
}> {
  get message() {
    return `Missing required fields in '${this.schemaName}': ${this.missingFields.join(', ')}`
  }
}

export const MissingRequiredFieldErrorSchema = Schema.TaggedStruct('MissingRequiredFieldError', {
  schemaName: Schema.String,
  missingFields: Schema.Array(Schema.String),
  providedFields: Schema.Array(Schema.String),
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
}).pipe(
  Schema.annotations({
    title: 'Missing Required Field Error',
    description: 'Error when required fields are missing',
  })
)

/** 不正なフィールドエラー */
export class UnexpectedFieldError extends Data.TaggedError('UnexpectedFieldError')<{
  readonly schemaName: string
  readonly unexpectedFields: readonly string[]
  readonly allowedFields: readonly string[]
  readonly context: ErrorContext
  readonly strict: boolean
}> {
  get message() {
    return `Unexpected fields in '${this.schemaName}': ${this.unexpectedFields.join(', ')}`
  }
}

export const UnexpectedFieldErrorSchema = Schema.TaggedStruct('UnexpectedFieldError', {
  schemaName: Schema.String,
  unexpectedFields: Schema.Array(Schema.String),
  allowedFields: Schema.Array(Schema.String),
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  strict: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'Unexpected Field Error',
    description: 'Error when unexpected fields are present',
  })
)

// === 範囲検証エラー ===

/** 数値範囲外エラー */
export class NumberOutOfRangeError extends Data.TaggedError('NumberOutOfRangeError')<{
  readonly fieldName: string
  readonly value: number
  readonly minValue: number
  readonly maxValue: number
  readonly context: ErrorContext
  readonly inclusive: boolean
}> {
  get message() {
    return `Value ${this.value} for '${this.fieldName}' is outside range [${this.minValue}, ${this.maxValue}]${this.inclusive ? '' : ' (exclusive)'}`
  }
}

export const NumberOutOfRangeErrorSchema = Schema.TaggedStruct('NumberOutOfRangeError', {
  fieldName: Schema.String,
  value: Schema.Number,
  minValue: Schema.Number,
  maxValue: Schema.Number,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  inclusive: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'Number Out Of Range Error',
    description: 'Error when numeric value is outside valid range',
  })
)

/** 文字列長エラー */
export class StringLengthError extends Data.TaggedError('StringLengthError')<{
  readonly fieldName: string
  readonly value: string
  readonly actualLength: number
  readonly minLength?: number
  readonly maxLength?: number
  readonly context: ErrorContext
}> {
  get message() {
    const constraints = []
    if (this.minLength !== undefined) constraints.push(`min: ${this.minLength}`)
    if (this.maxLength !== undefined) constraints.push(`max: ${this.maxLength}`)
    return `String length ${this.actualLength} for '${this.fieldName}' violates constraints: ${constraints.join(', ')}`
  }
}

export const StringLengthErrorSchema = Schema.TaggedStruct('StringLengthError', {
  fieldName: Schema.String,
  value: Schema.String,
  actualLength: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  minLength: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  maxLength: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
}).pipe(
  Schema.annotations({
    title: 'String Length Error',
    description: 'Error when string length is invalid',
  })
)

/** 配列サイズエラー */
export class ArraySizeError extends Data.TaggedError('ArraySizeError')<{
  readonly fieldName: string
  readonly actualSize: number
  readonly minSize?: number
  readonly maxSize?: number
  readonly context: ErrorContext
}> {
  get message() {
    const constraints = []
    if (this.minSize !== undefined) constraints.push(`min: ${this.minSize}`)
    if (this.maxSize !== undefined) constraints.push(`max: ${this.maxSize}`)
    return `Array size ${this.actualSize} for '${this.fieldName}' violates constraints: ${constraints.join(', ')}`
  }
}

export const ArraySizeErrorSchema = Schema.TaggedStruct('ArraySizeError', {
  fieldName: Schema.String,
  actualSize: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  minSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  maxSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
}).pipe(
  Schema.annotations({
    title: 'Array Size Error',
    description: 'Error when array size is invalid',
  })
)

// === パターン検証エラー ===

/** 正規表現不一致エラー */
export class PatternMismatchError extends Data.TaggedError('PatternMismatchError')<{
  readonly fieldName: string
  readonly value: string
  readonly pattern: string
  readonly description?: string
  readonly context: ErrorContext
  readonly examples?: readonly string[]
}> {
  get message() {
    return `Value '${this.value}' for '${this.fieldName}' does not match pattern: ${this.pattern}${this.description ? ` (${this.description})` : ''}`
  }
}

export const PatternMismatchErrorSchema = Schema.TaggedStruct('PatternMismatchError', {
  fieldName: Schema.String,
  value: Schema.String,
  pattern: Schema.String,
  description: Schema.optional(Schema.String),
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  examples: Schema.optional(Schema.Array(Schema.String)),
}).pipe(
  Schema.annotations({
    title: 'Pattern Mismatch Error',
    description: 'Error when value does not match required pattern',
  })
)

/** UUID形式エラー */
export class InvalidUUIDError extends Data.TaggedError('InvalidUUIDError')<{
  readonly fieldName: string
  readonly value: string
  readonly context: ErrorContext
}> {
  get message() {
    return `Invalid UUID format for '${this.fieldName}': '${this.value}'`
  }
}

export const InvalidUUIDErrorSchema = Schema.TaggedStruct('InvalidUUIDError', {
  fieldName: Schema.String,
  value: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
}).pipe(
  Schema.annotations({
    title: 'Invalid UUID Error',
    description: 'Error when UUID format is invalid',
  })
)

// === 型検証エラー ===

/** 型不一致エラー */
export class TypeMismatchError extends Data.TaggedError('TypeMismatchError')<{
  readonly fieldName: string
  readonly expectedType: string
  readonly actualType: string
  readonly value: unknown
  readonly context: ErrorContext
  readonly convertible?: boolean
}> {
  get message() {
    return `Type mismatch for '${this.fieldName}': expected ${this.expectedType}, got ${this.actualType}`
  }
}

export const TypeMismatchErrorSchema = Schema.TaggedStruct('TypeMismatchError', {
  fieldName: Schema.String,
  expectedType: Schema.String,
  actualType: Schema.String,
  value: Schema.Unknown,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  convertible: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    title: 'Type Mismatch Error',
    description: 'Error when value type does not match expected type',
  })
)

/** Brand型検証エラー */
export class BrandValidationError extends Data.TaggedError('BrandValidationError')<{
  readonly brandName: string
  readonly value: unknown
  readonly reason: string
  readonly context: ErrorContext
  readonly validationConstraints: readonly string[]
}> {
  get message() {
    return `Brand validation failed for '${this.brandName}': ${this.reason}`
  }
}

export const BrandValidationErrorSchema = Schema.TaggedStruct('BrandValidationError', {
  brandName: Schema.String,
  value: Schema.Unknown,
  reason: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  validationConstraints: Schema.Array(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Brand Validation Error',
    description: 'Error when branded type validation fails',
  })
)

// === 参照検証エラー ===

/** 参照整合性エラー */
export class ReferenceIntegrityError extends Data.TaggedError('ReferenceIntegrityError')<{
  readonly referenceField: string
  readonly referencedId: string
  readonly referencedType: string
  readonly context: ErrorContext
  readonly cascadeDelete?: boolean
}> {
  get message() {
    return `Reference integrity violation: '${this.referenceField}' references non-existent ${this.referencedType} '${this.referencedId}'`
  }
}

export const ReferenceIntegrityErrorSchema = Schema.TaggedStruct('ReferenceIntegrityError', {
  referenceField: Schema.String,
  referencedId: Schema.String,
  referencedType: Schema.String,
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  cascadeDelete: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    title: 'Reference Integrity Error',
    description: 'Error when referenced entity does not exist',
  })
)

/** 循環参照エラー */
export class CircularReferenceError extends Data.TaggedError('CircularReferenceError')<{
  readonly referenceChain: readonly string[]
  readonly context: ErrorContext
}> {
  get message() {
    return `Circular reference detected: ${this.referenceChain.join(' -> ')} -> ${this.referenceChain[0]}`
  }
}

export const CircularReferenceErrorSchema = Schema.TaggedStruct('CircularReferenceError', {
  referenceChain: Schema.Array(Schema.String),
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
}).pipe(
  Schema.annotations({
    title: 'Circular Reference Error',
    description: 'Error when circular reference is detected',
  })
)

// === 一意性検証エラー ===

/** 重複値エラー */
export class DuplicateValueError extends Data.TaggedError('DuplicateValueError')<{
  readonly fieldName: string
  readonly value: unknown
  readonly existingId?: string
  readonly context: ErrorContext
}> {
  get message() {
    return `Duplicate value for unique field '${this.fieldName}': ${String(this.value)}${this.existingId ? ` (existing ID: ${this.existingId})` : ''}`
  }
}

export const DuplicateValueErrorSchema = Schema.TaggedStruct('DuplicateValueError', {
  fieldName: Schema.String,
  value: Schema.Unknown,
  existingId: Schema.optional(Schema.String),
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
}).pipe(
  Schema.annotations({
    title: 'Duplicate Value Error',
    description: 'Error when unique constraint is violated',
  })
)

// === 複合検証エラー ===

/** 複数検証エラー */
export class MultipleValidationError extends Data.TaggedError('MultipleValidationError')<{
  readonly errors: readonly ValidationDomainError[]
  readonly context: ErrorContext
  readonly severity: 'warning' | 'error' | 'critical'
}> {
  get message() {
    return `Multiple validation errors (${this.errors.length}): ${this.errors
      .map((e) => e.message)
      .slice(0, 3)
      .join('; ')}${this.errors.length > 3 ? '...' : ''}`
  }
}

export const MultipleValidationErrorSchema = Schema.TaggedStruct('MultipleValidationError', {
  errors: Schema.Array(Schema.lazy(() => ValidationDomainErrorSchema)),
  context: Schema.suspend(() => import('./index').then((m) => m.ErrorContextSchema)),
  severity: Schema.Literal('warning', 'error', 'critical'),
}).pipe(
  Schema.annotations({
    title: 'Multiple Validation Error',
    description: 'Container for multiple validation errors',
  })
)

// === 検証エラー統合型 ===

/** 検証ドメインの全エラー型 */
export type ValidationDomainError =
  | SchemaValidationError
  | MissingRequiredFieldError
  | UnexpectedFieldError
  | NumberOutOfRangeError
  | StringLengthError
  | ArraySizeError
  | PatternMismatchError
  | InvalidUUIDError
  | TypeMismatchError
  | BrandValidationError
  | ReferenceIntegrityError
  | CircularReferenceError
  | DuplicateValueError
  | MultipleValidationError

export const ValidationDomainErrorSchema = Schema.Union(
  SchemaValidationErrorSchema,
  MissingRequiredFieldErrorSchema,
  UnexpectedFieldErrorSchema,
  NumberOutOfRangeErrorSchema,
  StringLengthErrorSchema,
  ArraySizeErrorSchema,
  PatternMismatchErrorSchema,
  InvalidUUIDErrorSchema,
  TypeMismatchErrorSchema,
  BrandValidationErrorSchema,
  ReferenceIntegrityErrorSchema,
  CircularReferenceErrorSchema,
  DuplicateValueErrorSchema,
  MultipleValidationErrorSchema
).pipe(
  Schema.annotations({
    title: 'Validation Domain Error',
    description: 'Union of all validation domain errors',
  })
)

// === エラー作成ヘルパー関数 ===

/** SchemaValidationError作成ヘルパー */
export const createSchemaValidationError = (
  schemaName: string,
  fieldPath: string,
  expectedType: string,
  actualValue: unknown,
  context?: Partial<ErrorContext>,
  validationRule?: string
): SchemaValidationError =>
  new SchemaValidationError({
    schemaName,
    fieldPath,
    expectedType,
    actualValue,
    actualType: typeof actualValue,
    context: { timestamp: new Date(), ...context },
    validationRule,
  })

/** NumberOutOfRangeError作成ヘルパー */
export const createNumberOutOfRangeError = (
  fieldName: string,
  value: number,
  minValue: number,
  maxValue: number,
  context?: Partial<ErrorContext>,
  inclusive: boolean = true
): NumberOutOfRangeError =>
  new NumberOutOfRangeError({
    fieldName,
    value,
    minValue,
    maxValue,
    context: { timestamp: new Date(), ...context },
    inclusive,
  })

/** PatternMismatchError作成ヘルパー */
export const createPatternMismatchError = (
  fieldName: string,
  value: string,
  pattern: string,
  context?: Partial<ErrorContext>,
  description?: string,
  examples?: readonly string[]
): PatternMismatchError =>
  new PatternMismatchError({
    fieldName,
    value,
    pattern,
    context: { timestamp: new Date(), ...context },
    description,
    examples,
  })

/** MultipleValidationError作成ヘルパー */
export const createMultipleValidationError = (
  errors: readonly ValidationDomainError[],
  context?: Partial<ErrorContext>,
  severity: 'warning' | 'error' | 'critical' = 'error'
): MultipleValidationError =>
  new MultipleValidationError({
    errors,
    context: { timestamp: new Date(), ...context },
    severity,
  })
