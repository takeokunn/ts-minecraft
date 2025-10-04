import { pipe } from 'effect/Function'
import * as Array from 'effect/Array'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Schema from '@effect/schema/Schema'
import { ParseResult } from '@effect/schema/ParseResult'

// =============================================================================
// Brand Schemas
// =============================================================================

export const BlockIdSchema = Schema.String.pipe(
  Schema.trimmed(),
  Schema.pattern(/^[a-z0-9_]+$/),
  Schema.minLength(1),
  Schema.maxLength(64),
  Schema.brand('BlockId'),
  Schema.annotations({
    title: 'BlockId',
    description: '小文字・数字・アンダースコアのみ許容されるブロックID',
    examples: ['stone', 'oak_log'],
  })
)

export type BlockId = Schema.Schema.Type<typeof BlockIdSchema>

export const BlockNameSchema = Schema.String.pipe(
  Schema.trimmed(),
  Schema.minLength(1),
  Schema.maxLength(80),
  Schema.brand('BlockName'),
  Schema.annotations({
    title: 'BlockName',
    description: '表示名として利用するブロック名',
  })
)

export type BlockName = Schema.Schema.Type<typeof BlockNameSchema>

export const BlockTagSchema = Schema.String.pipe(
  Schema.trimmed(),
  Schema.pattern(/^[a-z0-9][a-z0-9_-]*$/),
  Schema.minLength(1),
  Schema.maxLength(64),
  Schema.brand('BlockTag'),
  Schema.annotations({
    title: 'BlockTag',
    description: 'kebab-case / snake_case に対応したタグ',
  })
)

export type BlockTag = Schema.Schema.Type<typeof BlockTagSchema>

export const BlockPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
}).pipe(
  Schema.brand('BlockPosition'),
  Schema.annotations({
    title: 'BlockPosition',
    description: 'ワールド座標の整数ベクトル',
  })
)

export type BlockPosition = Schema.Schema.Type<typeof BlockPositionSchema>

// =============================================================================
// Error ADT
// =============================================================================

export type BlockIdentityError = Data.TaggedEnum<{
  BlockIdInvalid: { readonly input: string; readonly issues: Schema.ParseError }
  BlockNameInvalid: { readonly input: string; readonly issues: Schema.ParseError }
  BlockTagInvalid: { readonly input: string; readonly issues: Schema.ParseError }
  BlockPositionInvalid: { readonly input: { readonly x: number; readonly y: number; readonly z: number }; readonly issues: Schema.ParseError }
}>

export const BlockIdentityError = Data.taggedEnum<BlockIdentityError>()

// =============================================================================
// Constructors
// =============================================================================

const decodeWith = <A>(
  schema: Schema.Schema<A, string>,
  toError: (issues: ParseResult.ParseError, input: string) => BlockIdentityError
) =>
  (input: string) =>
    pipe(
      Schema.decodeEffect(schema)(input),
      Effect.mapError((issues) => toError(issues, input))
    )

export const makeBlockId = decodeWith(BlockIdSchema, (issues, input) =>
  BlockIdentityError.BlockIdInvalid({ input, issues })
)

export const makeBlockName = decodeWith(BlockNameSchema, (issues, input) =>
  BlockIdentityError.BlockNameInvalid({ input, issues })
)

export const makeBlockTag = decodeWith(BlockTagSchema, (issues, input) =>
  BlockIdentityError.BlockTagInvalid({ input, issues })
)

export const makeBlockPosition = (
  input: { readonly x: number; readonly y: number; readonly z: number }
) =>
  pipe(
    Schema.decodeEffect(BlockPositionSchema)(input),
    Effect.mapError((issues) => BlockIdentityError.BlockPositionInvalid({ input, issues }))
  )

// =============================================================================
// Tag Utilities
// =============================================================================

export const makeBlockTags = (inputs: Iterable<string>) =>
  pipe(inputs, Array.fromIterable, Array.map(makeBlockTag), Effect.all)

// =============================================================================
// Aggregate Helper
// =============================================================================

export type BlockIdentity = {
  readonly id: BlockId
  readonly name: BlockName
  readonly tags: ReadonlyArray<BlockTag>
}

export const assembleIdentity = (
  input: {
    readonly id: string
    readonly name: string
    readonly tags?: Iterable<string>
  }
) =>
  Effect.all({
    id: makeBlockId(input.id),
    name: makeBlockName(input.name),
    tags: makeBlockTags(input.tags ?? []),
  }).pipe(
    Effect.map(({ id, name, tags }) => ({ id, name, tags } satisfies BlockIdentity))
  )
