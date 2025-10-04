import { describe, expect, it } from '@effect/vitest'
import { Effect, Match, Option, Schema, pipe } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import type { ItemStack, SlotIndex, SlotType } from './inventory-adt'
import {
  DropResultSchema,
  InventoryGUIConfigSchema,
  ItemStackSchema,
  SlotPositionSchema,
  defaultInventoryGUIConfig,
  formatItemName,
  makeDropResult,
  makeInventorySlot,
  parseDragItemId,
  parseItemId,
  parseItemStack,
  parsePlayerId,
  parseSlotIndex,
  playerIdToString,
  slotAcceptsItem,
  slotGridPosition,
  slotIndexToNumber,
  slotPositionFromCoordinates,
} from './inventory-adt'

const runSuccess = <A>(program: Effect.Effect<A>): A =>
  pipe(
    Effect.runSyncExit(program),
    Match.value,
    Match.tag('Success', (exit) => exit.value),
    Match.tag('Failure', (exit) => {
      throw exit.error
    }),
    Match.exhaustive
  )

const expectFailure = <A>(program: Effect.Effect<A>) => {
  const exit = Effect.runSyncExit(program)
  expect(exit._tag).toBe('Failure')
  return exit
}

const allowedPlayerChars = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-']
const allowedItemChars = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_:.-']

const validPlayerIdArb = FastCheck.array(FastCheck.constantFrom(...allowedPlayerChars), {
  minLength: 1,
  maxLength: 64,
}).map((chars) => chars.join(''))

const invalidPlayerIdArb = FastCheck.oneof(
  FastCheck.constant(''),
  FastCheck.array(FastCheck.constantFrom(' ', '!', '@', '#', '%'), { minLength: 1, maxLength: 12 }).map((chars) =>
    chars.join('')
  ),
  FastCheck.array(FastCheck.constantFrom(...allowedPlayerChars), { minLength: 65, maxLength: 80 }).map((chars) =>
    chars.join('')
  )
)

const validItemIdArb = FastCheck.array(FastCheck.constantFrom(...allowedItemChars), {
  minLength: 1,
  maxLength: 80,
}).map((chars) => chars.join(''))

const invalidItemIdArb = FastCheck.oneof(
  FastCheck.constant(''),
  FastCheck.array(FastCheck.constantFrom(' ', '!', '&', '*'), { minLength: 1, maxLength: 20 }).map((chars) =>
    chars.join('')
  )
)

const slotIndexArb = FastCheck.integer({ min: 0, max: 512 })
const slotGridConfigArb = FastCheck.tuple(
  FastCheck.integer({ min: 0, max: 120 }),
  FastCheck.integer({ min: 1, max: 12 }),
  FastCheck.integer({ min: 0, max: 16 }),
  FastCheck.integer({ min: 4, max: 96 })
)

describe('presentation/inventory/adt', () => {
  describe('識別子とスキーマ', () => {
    it('有効なプレイヤーIDをデコードできる', () =>
      Effect.sync(() =>
        FastCheck.assert(
          FastCheck.property(validPlayerIdArb, (value) => {
            const decoded = runSuccess(parsePlayerId(value))
            expect(playerIdToString(decoded)).toBe(value)
          })
        )
      ))

    it('不正なプレイヤーIDは拒否される', () =>
      Effect.sync(() =>
        FastCheck.assert(
          FastCheck.property(invalidPlayerIdArb, (value) => {
            const exit = Effect.runSyncExit(parsePlayerId(value))
            expect(exit._tag).toBe('Failure')
          })
        )
      ))

    it('アイテムIDは正規パターンのみ許可される', () =>
      Effect.sync(() =>
        FastCheck.assert(
          FastCheck.property(validItemIdArb, (value) => {
            const decoded = runSuccess(parseItemId(value))
            expect(`${decoded}`).toBe(value)
          })
        )
      ))

    it('不正なアイテムIDは拒否される', () =>
      Effect.sync(() =>
        FastCheck.assert(
          FastCheck.property(invalidItemIdArb, (value) => {
            const exit = Effect.runSyncExit(parseItemId(value))
            expect(exit._tag).toBe('Failure')
          })
        )
      ))

    it('DragItemIdは非空文字列のみ許可される', () => {
      const decoded = runSuccess(parseDragItemId('drag-identifier'))
      expect(`${decoded}`).toBe('drag-identifier')
      expectFailure(parseDragItemId(''))
    })

    it('ItemStackは個数制約を満たす必要がある', () => {
      const valid = runSuccess(
        parseItemStack({
          itemId: 'minecraft:stone',
          count: 64,
        })
      )
      expect(valid.count).toBe(64)
      expectFailure(
        parseItemStack({
          itemId: 'minecraft:stone',
          count: 0,
        })
      )
      expectFailure(
        parseItemStack({
          itemId: 'minecraft:stone',
          count: 65,
        })
      )
    })

    it('ItemStackのメタデータもスキーマ検証される', () => {
      const result = runSuccess(
        parseItemStack({
          itemId: 'minecraft:iron_sword',
          count: 1,
          metadata: {
            displayName: 'Excalibur',
            lore: ['legendary'],
            durability: 0.75,
            enchantments: [{ id: 'sharpness', level: 5 }],
          },
        })
      )
      expect(result.metadata?.displayName).toBe('Excalibur')
      expectFailure(
        Schema.decode(ItemStackSchema)({
          itemId: 'minecraft:iron_sword',
          count: 1,
          metadata: {
            durability: -0.1,
          },
        })
      )
    })
  })

  describe('スロットユーティリティ', () => {
    const parseIndex = (value: number): SlotIndex => runSuccess(parseSlotIndex(value))

    const createStack = (input: Parameters<typeof parseItemStack>[0]): ItemStack => runSuccess(parseItemStack(input))

    it('SlotIndexは非負整数のみ許容する', () =>
      Effect.sync(() =>
        FastCheck.assert(
          FastCheck.property(slotIndexArb, (raw) => {
            const slot = runSuccess(parseSlotIndex(raw))
            expect(slotIndexToNumber(slot)).toBe(raw)
          })
        )
      ))

    it('SlotIndexは負数や小数を拒否する', () => {
      expectFailure(parseSlotIndex(-1))
      expectFailure(parseSlotIndex(1.5))
    })

    it.effect('座標ブランドは入力値を保持する', () =>
      Effect.gen(function* () {
        const position = yield* slotPositionFromCoordinates(32, 48)
        expect(position.x).toBe(32)
        expect(position.y).toBe(48)
        const validated = yield* Schema.decode(SlotPositionSchema)(position)
        expect(validated).toEqual(position)
      })
    )

    it('slotGridPositionは行列から座標を算出する', () =>
      Effect.sync(() =>
        FastCheck.assert(
          FastCheck.property(slotGridConfigArb, ([index, columns, spacing, size]) => {
            const position = runSuccess(
              slotGridPosition({
                index,
                columns,
                spacing,
                slotSize: size,
              })
            )
            const expectedColumn = index % columns
            const expectedRow = Math.floor(index / columns)
            expect(position.x).toBe(expectedColumn * (size + spacing))
            expect(position.y).toBe(expectedRow * (size + spacing))
          })
        )
      ))

    it('makeInventorySlotは視覚フラグの初期値をfalseにする', () => {
      const slot = makeInventorySlot({
        index: parseIndex(3),
        section: 'main',
        slotType: 'normal',
        position: runSuccess(slotPositionFromCoordinates(0, 0)),
        item: Option.none<ItemStack>(),
      })
      expect(slot.visual.isHighlighted).toBe(false)
      expect(slot.visual.isDisabled).toBe(false)
    })

    it('makeInventorySlotは指定したフラグを尊重する', () => {
      const slot = makeInventorySlot({
        index: parseIndex(7),
        section: 'hotbar',
        slotType: 'normal',
        position: runSuccess(slotPositionFromCoordinates(16, 16)),
        item: Option.some(createStack({ itemId: 'minecraft:diamond_sword', count: 1 })),
        isHighlighted: true,
        isDisabled: true,
      })
      expect(slot.visual.isHighlighted).toBe(true)
      expect(slot.visual.isDisabled).toBe(true)
      expect(Option.isSome(slot.item)).toBe(true)
    })

    it('slotAcceptsItemはスロット種別とメタデータを検証する', () => {
      const position = runSuccess(slotPositionFromCoordinates(0, 0))
      const createSlot = (slotType: SlotType, overrides?: { isDisabled?: boolean }) =>
        makeInventorySlot({
          index: parseIndex(0),
          section: 'main',
          slotType,
          position,
          item: Option.none<ItemStack>(),
          isDisabled: overrides?.isDisabled,
        })

      const stone = createStack({ itemId: 'minecraft:stone', count: 8 })
      expect(slotAcceptsItem(createSlot('normal'), stone)).toBe(true)
      expect(slotAcceptsItem(createSlot('normal', { isDisabled: true }), stone)).toBe(false)
      expect(slotAcceptsItem(createSlot('crafting-output'), stone)).toBe(false)
      expect(slotAcceptsItem(createSlot('offhand'), stone)).toBe(true)

      const fuelSlot = createSlot('fuel')
      const coal = createStack({
        itemId: 'minecraft:coal',
        count: 16,
        metadata: { category: 'fuel' },
      })
      expect(slotAcceptsItem(fuelSlot, coal)).toBe(true)
      const blazeRod = createStack({
        itemId: 'minecraft:blaze_rod',
        count: 1,
        metadata: { fuelTicks: 1200 },
      })
      expect(slotAcceptsItem(fuelSlot, blazeRod)).toBe(true)
      expect(slotAcceptsItem(fuelSlot, stone)).toBe(false)

      const armorCases: ReadonlyArray<{
        slotType: SlotType
        equipSlot: 'helmet' | 'chestplate' | 'leggings' | 'boots'
      }> = [
        { slotType: 'armor-helmet', equipSlot: 'helmet' },
        { slotType: 'armor-chestplate', equipSlot: 'chestplate' },
        { slotType: 'armor-leggings', equipSlot: 'leggings' },
        { slotType: 'armor-boots', equipSlot: 'boots' },
      ]

      const pickDifferentEquip = (current: 'helmet' | 'chestplate' | 'leggings' | 'boots') =>
        current === 'helmet' ? 'boots' : 'helmet'

      pipe(
        armorCases,
        Effect.forEach(({ slotType, equipSlot }) =>
          Effect.sync(() => {
            const armorSlot = createSlot(slotType)
            const matching = createStack({
              itemId: `minecraft:iron_${equipSlot}`,
              count: 1,
              metadata: {
                equipSlot,
                category: 'armor',
              },
            })
            expect(slotAcceptsItem(armorSlot, matching)).toBe(true)

            const mismatched = createStack({
              itemId: 'minecraft:iron_boots',
              count: 1,
              metadata: {
                equipSlot: pickDifferentEquip(equipSlot),
                category: 'armor',
              },
            })
            expect(slotAcceptsItem(armorSlot, mismatched)).toBe(false)
          })
        ),
        Effect.runSync
      )

      const armorSlotWithoutMeta = createSlot('armor-helmet')
      expect(slotAcceptsItem(armorSlotWithoutMeta, createStack({ itemId: 'minecraft:iron_helmet', count: 1 }))).toBe(
        false
      )
    })
  })

  describe('表示ユーティリティ', () => {
    it('formatItemNameはdisplayNameを優先する', () => {
      const item = runSuccess(
        parseItemStack({
          itemId: 'minecraft:diamond_sword',
          count: 1,
          metadata: { displayName: 'Excalibur' },
        })
      )
      expect(formatItemName(item)).toBe('Excalibur')
    })

    it('formatItemNameは識別子から名称を生成する', () => {
      const item = runSuccess(parseItemStack({ itemId: 'minecraft:iron_sword', count: 1 }))
      expect(formatItemName(item)).toBe('Iron Sword')
    })

    it('formatItemNameは空セグメントも扱える', () => {
      const item = runSuccess(parseItemStack({ itemId: 'minecraft:', count: 1 }))
      expect(formatItemName(item)).toBe('')
    })

    it.effect('defaultInventoryGUIConfigはスキーマを満たす', () =>
      Effect.gen(function* () {
        const validated = yield* Schema.decode(InventoryGUIConfigSchema)(defaultInventoryGUIConfig)
        expect(validated.slotSize).toBe(48)
        expect(validated.theme.slotHover).toBe('#3a3a3a')
      })
    )

    it('makeDropResultはスキーマ検証を実行する', () => {
      const source = runSuccess(parseSlotIndex(1))
      const target = runSuccess(parseSlotIndex(2))
      const drop = runSuccess(
        makeDropResult({
          accepted: true,
          action: 'swap',
          sourceSlot: source,
          targetSlot: target,
          amount: 3,
        })
      )
      expect(drop.action).toBe('swap')
      expect(drop.amount).toBe(3)
      expectFailure(
        Schema.decode(DropResultSchema)({
          accepted: true,
          action: 'move',
          sourceSlot: source,
          targetSlot: target,
          amount: -1,
        })
      )
    })
  })
})
