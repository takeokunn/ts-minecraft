import { Brand, Schema } from 'effect'
import { MaxStackSize, StackOperation, StackOperationResult, StackSize, StackabilityResult } from './types'

/**
 * StackSize Brand型用Schema
 */
export const StackSizeSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 64),
  Schema.fromBrand(Brand.nominal<StackSize>())
)

/**
 * MaxStackSize Brand型用Schema
 */
export const MaxStackSizeSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 64),
  Schema.fromBrand(Brand.nominal<MaxStackSize>())
)

/**
 * StackOperation ADT用Schema
 */
export const StackOperationSchema: Schema.Schema<StackOperation> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Add'),
    amount: StackSizeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Remove'),
    amount: StackSizeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Split'),
    ratio: Schema.Number.pipe(Schema.between(0.1, 0.9)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Merge'),
    otherStack: StackSizeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('SetMax'),
    newMax: MaxStackSizeSchema,
  })
)

/**
 * StackOperationResult ADT用Schema
 */
export const StackOperationResultSchema: Schema.Schema<StackOperationResult> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Success'),
    newSize: StackSizeSchema,
    overflow: Schema.optional(StackSizeSchema),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Overflow'),
    maxSize: StackSizeSchema,
    overflow: StackSizeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Underflow'),
    currentSize: StackSizeSchema,
    requested: StackSizeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidOperation'),
    operation: StackOperationSchema,
    reason: Schema.String.pipe(Schema.nonEmptyString()),
  })
)

/**
 * StackabilityResult ADT用Schema
 */
export const StackabilityResultSchema: Schema.Schema<StackabilityResult> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('FullyStackable'),
    combinedSize: StackSizeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PartiallyStackable'),
    stackedSize: StackSizeSchema,
    remainder: StackSizeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('NotStackable'),
    reason: Schema.String.pipe(Schema.nonEmptyString()),
  })
)

/**
 * スタック制約用Schema
 */
export const StackConstraintSchema = Schema.Struct({
  category: Schema.Union(
    Schema.Literal('single'),
    Schema.Literal('tool'),
    Schema.Literal('food'),
    Schema.Literal('material'),
    Schema.Literal('block')
  ),
  maxSize: MaxStackSizeSchema,
  stackable: Schema.Boolean,
  description: Schema.String.pipe(Schema.nonEmptyString()),
})

/**
 * カテゴリ別制約定義
 */
export const CategoryConstraintSchemas = {
  single: Schema.Struct({
    category: Schema.Literal('single'),
    maxSize: Schema.Literal(1).pipe(Schema.fromBrand(Brand.nominal<MaxStackSize>())),
    stackable: Schema.Literal(false),
    description: Schema.Literal('Single item only'),
  }),

  tool: Schema.Struct({
    category: Schema.Literal('tool'),
    maxSize: Schema.Literal(1).pipe(Schema.fromBrand(Brand.nominal<MaxStackSize>())),
    stackable: Schema.Literal(false),
    description: Schema.Literal('Tools and weapons'),
  }),

  food: Schema.Struct({
    category: Schema.Literal('food'),
    maxSize: Schema.Number.pipe(Schema.between(1, 64), Schema.fromBrand(Brand.nominal<MaxStackSize>())),
    stackable: Schema.Literal(true),
    description: Schema.Literal('Food items'),
  }),

  material: Schema.Struct({
    category: Schema.Literal('material'),
    maxSize: Schema.Literal(64).pipe(Schema.fromBrand(Brand.nominal<MaxStackSize>())),
    stackable: Schema.Literal(true),
    description: Schema.Literal('Raw materials and crafting components'),
  }),

  block: Schema.Struct({
    category: Schema.Literal('block'),
    maxSize: Schema.Literal(64).pipe(Schema.fromBrand(Brand.nominal<MaxStackSize>())),
    stackable: Schema.Literal(true),
    description: Schema.Literal('Building blocks'),
  }),
} as const

/**
 * SplitResult用Schema
 */
export const SplitResultSchema = Schema.Struct({
  original: StackSizeSchema,
  parts: Schema.Array(StackSizeSchema),
  totalParts: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

/**
 * StackStats用Schema
 */
export const StackStatsSchema = Schema.Struct({
  totalStacks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  totalItems: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  averageStackSize: Schema.Number.pipe(Schema.nonNegative()),
  maxPossibleStacks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  efficiency: Schema.Number.pipe(Schema.between(0, 1)),
})

/**
 * 特殊なスタックサイズ制約
 */
export const SpecialStackSchemas = {
  // エンダーパール（16個まで）
  enderPearl: Schema.Number.pipe(Schema.int(), Schema.between(1, 16), Schema.fromBrand(Brand.nominal<StackSize>())),

  // 雪玉（16個まで）
  snowball: Schema.Number.pipe(Schema.int(), Schema.between(1, 16), Schema.fromBrand(Brand.nominal<StackSize>())),

  // 卵（16個まで）
  egg: Schema.Number.pipe(Schema.int(), Schema.between(1, 16), Schema.fromBrand(Brand.nominal<StackSize>())),

  // 看板（16個まで）
  sign: Schema.Number.pipe(Schema.int(), Schema.between(1, 16), Schema.fromBrand(Brand.nominal<StackSize>())),

  // バケツ（1個のみ、スタック不可）
  bucket: Schema.Literal(1).pipe(Schema.fromBrand(Brand.nominal<StackSize>())),
} as const
