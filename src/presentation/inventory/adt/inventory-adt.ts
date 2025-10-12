import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Data, Effect, Match, Option, Schema, pipe } from 'effect'

const decode = <A, I>(schema: Schema.Schema<A, I>) => Schema.decode(schema)

// PlayerIdは共有カーネルから再エクスポート
export { PlayerIdSchema, type PlayerId } from '@application/inventory/presentation-service'
export { SimpleItemIdSchema as ItemIdSchema, type ItemId } from '../../../domain/shared/entities/item_id'
export const parsePlayerId = decode(PlayerIdSchema)
export const playerIdToString = (value: PlayerId): string => value

// 共有カーネルから再エクスポート
import { SimpleItemIdSchema } from '../../../domain/shared/entities/item_id'
export const parseItemId = decode(SimpleItemIdSchema)

export const SlotIndexSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('SlotIndex'))
export type SlotIndex = Schema.Schema.Type<typeof SlotIndexSchema>
export const parseSlotIndex = decode(SlotIndexSchema)
export const slotIndexToNumber = (value: SlotIndex): number => value

export const SlotPositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
}).pipe(Schema.brand('SlotPosition'))
export interface SlotPosition extends Schema.Schema.Type<typeof SlotPositionSchema> {}
export const slotPositionFromCoordinates = (x: number, y: number) => decode(SlotPositionSchema)({ x, y })

export const DragItemIdSchema = Schema.String.pipe(Schema.minLength(1), Schema.brand('DragItemId'))
export type DragItemId = Schema.Schema.Type<typeof DragItemIdSchema>
export const parseDragItemId = decode(DragItemIdSchema)

export const ItemCategorySchema = Schema.Literal(
  'armor',
  'weapon',
  'tool',
  'material',
  'consumable',
  'utility',
  'fuel',
  'misc'
)
export type ItemCategory = Schema.Schema.Type<typeof ItemCategorySchema>

export const ArmorSlotSchema = Schema.Literal('helmet', 'chestplate', 'leggings', 'boots')
export type ArmorSlot = Schema.Schema.Type<typeof ArmorSlotSchema>

export const ItemEnchantmentSchema = Schema.Struct({
  id: Schema.String,
  level: Schema.Number.pipe(Schema.int(), Schema.between(1, 5)),
})
export type ItemEnchantment = Schema.Schema.Type<typeof ItemEnchantmentSchema>

export const ItemMetadataSchema = Schema.Struct({
  displayName: Schema.optional(Schema.String),
  lore: Schema.optional(Schema.Array(Schema.String)),
  durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  enchantments: Schema.optional(Schema.Array(ItemEnchantmentSchema)),
  category: Schema.optional(ItemCategorySchema),
  equipSlot: Schema.optional(ArmorSlotSchema),
  fuelTicks: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
})
export type ItemMetadata = Schema.Schema.Type<typeof ItemMetadataSchema>

export const ItemStackSchema = Schema.Struct({
  itemId: ItemIdSchema,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  metadata: Schema.optional(ItemMetadataSchema),
})
export type ItemStack = Schema.Schema.Type<typeof ItemStackSchema>
export const parseItemStack = decode(ItemStackSchema)

export const InventorySectionSchema = Schema.Literal('hotbar', 'main', 'armor', 'offhand', 'crafting', 'craftingResult')
export type InventorySection = Schema.Schema.Type<typeof InventorySectionSchema>

export const SlotTypeSchema = Schema.Literal(
  'normal',
  'armor-helmet',
  'armor-chestplate',
  'armor-leggings',
  'armor-boots',
  'offhand',
  'crafting-input',
  'crafting-output',
  'fuel',
  'result'
)
export type SlotType = Schema.Schema.Type<typeof SlotTypeSchema>

export const DragModeSchema = Schema.Literal('move', 'split', 'clone')
export type DragMode = Schema.Schema.Type<typeof DragModeSchema>

export interface SlotVisualState {
  readonly isHighlighted: boolean
  readonly isDisabled: boolean
}

export interface InventorySlot {
  readonly index: SlotIndex
  readonly section: InventorySection
  readonly slotType: SlotType
  readonly position: SlotPosition
  readonly item: Option.Option<ItemStack>
  readonly visual: SlotVisualState
}

export const makeInventorySlot = (input: {
  readonly index: SlotIndex
  readonly section: InventorySection
  readonly slotType: SlotType
  readonly position: SlotPosition
  readonly item: Option.Option<ItemStack>
  readonly isHighlighted?: boolean
  readonly isDisabled?: boolean
}): InventorySlot => ({
  index: input.index,
  section: input.section,
  slotType: input.slotType,
  position: input.position,
  item: input.item,
  visual: {
    isHighlighted: input.isHighlighted ?? false,
    isDisabled: input.isDisabled ?? false,
  },
})

export interface DragState {
  readonly isDragging: boolean
  readonly draggedItem: Option.Option<ItemStack>
  readonly sourceSlot: Option.Option<SlotIndex>
  readonly hoveredSlot: Option.Option<SlotIndex>
  readonly dragMode: DragMode
}

export const initialDragState: DragState = {
  isDragging: false,
  draggedItem: Option.none(),
  sourceSlot: Option.none(),
  hoveredSlot: Option.none(),
  dragMode: 'move',
}

export const DropActionSchema = Schema.Literal('move', 'swap', 'merge', 'split', 'rejected')
export type DropAction = Schema.Schema.Type<typeof DropActionSchema>

export const DropResultSchema = Schema.Struct({
  accepted: Schema.Boolean,
  action: DropActionSchema,
  sourceSlot: SlotIndexSchema,
  targetSlot: SlotIndexSchema,
  amount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type DropResult = Schema.Schema.Type<typeof DropResultSchema>
export const makeDropResult = decode(DropResultSchema)

export const InventoryThemeSchema = Schema.Struct({
  slotBackground: Schema.String,
  slotBorder: Schema.String,
  slotHover: Schema.String,
  slotSelected: Schema.String,
  slotDisabled: Schema.String,
  itemCountColor: Schema.String,
  itemDurabilityColor: Schema.String,
  tooltipBackground: Schema.String,
  tooltipText: Schema.String,
})
export type InventoryTheme = Schema.Schema.Type<typeof InventoryThemeSchema>

export const InventoryGUIConfigSchema = Schema.Struct({
  slotSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  slotSpacing: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  hotbarSlots: Schema.Number.pipe(Schema.int(), Schema.positive()),
  mainSlots: Schema.Number.pipe(Schema.int(), Schema.positive()),
  columns: Schema.Number.pipe(Schema.int(), Schema.positive()),
  animationDuration: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  enableDragAndDrop: Schema.Boolean,
  enableKeyboardShortcuts: Schema.Boolean,
  enableTooltips: Schema.Boolean,
  theme: InventoryThemeSchema,
})
export type InventoryGUIConfig = Schema.Schema.Type<typeof InventoryGUIConfigSchema>

export const defaultInventoryGUIConfig: InventoryGUIConfig = {
  slotSize: 48,
  slotSpacing: 4,
  hotbarSlots: 9,
  mainSlots: 27,
  columns: 9,
  animationDuration: 200,
  enableDragAndDrop: true,
  enableKeyboardShortcuts: true,
  enableTooltips: true,
  theme: {
    slotBackground: '#2a2a2a',
    slotBorder: '#4a4a4a',
    slotHover: '#3a3a3a',
    slotSelected: '#5a5a5a',
    slotDisabled: '#1a1a1a',
    itemCountColor: '#ffffff',
    itemDurabilityColor: '#00ff00',
    tooltipBackground: 'rgba(0, 0, 0, 0.9)',
    tooltipText: '#ffffff',
  },
} as InventoryGUIConfig

export interface InventoryView {
  readonly playerId: PlayerId
  readonly slots: ReadonlyArray<InventorySlot>
  readonly hotbar: ReadonlyArray<SlotIndex>
  readonly selectedSlot: SlotIndex
  readonly armor: {
    readonly helmet: Option.Option<ItemStack>
    readonly chestplate: Option.Option<ItemStack>
    readonly leggings: Option.Option<ItemStack>
    readonly boots: Option.Option<ItemStack>
  }
  readonly offhand: Option.Option<ItemStack>
}

export interface HotbarState {
  readonly selectedIndex: SlotIndex
  readonly slots: ReadonlyArray<Option.Option<ItemStack>>
  readonly isLocked: boolean
}

export interface InventoryPanelModel {
  readonly playerId: PlayerId
  readonly inventory: InventoryView
  readonly config: InventoryGUIConfig
  readonly isOpen: boolean
}

export const ClickButtonSchema = Schema.Literal('left', 'right', 'middle')
export type ClickButton = Schema.Schema.Type<typeof ClickButtonSchema>

export interface SlotClicked {
  readonly _tag: 'SlotClicked'
  readonly slot: SlotIndex
  readonly button: ClickButton
}
export const SlotClicked = Data.tagged<SlotClicked>('SlotClicked')

export interface SlotHovered {
  readonly _tag: 'SlotHovered'
  readonly slot: SlotIndex
}
export const SlotHovered = Data.tagged<SlotHovered>('SlotHovered')

export interface SlotUnhovered {
  readonly _tag: 'SlotUnhovered'
  readonly slot: SlotIndex
}
export const SlotUnhovered = Data.tagged<SlotUnhovered>('SlotUnhovered')

export interface ItemDragStart {
  readonly _tag: 'ItemDragStart'
  readonly slot: SlotIndex
  readonly item: ItemStack
}
export const ItemDragStart = Data.tagged<ItemDragStart>('ItemDragStart')

export interface ItemDragEnd {
  readonly _tag: 'ItemDragEnd'
  readonly result: Option.Option<DropResult>
}
export const ItemDragEnd = Data.tagged<ItemDragEnd>('ItemDragEnd')

export interface ItemDropped {
  readonly _tag: 'ItemDropped'
  readonly sourceSlot: SlotIndex
  readonly targetSlot: SlotIndex
}
export const ItemDropped = Data.tagged<ItemDropped>('ItemDropped')

export interface HotbarSelected {
  readonly _tag: 'HotbarSelected'
  readonly index: SlotIndex
}
export const HotbarSelected = Data.tagged<HotbarSelected>('HotbarSelected')

export interface InventoryOpened {
  readonly _tag: 'InventoryOpened'
}
export const InventoryOpened = Data.tagged<InventoryOpened>('InventoryOpened')

export interface InventoryClosed {
  readonly _tag: 'InventoryClosed'
}
export const InventoryClosed = Data.tagged<InventoryClosed>('InventoryClosed')

export interface QuickMove {
  readonly _tag: 'QuickMove'
  readonly slot: SlotIndex
}
export const QuickMove = Data.tagged<QuickMove>('QuickMove')

export interface QuickDrop {
  readonly _tag: 'QuickDrop'
  readonly slot: SlotIndex
  readonly all: boolean
}
export const QuickDrop = Data.tagged<QuickDrop>('QuickDrop')

export type InventoryGUIEvent =
  | ReturnType<typeof SlotClicked>
  | ReturnType<typeof SlotHovered>
  | ReturnType<typeof SlotUnhovered>
  | ReturnType<typeof ItemDragStart>
  | ReturnType<typeof ItemDragEnd>
  | ReturnType<typeof ItemDropped>
  | ReturnType<typeof HotbarSelected>
  | ReturnType<typeof InventoryOpened>
  | ReturnType<typeof InventoryClosed>
  | ReturnType<typeof QuickMove>
  | ReturnType<typeof QuickDrop>

export const SlotNotFoundErrorSchema = Schema.TaggedError('SlotNotFoundError', {
  slot: SlotIndexSchema,
})
export type SlotNotFoundError = Schema.Schema.Type<typeof SlotNotFoundErrorSchema>
export const SlotNotFoundError = makeErrorFactory(SlotNotFoundErrorSchema)

export const InvalidDropErrorSchema = Schema.TaggedError('InvalidDropError', {
  reason: Schema.String,
})
export type InvalidDropError = Schema.Schema.Type<typeof InvalidDropErrorSchema>
export const InvalidDropError = makeErrorFactory(InvalidDropErrorSchema)

export const AnimationFailedErrorSchema = Schema.TaggedError('AnimationFailedError', {
  slot: SlotIndexSchema,
})
export type AnimationFailedError = Schema.Schema.Type<typeof AnimationFailedErrorSchema>
export const AnimationFailedError = makeErrorFactory(AnimationFailedErrorSchema)

export const RenderFailureErrorSchema = Schema.TaggedError('RenderFailureError', {
  message: Schema.String,
})
export type RenderFailureError = Schema.Schema.Type<typeof RenderFailureErrorSchema>
export const RenderFailureError = makeErrorFactory(RenderFailureErrorSchema)

export const DomainFailureErrorSchema = Schema.TaggedError('DomainFailureError', {
  message: Schema.String,
})
export type DomainFailureError = Schema.Schema.Type<typeof DomainFailureErrorSchema>
export const DomainFailureError = makeErrorFactory(DomainFailureErrorSchema)

export type InventoryGUIError =
  | SlotNotFoundError
  | InvalidDropError
  | AnimationFailedError
  | RenderFailureError
  | DomainFailureError

export type InventoryEventHandler = (event: InventoryGUIEvent) => Effect.Effect<void, InventoryGUIError>

export const slotGridPosition = (options: {
  readonly index: number
  readonly columns: number
  readonly spacing: number
  readonly slotSize: number
}) =>
  pipe(
    Effect.Do,
    Effect.bind('column', () => Effect.succeed(options.index % options.columns)),
    Effect.bind('row', ({ column }) => Effect.succeed(Math.floor((options.index - column) / options.columns))),
    Effect.flatMap(({ column, row }) =>
      slotPositionFromCoordinates(
        column * (options.slotSize + options.spacing),
        row * (options.slotSize + options.spacing)
      )
    )
  )

const armorSlotMatches = (slotType: SlotType, metadata: Option.Option<ItemMetadata>) =>
  pipe(
    metadata,
    Option.flatMap((meta) => Option.fromNullable(meta.equipSlot)),
    Option.exists((equipSlot) =>
      pipe(
        slotType,
        Match.value,
        Match.when('armor-helmet', () => equipSlot === 'helmet'),
        Match.when('armor-chestplate', () => equipSlot === 'chestplate'),
        Match.when('armor-leggings', () => equipSlot === 'leggings'),
        Match.when('armor-boots', () => equipSlot === 'boots'),
        Match.orElse(() => false)
      )
    )
  )

const isFuel = (metadata: Option.Option<ItemMetadata>) =>
  pipe(
    metadata,
    Option.exists(
      (meta) =>
        pipe(
          Option.fromNullable(meta.category),
          Option.exists((category) => category === 'fuel')
        ) || (meta.fuelTicks ?? 0) > 0
    )
  )

export const slotAcceptsItem = (slot: InventorySlot, item: ItemStack) =>
  pipe(
    slot.visual.isDisabled,
    Match.value,
    Match.when(true, () => false),
    Match.orElse(() =>
      pipe(
        slot.slotType,
        Match.value,
        Match.when('crafting-output', () => false),
        Match.when('result', () => false),
        Match.when('fuel', () => isFuel(Option.fromNullable(item.metadata))),
        Match.when('offhand', () => true),
        Match.when('crafting-input', () => true),
        Match.when('normal', () => true),
        Match.orElse(() => armorSlotMatches(slot.slotType, Option.fromNullable(item.metadata)))
      )
    )
  )

const capitalize = (chunk: string) =>
  pipe(
    Option.fromNullable(chunk.at(0)),
    Option.match({
      onNone: () => chunk,
      onSome: (first) => `${first.toUpperCase()}${chunk.slice(1)}`,
    })
  )

export const formatItemName = (item: ItemStack) =>
  pipe(
    Option.fromNullable(item.metadata?.displayName),
    Option.map((value) => value),
    Option.getOrElse(() =>
      pipe(
        item.itemId.split(':'),
        (segments) => segments[segments.length - 1] ?? item.itemId,
        (identifier) => identifier.split('_'),
        (segments) => segments.map(capitalize).join(' ')
      )
    )
  )
