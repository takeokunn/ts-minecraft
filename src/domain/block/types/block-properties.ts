import { pipe } from 'effect/Function'
import * as Array from 'effect/Array'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import type { ParseError } from 'effect/ParseResult'
import type { BlockTag } from '../value_object/block-identity'

// =============================================================================
// Tool Requirement ADT
// =============================================================================

export type ToolType = Data.TaggedEnum<{
  None: {}
  Pickaxe: { readonly level: number }
  Shovel: { readonly level: number }
  Axe: { readonly level: number }
  Hoe: { readonly level: number }
  Sword: { readonly level: number }
  Shears: {}
}>

export const ToolType = Data.taggedEnum<ToolType>()

const toolLevelSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(4)
)

export const ToolTypeSchema = Schema.Union(
  Schema.Struct({ _tag: Schema.Literal('None') }),
  Schema.Struct({ _tag: Schema.Literal('Pickaxe'), level: toolLevelSchema }),
  Schema.Struct({ _tag: Schema.Literal('Shovel'), level: toolLevelSchema }),
  Schema.Struct({ _tag: Schema.Literal('Axe'), level: toolLevelSchema }),
  Schema.Struct({ _tag: Schema.Literal('Hoe'), level: toolLevelSchema }),
  Schema.Struct({ _tag: Schema.Literal('Sword'), level: toolLevelSchema }),
  Schema.Struct({ _tag: Schema.Literal('Shears') })
)

// =============================================================================
// Block Physics / Sound / Drops Schema
// =============================================================================

export const BlockSoundSchema = Schema.Struct({
  break: Schema.String,
  place: Schema.String,
  step: Schema.String,
  hit: Schema.String,
  fall: Schema.String,
}).pipe(
  Schema.annotations({
    title: 'BlockSound',
    description: 'ブロック操作時に再生されるサウンドID群',
  })
)

export type BlockSound = Schema.Schema.Type<typeof BlockSoundSchema>

export const BlockPhysicsSchema = Schema.Struct({
  solid: Schema.Boolean,
  transparent: Schema.Boolean,
  hardness: Schema.Number.pipe(Schema.nonNegative()),
  resistance: Schema.Number.pipe(Schema.nonNegative()),
  luminance: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  opacity: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  gravity: Schema.Boolean,
  flammable: Schema.Boolean,
  replaceable: Schema.Boolean,
  liquid: Schema.Boolean,
  pushable: Schema.Boolean,
  waterloggable: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'BlockPhysics',
    description: 'ブロックの物理挙動パラメータ',
  })
)

export type BlockPhysics = Schema.Schema.Type<typeof BlockPhysicsSchema>

export const ItemDropSchema = Schema.Struct({
  itemId: Schema.String,
  quantity: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  chance: Schema.Number.pipe(Schema.between(0, 1)),
}).pipe(
  Schema.annotations({
    title: 'ItemDrop',
    description: '破壊時のドロップ情報',
  })
)

export type ItemDrop = Schema.Schema.Type<typeof ItemDropSchema>

export const BlockPropertiesSchema = Schema.Struct({
  physics: BlockPhysicsSchema,
  sound: BlockSoundSchema,
  tool: ToolTypeSchema,
  tags: Schema.Array(Schema.String),
  drops: Schema.Array(ItemDropSchema),
  stackSize: Schema.Number.pipe(Schema.int(), Schema.between(1, 99)),
}).pipe(
  Schema.annotations({
    title: 'BlockProperties',
    description: 'ブロック生成に必要な周辺プロパティ',
  })
)

export type BlockProperties = Schema.Schema.Type<typeof BlockPropertiesSchema>

// =============================================================================
// Defaults
// =============================================================================

const defaultSoundInput: Schema.Schema.Encoded<typeof BlockSoundSchema> = {
  break: 'block.stone.break',
  place: 'block.stone.place',
  step: 'block.stone.step',
  hit: 'block.stone.hit',
  fall: 'block.stone.fall',
}

const defaultPhysicsInput: Schema.Schema.Encoded<typeof BlockPhysicsSchema> = {
  solid: true,
  transparent: false,
  hardness: 1,
  resistance: 1,
  luminance: 0,
  opacity: 15,
  gravity: false,
  flammable: false,
  replaceable: false,
  liquid: false,
  pushable: true,
  waterloggable: false,
}

const defaultDropInput: Schema.Schema.Encoded<typeof ItemDropSchema> = {
  itemId: 'self',
  quantity: 1,
  chance: 1,
}

// =============================================================================
// Constructors
// =============================================================================

const decode = <A, I>(
  schema: Schema.Schema<A, I>,
  input: I,
  onError: (issues: ParseError) => BlockPropertiesError
) =>
  pipe(
    Schema.decode(schema)(input),
    Effect.mapError(onError)
  )

export type BlockPropertiesError = Data.TaggedEnum<{
  InvalidPhysics: { readonly issues: ParseError }
  InvalidSound: { readonly issues: ParseError }
  InvalidDrops: { readonly issues: ParseError }
  InvalidTool: { readonly issues: ParseError }
  InvalidProperties: { readonly issues: ParseError }
}>

export const BlockPropertiesError = Data.taggedEnum<BlockPropertiesError>()

export type BlockPropertiesInput = {
  readonly physics?: Partial<Schema.Schema.Encoded<typeof BlockPhysicsSchema>>
  readonly sound?: Partial<Schema.Schema.Encoded<typeof BlockSoundSchema>>
  readonly tool?: Schema.Schema.Encoded<typeof ToolTypeSchema>
  readonly drops?: ReadonlyArray<Partial<Schema.Schema.Encoded<typeof ItemDropSchema>>>
  readonly tags?: ReadonlyArray<BlockTag>
  readonly stackSize?: number
}

export const makePhysics = (
  overrides?: Partial<Schema.Schema.Encoded<typeof BlockPhysicsSchema>>
): Effect.Effect<BlockPhysics, BlockPropertiesError> =>
  decode(
    BlockPhysicsSchema,
    { ...defaultPhysicsInput, ...(overrides ?? {}) },
    (issues) => BlockPropertiesError.InvalidPhysics({ issues })
  )

export const makeSound = (
  overrides?: Partial<Schema.Schema.Encoded<typeof BlockSoundSchema>>
): Effect.Effect<BlockSound, BlockPropertiesError> =>
  decode(
    BlockSoundSchema,
    { ...defaultSoundInput, ...(overrides ?? {}) },
    (issues) => BlockPropertiesError.InvalidSound({ issues })
  )

export const makeDrop = (
  overrides?: Partial<Schema.Schema.Encoded<typeof ItemDropSchema>>
): Effect.Effect<ItemDrop, BlockPropertiesError> =>
  decode(ItemDropSchema, { ...defaultDropInput, ...(overrides ?? {}) }, (issues) =>
    BlockPropertiesError.InvalidDrops({ issues })
  )

export const makeDrops = (
  inputs: ReadonlyArray<Partial<Schema.Schema.Encoded<typeof ItemDropSchema>>>
): Effect.Effect<ReadonlyArray<ItemDrop>, BlockPropertiesError> =>
  Effect.gen(function* () {
    const resolved: ItemDrop[] = []
    for (const item of inputs) {
      const drop = yield* makeDrop(item)
      resolved.push(drop)
    }
    return resolved as ReadonlyArray<ItemDrop>
  })

export const makeTool = (
  tool?: Schema.Schema.Encoded<typeof ToolTypeSchema>
): Effect.Effect<ToolType, BlockPropertiesError> =>
  decode(
    ToolTypeSchema,
    tool ?? ToolType.None(),
    (issues) => BlockPropertiesError.InvalidTool({ issues })
  )

export const makeBlockProperties = (
  input?: BlockPropertiesInput
): Effect.Effect<BlockProperties, BlockPropertiesError> =>
  Effect.gen(function* () {
    const physics = yield* makePhysics(input?.physics)
    const sound = yield* makeSound(input?.sound)
    const tool = yield* makeTool(input?.tool)
    const drops = yield* makeDrops(input?.drops ?? [defaultDropInput])
    const tags = Array.fromIterable(input?.tags ?? [])
    const stackSize = input?.stackSize ?? 64

    return yield* decode(
      BlockPropertiesSchema,
      { physics, sound, tool, drops, tags, stackSize },
      (issues) => BlockPropertiesError.InvalidProperties({ issues })
    )
  })
