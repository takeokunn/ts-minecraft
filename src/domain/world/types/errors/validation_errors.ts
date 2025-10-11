/**
 * @fileoverview Validation Domain Errors
 * 検証システムの構造化エラー定義
 */

import type { JsonValue } from '@shared/schema/json'
import { JsonValueSchema } from '@shared/schema/json'
import { DateTime, Effect, Schema } from 'effect'
import type { ErrorContext } from './world_errors'
import { ErrorContextSchema } from './world_errors'

// === スキーマ検証エラー ===

/** スキーマ検証失敗エラー */
export const SchemaValidationErrorSchema = Schema.TaggedStruct('SchemaValidationError', {
  schemaName: Schema.String,
  fieldPath: Schema.String,
  expectedType: Schema.String,
  actualValue: JsonValueSchema,
  actualType: Schema.String,
  context: Schema.suspend(() => ErrorContextSchema),
  validationRule: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Schema Validation Error',
    description: 'Error when schema validation fails',
  })
)

export type SchemaValidationError = Schema.Schema.Type<typeof SchemaValidationErrorSchema>

export const getSchemaValidationErrorMessage = (error: SchemaValidationError): string =>
  `Schema validation failed for '${error.schemaName}.${error.fieldPath}': expected ${error.expectedType}, got ${error.actualType}`

/** 必須フィールド不足エラー */
export const MissingRequiredFieldErrorSchema = Schema.TaggedStruct('MissingRequiredFieldError', {
  schemaName: Schema.String,
  missingFields: Schema.Array(Schema.String),
  providedFields: Schema.Array(Schema.String),
  context: Schema.suspend(() => ErrorContextSchema),
}).pipe(
  Schema.annotations({
    title: 'Missing Required Field Error',
    description: 'Error when required fields are missing',
  })
)

export type MissingRequiredFieldError = Schema.Schema.Type<typeof MissingRequiredFieldErrorSchema>

export const getMissingRequiredFieldErrorMessage = (error: MissingRequiredFieldError): string =>
  `Missing required fields in '${error.schemaName}': ${error.missingFields.join(', ')}`

/** 不正なフィールドエラー */
export const UnexpectedFieldErrorSchema = Schema.TaggedStruct('UnexpectedFieldError', {
  schemaName: Schema.String,
  unexpectedFields: Schema.Array(Schema.String),
  allowedFields: Schema.Array(Schema.String),
  context: Schema.suspend(() => ErrorContextSchema),
  strict: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'Unexpected Field Error',
    description: 'Error when unexpected fields are present',
  })
)

export type UnexpectedFieldError = Schema.Schema.Type<typeof UnexpectedFieldErrorSchema>

export const getUnexpectedFieldErrorMessage = (error: UnexpectedFieldError): string =>
  `Unexpected fields in '${error.schemaName}': ${error.unexpectedFields.join(', ')}`

// === 範囲検証エラー ===

/** 数値範囲外エラー */
export const NumberOutOfRangeErrorSchema = Schema.TaggedStruct('NumberOutOfRangeError', {
  fieldName: Schema.String,
  value: Schema.Number,
  minValue: Schema.Number,
  maxValue: Schema.Number,
  context: Schema.suspend(() => ErrorContextSchema),
  inclusive: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'Number Out Of Range Error',
    description: 'Error when numeric value is outside valid range',
  })
)

export type NumberOutOfRangeError = Schema.Schema.Type<typeof NumberOutOfRangeErrorSchema>

export const getNumberOutOfRangeErrorMessage = (error: NumberOutOfRangeError): string =>
  `Value ${error.value} for '${error.fieldName}' is outside range [${error.minValue}, ${error.maxValue}]${error.inclusive ? '' : ' (exclusive)'}`

/** 文字列長エラー */
export const StringLengthErrorSchema = Schema.TaggedStruct('StringLengthError', {
  fieldName: Schema.String,
  value: Schema.String,
  actualLength: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  minLength: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  maxLength: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  context: Schema.suspend(() => ErrorContextSchema),
}).pipe(
  Schema.annotations({
    title: 'String Length Error',
    description: 'Error when string length is invalid',
  })
)

export type StringLengthError = Schema.Schema.Type<typeof StringLengthErrorSchema>

export const getStringLengthErrorMessage = (error: StringLengthError): string => {
  const constraints = []
  if (error.minLength !== undefined) constraints.push(`min: ${error.minLength}`)
  if (error.maxLength !== undefined) constraints.push(`max: ${error.maxLength}`)
  return `String length ${error.actualLength} for '${error.fieldName}' violates constraints: ${constraints.join(', ')}`
}

/** 配列サイズエラー */
export const ArraySizeErrorSchema = Schema.TaggedStruct('ArraySizeError', {
  fieldName: Schema.String,
  actualSize: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  minSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  maxSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  context: Schema.suspend(() => ErrorContextSchema),
}).pipe(
  Schema.annotations({
    title: 'Array Size Error',
    description: 'Error when array size is invalid',
  })
)

export type ArraySizeError = Schema.Schema.Type<typeof ArraySizeErrorSchema>

export const getArraySizeErrorMessage = (error: ArraySizeError): string => {
  const constraints = []
  if (error.minSize !== undefined) constraints.push(`min: ${error.minSize}`)
  if (error.maxSize !== undefined) constraints.push(`max: ${error.maxSize}`)
  return `Array size ${error.actualSize} for '${error.fieldName}' violates constraints: ${constraints.join(', ')}`
}

// === パターン検証エラー ===

/** 正規表現不一致エラー */
export const PatternMismatchErrorSchema = Schema.TaggedStruct('PatternMismatchError', {
  fieldName: Schema.String,
  value: Schema.String,
  pattern: Schema.String,
  description: Schema.optional(Schema.String),
  context: Schema.suspend(() => ErrorContextSchema),
  examples: Schema.optional(Schema.Array(Schema.String)),
}).pipe(
  Schema.annotations({
    title: 'Pattern Mismatch Error',
    description: 'Error when value does not match required pattern',
  })
)

export type PatternMismatchError = Schema.Schema.Type<typeof PatternMismatchErrorSchema>

export const getPatternMismatchErrorMessage = (error: PatternMismatchError): string =>
  `Value '${error.value}' for '${error.fieldName}' does not match pattern: ${error.pattern}${error.description ? ` (${error.description})` : ''}`

/** UUID形式エラー */
export const InvalidUUIDErrorSchema = Schema.TaggedStruct('InvalidUUIDError', {
  fieldName: Schema.String,
  value: Schema.String,
  context: Schema.suspend(() => ErrorContextSchema),
}).pipe(
  Schema.annotations({
    title: 'Invalid UUID Error',
    description: 'Error when UUID format is invalid',
  })
)

export type InvalidUUIDError = Schema.Schema.Type<typeof InvalidUUIDErrorSchema>

export const getInvalidUUIDErrorMessage = (error: InvalidUUIDError): string =>
  `Invalid UUID format for '${error.fieldName}': '${error.value}'`

// === 型検証エラー ===

/** 型不一致エラー */
export const TypeMismatchErrorSchema = Schema.TaggedStruct('TypeMismatchError', {
  fieldName: Schema.String,
  expectedType: Schema.String,
  actualType: Schema.String,
  value: JsonValueSchema,
  context: Schema.suspend(() => ErrorContextSchema),
  convertible: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    title: 'Type Mismatch Error',
    description: 'Error when value type does not match expected type',
  })
)

export type TypeMismatchError = Schema.Schema.Type<typeof TypeMismatchErrorSchema>

export const getTypeMismatchErrorMessage = (error: TypeMismatchError): string =>
  `Type mismatch for '${error.fieldName}': expected ${error.expectedType}, got ${error.actualType}`

/** Brand型検証エラー */
export const BrandValidationErrorSchema = Schema.TaggedStruct('BrandValidationError', {
  brandName: Schema.String,
  value: JsonValueSchema,
  reason: Schema.String,
  context: Schema.suspend(() => ErrorContextSchema),
  validationConstraints: Schema.Array(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Brand Validation Error',
    description: 'Error when branded type validation fails',
  })
)

export type BrandValidationError = Schema.Schema.Type<typeof BrandValidationErrorSchema>

export const getBrandValidationErrorMessage = (error: BrandValidationError): string =>
  `Brand validation failed for '${error.brandName}': ${error.reason}`

// === 参照検証エラー ===

/** 参照整合性エラー */
export const ReferenceIntegrityErrorSchema = Schema.TaggedStruct('ReferenceIntegrityError', {
  referenceField: Schema.String,
  referencedId: Schema.String,
  referencedType: Schema.String,
  context: Schema.suspend(() => ErrorContextSchema),
  cascadeDelete: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    title: 'Reference Integrity Error',
    description: 'Error when referenced entity does not exist',
  })
)

export type ReferenceIntegrityError = Schema.Schema.Type<typeof ReferenceIntegrityErrorSchema>

export const getReferenceIntegrityErrorMessage = (error: ReferenceIntegrityError): string =>
  `Reference integrity violation: '${error.referenceField}' references non-existent ${error.referencedType} '${error.referencedId}'`

/** 循環参照エラー */
export const CircularReferenceErrorSchema = Schema.TaggedStruct('CircularReferenceError', {
  referenceChain: Schema.Array(Schema.String),
  context: Schema.suspend(() => ErrorContextSchema),
}).pipe(
  Schema.annotations({
    title: 'Circular Reference Error',
    description: 'Error when circular reference is detected',
  })
)

export type CircularReferenceError = Schema.Schema.Type<typeof CircularReferenceErrorSchema>

export const getCircularReferenceErrorMessage = (error: CircularReferenceError): string =>
  `Circular reference detected: ${error.referenceChain.join(' -> ')} -> ${error.referenceChain[0]}`

// === 一意性検証エラー ===

/** 重複値エラー */
export const DuplicateValueErrorSchema = Schema.TaggedStruct('DuplicateValueError', {
  fieldName: Schema.String,
  value: JsonValueSchema,
  existingId: Schema.optional(Schema.String),
  context: Schema.suspend(() => ErrorContextSchema),
}).pipe(
  Schema.annotations({
    title: 'Duplicate Value Error',
    description: 'Error when unique constraint is violated',
  })
)

export type DuplicateValueError = Schema.Schema.Type<typeof DuplicateValueErrorSchema>

export const getDuplicateValueErrorMessage = (error: DuplicateValueError): string =>
  `Duplicate value for unique field '${error.fieldName}': ${String(error.value)}${error.existingId ? ` (existing ID: ${error.existingId})` : ''}`

// === 複合検証エラー ===

/** 複数検証エラー */
export const MultipleValidationErrorSchema = Schema.TaggedStruct('MultipleValidationError', {
  errors: Schema.Array(Schema.suspend(() => ValidationDomainErrorSchema)),
  context: Schema.suspend(() => ErrorContextSchema),
  severity: Schema.Literal('warning', 'error', 'critical'),
}).pipe(
  Schema.annotations({
    title: 'Multiple Validation Error',
    description: 'Container for multiple validation errors',
  })
)

export type MultipleValidationError = Schema.Schema.Type<typeof MultipleValidationErrorSchema>

export const getMultipleValidationErrorMessage = (error: MultipleValidationError): string =>
  `Multiple validation errors (${error.errors.length}): ${error.errors
    .map((e) => {
      switch (e._tag) {
        case 'SchemaValidationError':
          return getSchemaValidationErrorMessage(e)
        case 'MissingRequiredFieldError':
          return getMissingRequiredFieldErrorMessage(e)
        case 'UnexpectedFieldError':
          return getUnexpectedFieldErrorMessage(e)
        case 'NumberOutOfRangeError':
          return getNumberOutOfRangeErrorMessage(e)
        case 'StringLengthError':
          return getStringLengthErrorMessage(e)
        case 'ArraySizeError':
          return getArraySizeErrorMessage(e)
        case 'PatternMismatchError':
          return getPatternMismatchErrorMessage(e)
        case 'InvalidUUIDError':
          return getInvalidUUIDErrorMessage(e)
        case 'TypeMismatchError':
          return getTypeMismatchErrorMessage(e)
        case 'BrandValidationError':
          return getBrandValidationErrorMessage(e)
        case 'ReferenceIntegrityError':
          return getReferenceIntegrityErrorMessage(e)
        case 'CircularReferenceError':
          return getCircularReferenceErrorMessage(e)
        case 'DuplicateValueError':
          return getDuplicateValueErrorMessage(e)
        case 'MultipleValidationError':
          return getMultipleValidationErrorMessage(e)
      }
    })
    .slice(0, 3)
    .join('; ')}${error.errors.length > 3 ? '...' : ''}`

// === 検証エラー統合型 ===

/** 検証ドメインの全エラー型 */
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

export type ValidationDomainError = Schema.Schema.Type<typeof ValidationDomainErrorSchema>

// === エラー作成Factory関数 ===

/** SchemaValidationError作成Factory */
export const createSchemaValidationError = (
  schemaName: string,
  fieldPath: string,
  expectedType: string,
  actualValue: JsonValue,
  context?: Partial<ErrorContext>,
  validationRule?: string
): Effect.Effect<SchemaValidationError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(SchemaValidationErrorSchema)({
      _tag: 'SchemaValidationError' as const,
      schemaName,
      fieldPath,
      expectedType,
      actualValue,
      actualType: typeof actualValue,
      context: { timestamp, ...context },
      validationRule,
    })
  })

/** MissingRequiredFieldError作成Factory */
export const createMissingRequiredFieldError = (
  schemaName: string,
  missingFields: readonly string[],
  providedFields: readonly string[],
  context?: Partial<ErrorContext>
): Effect.Effect<MissingRequiredFieldError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(MissingRequiredFieldErrorSchema)({
      _tag: 'MissingRequiredFieldError' as const,
      schemaName,
      missingFields,
      providedFields,
      context: { timestamp, ...context },
    })
  })

/** UnexpectedFieldError作成Factory */
export const createUnexpectedFieldError = (
  schemaName: string,
  unexpectedFields: readonly string[],
  allowedFields: readonly string[],
  strict: boolean,
  context?: Partial<ErrorContext>
): Effect.Effect<UnexpectedFieldError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(UnexpectedFieldErrorSchema)({
      _tag: 'UnexpectedFieldError' as const,
      schemaName,
      unexpectedFields,
      allowedFields,
      context: { timestamp, ...context },
      strict,
    })
  })

/** NumberOutOfRangeError作成Factory */
export const createNumberOutOfRangeError = (
  fieldName: string,
  value: number,
  minValue: number,
  maxValue: number,
  context?: Partial<ErrorContext>,
  inclusive: boolean = true
): Effect.Effect<NumberOutOfRangeError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(NumberOutOfRangeErrorSchema)({
      _tag: 'NumberOutOfRangeError' as const,
      fieldName,
      value,
      minValue,
      maxValue,
      context: { timestamp, ...context },
      inclusive,
    })
  })

/** StringLengthError作成Factory */
export const createStringLengthError = (
  fieldName: string,
  value: string,
  actualLength: number,
  context?: Partial<ErrorContext>,
  minLength?: number,
  maxLength?: number
): Effect.Effect<StringLengthError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(StringLengthErrorSchema)({
      _tag: 'StringLengthError' as const,
      fieldName,
      value,
      actualLength,
      context: { timestamp, ...context },
      minLength,
      maxLength,
    })
  })

/** ArraySizeError作成Factory */
export const createArraySizeError = (
  fieldName: string,
  actualSize: number,
  context?: Partial<ErrorContext>,
  minSize?: number,
  maxSize?: number
): Effect.Effect<ArraySizeError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(ArraySizeErrorSchema)({
      _tag: 'ArraySizeError' as const,
      fieldName,
      actualSize,
      context: { timestamp, ...context },
      minSize,
      maxSize,
    })
  })

/** PatternMismatchError作成Factory */
export const createPatternMismatchError = (
  fieldName: string,
  value: string,
  pattern: string,
  context?: Partial<ErrorContext>,
  description?: string,
  examples?: readonly string[]
): Effect.Effect<PatternMismatchError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(PatternMismatchErrorSchema)({
      _tag: 'PatternMismatchError' as const,
      fieldName,
      value,
      pattern,
      context: { timestamp, ...context },
      description,
      examples,
    })
  })

/** InvalidUUIDError作成Factory */
export const createInvalidUUIDError = (
  fieldName: string,
  value: string,
  context?: Partial<ErrorContext>
): Effect.Effect<InvalidUUIDError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(InvalidUUIDErrorSchema)({
      _tag: 'InvalidUUIDError' as const,
      fieldName,
      value,
      context: { timestamp, ...context },
    })
  })

/** TypeMismatchError作成Factory */
export const createTypeMismatchError = (
  fieldName: string,
  expectedType: string,
  actualType: string,
  value: JsonValue,
  context?: Partial<ErrorContext>,
  convertible?: boolean
): Effect.Effect<TypeMismatchError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(TypeMismatchErrorSchema)({
      _tag: 'TypeMismatchError' as const,
      fieldName,
      expectedType,
      actualType,
      value,
      context: { timestamp, ...context },
      convertible,
    })
  })

/** BrandValidationError作成Factory */
export const createBrandValidationError = (
  brandName: string,
  value: JsonValue,
  reason: string,
  validationConstraints: readonly string[],
  context?: Partial<ErrorContext>
): Effect.Effect<BrandValidationError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(BrandValidationErrorSchema)({
      _tag: 'BrandValidationError' as const,
      brandName,
      value,
      reason,
      context: { timestamp, ...context },
      validationConstraints,
    })
  })

/** ReferenceIntegrityError作成Factory */
export const createReferenceIntegrityError = (
  referenceField: string,
  referencedId: string,
  referencedType: string,
  context?: Partial<ErrorContext>,
  cascadeDelete?: boolean
): Effect.Effect<ReferenceIntegrityError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(ReferenceIntegrityErrorSchema)({
      _tag: 'ReferenceIntegrityError' as const,
      referenceField,
      referencedId,
      referencedType,
      context: { timestamp, ...context },
      cascadeDelete,
    })
  })

/** CircularReferenceError作成Factory */
export const createCircularReferenceError = (
  referenceChain: readonly string[],
  context?: Partial<ErrorContext>
): Effect.Effect<CircularReferenceError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(CircularReferenceErrorSchema)({
      _tag: 'CircularReferenceError' as const,
      referenceChain,
      context: { timestamp, ...context },
    })
  })

/** DuplicateValueError作成Factory */
export const createDuplicateValueError = (
  fieldName: string,
  value: JsonValue,
  context?: Partial<ErrorContext>,
  existingId?: string
): Effect.Effect<DuplicateValueError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(DuplicateValueErrorSchema)({
      _tag: 'DuplicateValueError' as const,
      fieldName,
      value,
      context: { timestamp, ...context },
      existingId,
    })
  })

/** MultipleValidationError作成Factory */
export const createMultipleValidationError = (
  errors: readonly ValidationDomainError[],
  context?: Partial<ErrorContext>,
  severity: 'warning' | 'error' | 'critical' = 'error'
): Effect.Effect<MultipleValidationError, Schema.ParseError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const timestamp = DateTime.toDate(now)
    return yield* Schema.decode(MultipleValidationErrorSchema)({
      _tag: 'MultipleValidationError' as const,
      errors,
      context: { timestamp, ...context },
      severity,
    })
  })

// === 型ガード関数 ===

/** SchemaValidationError型ガード */
export const isSchemaValidationError = (error: unknown): error is SchemaValidationError =>
  Schema.is(SchemaValidationErrorSchema)(error)

/** MissingRequiredFieldError型ガード */
export const isMissingRequiredFieldError = (error: unknown): error is MissingRequiredFieldError =>
  Schema.is(MissingRequiredFieldErrorSchema)(error)

/** UnexpectedFieldError型ガード */
export const isUnexpectedFieldError = (error: unknown): error is UnexpectedFieldError =>
  Schema.is(UnexpectedFieldErrorSchema)(error)

/** NumberOutOfRangeError型ガード */
export const isNumberOutOfRangeError = (error: unknown): error is NumberOutOfRangeError =>
  Schema.is(NumberOutOfRangeErrorSchema)(error)

/** StringLengthError型ガード */
export const isStringLengthError = (error: unknown): error is StringLengthError =>
  Schema.is(StringLengthErrorSchema)(error)

/** ArraySizeError型ガード */
export const isArraySizeError = (error: unknown): error is ArraySizeError => Schema.is(ArraySizeErrorSchema)(error)

/** PatternMismatchError型ガード */
export const isPatternMismatchError = (error: unknown): error is PatternMismatchError =>
  Schema.is(PatternMismatchErrorSchema)(error)

/** InvalidUUIDError型ガード */
export const isInvalidUUIDError = (error: unknown): error is InvalidUUIDError =>
  Schema.is(InvalidUUIDErrorSchema)(error)

/** TypeMismatchError型ガード */
export const isTypeMismatchError = (error: unknown): error is TypeMismatchError =>
  Schema.is(TypeMismatchErrorSchema)(error)

/** BrandValidationError型ガード */
export const isBrandValidationError = (error: unknown): error is BrandValidationError =>
  Schema.is(BrandValidationErrorSchema)(error)

/** ReferenceIntegrityError型ガード */
export const isReferenceIntegrityError = (error: unknown): error is ReferenceIntegrityError =>
  Schema.is(ReferenceIntegrityErrorSchema)(error)

/** CircularReferenceError型ガード */
export const isCircularReferenceError = (error: unknown): error is CircularReferenceError =>
  Schema.is(CircularReferenceErrorSchema)(error)

/** DuplicateValueError型ガード */
export const isDuplicateValueError = (error: unknown): error is DuplicateValueError =>
  Schema.is(DuplicateValueErrorSchema)(error)

/** MultipleValidationError型ガード */
export const isMultipleValidationError = (error: unknown): error is MultipleValidationError =>
  Schema.is(MultipleValidationErrorSchema)(error)

/** ValidationDomainError型ガード */
export const isValidationDomainError = (error: unknown): error is ValidationDomainError =>
  Schema.is(ValidationDomainErrorSchema)(error)
