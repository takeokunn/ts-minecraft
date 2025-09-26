import { Schema } from '@effect/schema'
import { Brand } from 'effect'
import type { PlayerId } from '@/shared/types/branded'
import type { ItemId } from '@/domain/inventory/InventoryTypes'
import type { Vector3D } from '@/shared/types/spatial-brands'

// Branded Types
export const BedId = Schema.String.pipe(Schema.brand('BedId'))
export type BedId = Schema.Schema.Type<typeof BedId>

export const SignId = Schema.String.pipe(Schema.brand('SignId'))
export type SignId = Schema.Schema.Type<typeof SignId>

export const MaxTextLength = Schema.Number.pipe(Schema.between(1, 1000), Schema.brand('MaxTextLength'))
export type MaxTextLength = Schema.Schema.Type<typeof MaxTextLength>

// Direction type for furniture placement
export const Direction = Schema.Literal('north', 'south', 'east', 'west')
export type Direction = Schema.Schema.Type<typeof Direction>

// Bed Types
export const BedColor = Schema.Literal(
  'white',
  'orange',
  'magenta',
  'light_blue',
  'yellow',
  'lime',
  'pink',
  'gray',
  'light_gray',
  'cyan',
  'purple',
  'blue',
  'brown',
  'green',
  'red',
  'black'
)
export type BedColor = Schema.Schema.Type<typeof BedColor>

export const BedPart = Schema.Literal('head', 'foot')
export type BedPart = Schema.Schema.Type<typeof BedPart>

// Dye colors for sign text
export const DyeColor = Schema.Literal(
  'black',
  'red',
  'green',
  'brown',
  'blue',
  'purple',
  'cyan',
  'light_gray',
  'gray',
  'pink',
  'lime',
  'yellow',
  'light_blue',
  'magenta',
  'orange',
  'white'
)
export type DyeColor = Schema.Schema.Type<typeof DyeColor>

// Bed Definition
export const Bed = Schema.Struct({
  id: BedId,
  position: Schema.Unknown,
  color: BedColor,
  direction: Direction,
  occupied: Schema.Boolean,
  occupantId: Schema.optional(Schema.String),
  isSpawnPoint: Schema.Boolean,
  partType: BedPart,
})
export type Bed = Schema.Schema.Type<typeof Bed>

// Sign Definition
export const Sign = Schema.Struct({
  id: SignId,
  position: Schema.Unknown,
  isWallSign: Schema.Boolean,
  direction: Direction,
  lines: Schema.Tuple(Schema.String, Schema.String, Schema.String, Schema.String),
  authorId: Schema.String,
  createdAt: Schema.Number,
  glowing: Schema.Boolean,
  textColor: DyeColor,
})
export type Sign = Schema.Schema.Type<typeof Sign>

// Book Definition
export const WrittenBook = Schema.Struct({
  itemId: Schema.String,
  title: Schema.String.pipe(Schema.maxLength(32)),
  author: Schema.String,
  pages: Schema.Array(Schema.String.pipe(Schema.maxLength(256))).pipe(Schema.maxItems(100)),
  generation: Schema.Number.pipe(Schema.between(0, 3)),
  resolved: Schema.Boolean,
})
export type WrittenBook = Schema.Schema.Type<typeof WrittenBook>

// Sleep Events
export const SleepEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('PlayerSlept'),
    playerId: Schema.String,
    bedId: BedId,
    position: Schema.Unknown,
    startTime: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerWoke'),
    playerId: Schema.String,
    bedId: BedId,
    sleepDuration: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('SpawnPointSet'),
    playerId: Schema.String,
    position: Schema.Unknown,
    bedId: Schema.optional(BedId),
  }),
  Schema.Struct({
    _tag: Schema.Literal('NightSkipped'),
    playerCount: Schema.Number,
    newTime: Schema.Number,
  })
)
export type SleepEvent = Schema.Schema.Type<typeof SleepEvent>

// Sign Events
export const SignEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('SignPlaced'),
    signId: SignId,
    position: Schema.Unknown,
    placerId: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('SignEdited'),
    signId: SignId,
    lines: Schema.Tuple(Schema.String, Schema.String, Schema.String, Schema.String),
    editorId: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('BookWritten'),
    book: WrittenBook,
    authorId: Schema.String,
  })
)
export type SignEvent = Schema.Schema.Type<typeof SignEvent>

// Sleep State
export const SleepState = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Awake'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Sleeping'),
    bedId: BedId,
    startTime: Schema.Number,
    position: Schema.Unknown,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Waking'),
    duration: Schema.Number,
  })
)
export type SleepState = Schema.Schema.Type<typeof SleepState>

// Error types for furniture operations
export const FurnitureErrorReason = Schema.Literal(
  'insufficient_space',
  'bed_occupied',
  'bed_not_found',
  'cannot_sleep_now',
  'monsters_nearby',
  'player_not_sleeping',
  'block_occupied',
  'no_support_block',
  'sign_not_found',
  'text_too_long',
  'book_title_too_long',
  'too_many_pages',
  'page_too_long'
)
export type FurnitureErrorReason = Schema.Schema.Type<typeof FurnitureErrorReason>

export const FurnitureError = Schema.Struct({
  _tag: Schema.Literal('FurnitureError'),
  reason: FurnitureErrorReason,
  message: Schema.String,
  details: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type FurnitureError = Schema.Schema.Type<typeof FurnitureError>
