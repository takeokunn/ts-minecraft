import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Option, Schema } from 'effect'

// ===== Brand Types =====

export const FurnitureIdSchema = Schema.String.pipe(
  Schema.trimmed(),
  Schema.pattern(/^furn_[a-z0-9]{12}$/i),
  Schema.brand('FurnitureId')
)
export type FurnitureId = Schema.Schema.Type<typeof FurnitureIdSchema>

// PlayerIdは共有カーネルから再エクスポート
export { PlayerIdSchema, type PlayerId } from '@domain/shared/entities/player_id'

export const TickSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('GameTick'))
export type GameTick = Schema.Schema.Type<typeof TickSchema>

// ===== Value Objects =====

export const BedColorSchema = Schema.Union(
  Schema.Literal('red'),
  Schema.Literal('blue'),
  Schema.Literal('green'),
  Schema.Literal('purple'),
  Schema.Literal('white')
).pipe(Schema.brand('BedColor'))
export type BedColor = Schema.Schema.Type<typeof BedColorSchema>

export const OrientationSchema = Schema.Union(
  Schema.Literal('north'),
  Schema.Literal('south'),
  Schema.Literal('east'),
  Schema.Literal('west')
).pipe(Schema.brand('Orientation'))
export type Orientation = Schema.Schema.Type<typeof OrientationSchema>

export const SignStyleSchema = Schema.Union(
  Schema.Literal('oak'),
  Schema.Literal('spruce'),
  Schema.Literal('birch'),
  Schema.Literal('crimson'),
  Schema.Literal('glow')
).pipe(Schema.brand('SignStyle'))
export type SignStyle = Schema.Schema.Type<typeof SignStyleSchema>

export const BookCategorySchema = Schema.Union(
  Schema.Literal('lore'),
  Schema.Literal('instruction'),
  Schema.Literal('enchantment'),
  Schema.Literal('journal')
).pipe(Schema.brand('BookCategory'))
export type BookCategory = Schema.Schema.Type<typeof BookCategorySchema>

export const DurabilitySchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 100), Schema.brand('Durability'))
export type Durability = Schema.Schema.Type<typeof DurabilitySchema>

export const CoordinatesSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(Schema.brand('BlockCoordinates'))
export type BlockCoordinates = Schema.Schema.Type<typeof CoordinatesSchema>

export const SleepEnvironmentSchema = Schema.Struct({
  lightLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  noiseLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),
  monstersNearby: Schema.Boolean,
  isNightTime: Schema.Boolean,
  weather: Schema.Union(Schema.Literal('clear'), Schema.Literal('rain'), Schema.Literal('thunder')),
})
export type SleepEnvironment = Schema.Schema.Type<typeof SleepEnvironmentSchema>

export const SignTextSchema = Schema.Struct({
  lines: Schema.Array(Schema.String.pipe(Schema.maxLength(40))).pipe(Schema.minItems(1), Schema.maxItems(4)),
  alignment: Schema.Union(Schema.Literal('left'), Schema.Literal('center'), Schema.Literal('right')),
})
export type SignText = Schema.Schema.Type<typeof SignTextSchema>

export const BookPageSchema = Schema.Struct({
  index: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  content: Schema.String.pipe(Schema.maxLength(256)),
})
export type BookPage = Schema.Schema.Type<typeof BookPageSchema>

export const BookStateSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Draft'),
    editedBy: Schema.Array(PlayerIdSchema),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Published'),
    signedBy: PlayerIdSchema,
    publishedAt: TickSchema,
  })
)
export type BookState = Schema.Schema.Type<typeof BookStateSchema>

// ===== Aggregate Variants =====

export const BedSchema = Schema.Struct({
  _tag: Schema.Literal('Bed'),
  id: FurnitureIdSchema,
  color: BedColorSchema,
  orientation: OrientationSchema,
  coordinates: CoordinatesSchema,
  durability: DurabilitySchema,
  occupant: Schema.OptionFromSelf(PlayerIdSchema),
  placedAt: TickSchema,
  lastSleptAt: Schema.OptionFromSelf(TickSchema),
})
export type Bed = Schema.Schema.Type<typeof BedSchema>

export const BookSchema = Schema.Struct({
  _tag: Schema.Literal('Book'),
  id: FurnitureIdSchema,
  title: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32)),
  category: BookCategorySchema,
  createdBy: PlayerIdSchema,
  pages: Schema.Array(BookPageSchema).pipe(Schema.minItems(1), Schema.maxItems(50)),
  state: BookStateSchema,
})
export type Book = Schema.Schema.Type<typeof BookSchema>

export const SignSchema = Schema.Struct({
  _tag: Schema.Literal('Sign'),
  id: FurnitureIdSchema,
  style: SignStyleSchema,
  text: SignTextSchema,
  placedAt: TickSchema,
  placedBy: PlayerIdSchema,
  location: CoordinatesSchema,
  glowing: Schema.Boolean,
})
export type Sign = Schema.Schema.Type<typeof SignSchema>

export type Furniture = Bed | Book | Sign

// ===== Input Schemas (smart constructors) =====

export const CreateBedInputSchema = Schema.Struct({
  color: BedColorSchema,
  orientation: OrientationSchema,
  coordinates: CoordinatesSchema,
  requestedBy: PlayerIdSchema,
  durability: Schema.optionalWith(DurabilitySchema, { default: () => 100 }),
})
export type CreateBedInput = Schema.Schema.Type<typeof CreateBedInputSchema>

export const SleepCommandSchema = Schema.Struct({
  bed: BedSchema,
  playerId: PlayerIdSchema,
  environment: SleepEnvironmentSchema,
  currentTick: TickSchema,
})
export type SleepCommand = Schema.Schema.Type<typeof SleepCommandSchema>

export const CreateBookInputSchema = Schema.Struct({
  title: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32)),
  category: BookCategorySchema,
  createdBy: PlayerIdSchema,
  pages: Schema.Array(BookPageSchema).pipe(Schema.minItems(1)),
})
export type CreateBookInput = Schema.Schema.Type<typeof CreateBookInputSchema>

export const AppendPageCommandSchema = Schema.Struct({
  book: BookSchema,
  author: PlayerIdSchema,
  page: BookPageSchema,
})
export type AppendPageCommand = Schema.Schema.Type<typeof AppendPageCommandSchema>

export const CreateSignInputSchema = Schema.Struct({
  style: SignStyleSchema,
  text: SignTextSchema,
  placedBy: PlayerIdSchema,
  location: CoordinatesSchema,
  glowing: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type CreateSignInput = Schema.Schema.Type<typeof CreateSignInputSchema>

export const UpdateSignTextCommandSchema = Schema.Struct({
  sign: SignSchema,
  editor: PlayerIdSchema,
  text: SignTextSchema,
  currentTick: TickSchema,
})
export type UpdateSignTextCommand = Schema.Schema.Type<typeof UpdateSignTextCommandSchema>

// ===== Domain Error ADT =====

export type FurnitureError =
  | { readonly _tag: 'Validation'; readonly issues: ReadonlyArray<string> }
  | { readonly _tag: 'Occupied'; readonly bedId: FurnitureId; readonly occupant: PlayerId }
  | { readonly _tag: 'Broken'; readonly bedId: FurnitureId }
  | { readonly _tag: 'PermissionDenied'; readonly furnitureId: FurnitureId; readonly reason: string }
  | { readonly _tag: 'NotFound'; readonly furnitureId: FurnitureId }
  | { readonly _tag: 'AlreadyPublished'; readonly bookId: FurnitureId }
  | { readonly _tag: 'PageLimitReached'; readonly bookId: FurnitureId }
  | { readonly _tag: 'InvalidEnvironment'; readonly bedId: FurnitureId }

export const FurnitureError = {
  validation: (issues: ReadonlyArray<string>): FurnitureError => ({ _tag: 'Validation', issues }),
  occupied: (bedId: FurnitureId, occupant: PlayerId): FurnitureError => ({ _tag: 'Occupied', bedId, occupant }),
  broken: (bedId: FurnitureId): FurnitureError => ({ _tag: 'Broken', bedId }),
  permissionDenied: (furnitureId: FurnitureId, reason: string): FurnitureError => ({
    _tag: 'PermissionDenied',
    furnitureId,
    reason,
  }),
  notFound: (furnitureId: FurnitureId): FurnitureError => ({ _tag: 'NotFound', furnitureId }),
  alreadyPublished: (bookId: FurnitureId): FurnitureError => ({ _tag: 'AlreadyPublished', bookId }),
  pageLimitReached: (bookId: FurnitureId): FurnitureError => ({ _tag: 'PageLimitReached', bookId }),
  invalidEnvironment: (bedId: FurnitureId): FurnitureError => ({ _tag: 'InvalidEnvironment', bedId }),
} as const

// ===== Schema Helpers =====

export const decodeCreateBedInput = Schema.decodeEither(CreateBedInputSchema)
export const decodeSleepCommand = Schema.decodeEither(SleepCommandSchema)
export const decodeCreateBookInput = Schema.decodeEither(CreateBookInputSchema)
export const decodeAppendPageCommand = Schema.decodeEither(AppendPageCommandSchema)
export const decodeCreateSignInput = Schema.decodeEither(CreateSignInputSchema)
export const decodeUpdateSignTextCommand = Schema.decodeEither(UpdateSignTextCommandSchema)

// Utility to format schema errors into strings without using `as`
export const formatParseError = (error: Schema.ParseError): string => TreeFormatter.formatErrorSync(error)

export const toValidationError = (error: Schema.ParseError) => FurnitureError.validation([formatParseError(error)])

export const optionFromNullable = <A>(value: A | null | undefined) =>
  value === null || value === undefined ? Option.none<A>() : Option.some(value)
