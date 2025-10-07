import * as Array from 'effect/Array'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import type { ParseError } from 'effect/ParseResult'
import * as Schema from 'effect/Schema'

// 共有カーネルからimport & 再エクスポート
import { BlockIdSchema, type BlockId } from '../../shared/entities/block_id'
export { BlockIdSchema, type BlockId }

// =============================================================================
// Brand Schemas
// =============================================================================

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
  BlockIdInvalid: { readonly input: string; readonly issues: ParseError }
  BlockNameInvalid: { readonly input: string; readonly issues: ParseError }
  BlockTagInvalid: { readonly input: string; readonly issues: ParseError }
  BlockPositionInvalid: {
    readonly input: { readonly x: number; readonly y: number; readonly z: number }
    readonly issues: ParseError
  }
}>

export const BlockIdentityError = Data.taggedEnum<BlockIdentityError>()

// =============================================================================
// Constructors
// =============================================================================

const decodeWith =
  <A>(schema: Schema.Schema<A, string>, toError: (issues: ParseError, input: string) => BlockIdentityError) =>
  (input: string) =>
    pipe(
      Schema.decode(schema)(input),
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

export const makeBlockPosition = (input: { readonly x: number; readonly y: number; readonly z: number }) =>
  pipe(
    Schema.decode(BlockPositionSchema)(input),
    Effect.mapError((issues) => BlockIdentityError.BlockPositionInvalid({ input, issues }))
  )

// =============================================================================
// Tag Utilities
// =============================================================================

export const makeBlockTags = (inputs: Iterable<string>) =>
  pipe(
    Array.fromIterable(inputs),
    Effect.forEach((candidate) => makeBlockTag(candidate))
  )

// =============================================================================
// Aggregate Helper
// =============================================================================

export type BlockIdentity = {
  readonly id: BlockId
  readonly name: BlockName
  readonly tags: ReadonlyArray<BlockTag>
}

export const assembleIdentity = (input: {
  readonly id: string
  readonly name: string
  readonly tags?: Iterable<string>
}) =>
  Effect.gen(function* () {
    const id = yield* makeBlockId(input.id)
    const name = yield* makeBlockName(input.name)
    const tags = yield* makeBlockTags(input.tags ?? [])
    return { id, name, tags } satisfies BlockIdentity
  })
