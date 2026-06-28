import { describe, it } from '@effect/vitest'
import { Option } from 'effect'
import { expect } from 'vitest'
import type { InventoryItem } from '@ts-minecraft/core'
import type { Recipe } from '@ts-minecraft/inventory/domain/crafting'
import { renderCraftingPreview, renderRecipeBook, renderSlotElements } from './inventory-renderer-refresh'

const makeSlotElement = (): HTMLDivElement => {
  const attributes = new Map<string, string>()
  return {
    dataset: {},
    style: { cssText: '' },
    textContent: '',
    title: '',
    setAttribute: (name: string, value: string) => {
      attributes.set(name, value)
    },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    removeAttribute: (name: string) => {
      attributes.delete(name)
    },
    } as unknown as HTMLDivElement
}

const makeContainerElement = (): HTMLDivElement & { readonly childrenList: Array<unknown>; innerHTML: string } => {
  const childrenList: Array<unknown> = []
  return {
    childrenList,
    innerHTML: '',
    style: { cssText: '' },
    textContent: '',
  } as HTMLDivElement & { readonly childrenList: Array<unknown>; innerHTML: string }
}

const makeDom = () => ({
  createElement: (_tagName: string) => makeContainerElement(),
  appendChildTo: (parent: HTMLDivElement & { readonly childrenList: Array<unknown> }, child: unknown) => {
    parent.childrenList.push(child)
  },
})

describe('presentation/inventory/inventory-renderer-refresh', () => {
  it('adds a readable item hover tooltip with enchantments', () => {
    const slotEl = makeSlotElement()

    renderSlotElements(
      [slotEl],
      [
        Option.some({
          itemType: 'DIAMOND_SWORD' as InventoryItem,
          count: 1,
          enchantments: [
            { type: 'SHARPNESS', level: 4 },
            { type: 'MENDING', level: 1 },
          ] as const,
        }),
      ],
      -1,
    )

    expect(slotEl.title).toBe('Diamond Sword\nCount: 1\nEnchantments:\nSharpness IV\nMending I')
    expect(slotEl.dataset['tooltip']).toBe(slotEl.title)
    expect(slotEl.getAttribute('aria-label')).toBe('Diamond Sword, Count: 1, Enchantments:, Sharpness IV, Mending I')
  })

  it('clears a stale tooltip when a slot becomes empty', () => {
    const slotEl = makeSlotElement()

    renderSlotElements(
      [slotEl],
      [Option.some({ itemType: 'DIRT' as InventoryItem, count: 64 })],
      -1,
    )
    expect(slotEl.title).toBe('Dirt\nCount: 64')

    renderSlotElements([slotEl], [Option.none()], -1)

    expect(slotEl.title).toBe('')
    expect(slotEl.dataset['tooltip']).toBeUndefined()
    expect(slotEl.getAttribute('aria-label')).toBeNull()
  })

  it('renders a selected crafting recipe preview', () => {
    const dom = makeDom()
    const container = makeContainerElement()
    const recipes: ReadonlyArray<Recipe> = [
      {
        id: 'wooden-sword',
        station: 'crafting_table',
        ingredients: [
          { itemType: 'PLANKS', count: 2 },
          { itemType: 'STICK', count: 1 },
        ],
        output: { itemType: 'WOODEN_SWORD', count: 1 },
      },
    ]

    renderCraftingPreview(dom as never, Option.some(container), recipes, 0)

    expect(container.childrenList).toHaveLength(3)
    expect((container.childrenList[0] as HTMLDivElement).textContent).toBe('Selected Recipe')
    expect((container.childrenList[1] as HTMLDivElement).textContent).toBe('Crafting Table • Produces 1 Wooden Sword')

    const ingredients = container.childrenList[2] as HTMLDivElement & { readonly childrenList: Array<HTMLDivElement> }
    expect(ingredients.childrenList).toHaveLength(2)
    expect(ingredients.childrenList[0]?.textContent).toBe('2 Planks')
    expect(ingredients.childrenList[1]?.textContent).toBe('1 Stick')
  })

  it('renders the recipe book list', () => {
    const dom = makeDom()
    const container = makeContainerElement()
    const recipes: ReadonlyArray<Recipe> = [
      {
        id: 'wooden-sword',
        station: 'crafting_table',
        ingredients: [
          { itemType: 'PLANKS', count: 2 },
          { itemType: 'STICK', count: 1 },
        ],
        output: { itemType: 'WOODEN_SWORD', count: 1 },
      },
      {
        id: 'iron-ingot',
        station: 'furnace',
        ingredients: [
          { itemType: 'RAW_IRON', count: 1 },
        ],
        output: { itemType: 'IRON_INGOT', count: 1 },
      },
    ]

    renderRecipeBook(dom as never, Option.some(container), recipes, '')

    expect(container.childrenList).toHaveLength(2)
    expect((container.childrenList[0] as HTMLButtonElement).dataset['recipeId']).toBe('wooden-sword')
    expect((container.childrenList[0] as HTMLButtonElement).textContent).toBe('2 PLANKS + 1 STICK → 1 WOODEN_SWORD [Crafting Table]')
    expect((container.childrenList[1] as HTMLButtonElement).dataset['recipeId']).toBe('iron-ingot')
    expect((container.childrenList[1] as HTMLButtonElement).textContent).toBe('1 RAW_IRON → 1 IRON_INGOT [Furnace]')
  })

  it('filters the recipe book by search text', () => {
    const dom = makeDom()
    const container = makeContainerElement()
    const recipes: ReadonlyArray<Recipe> = [
      {
        id: 'wooden-sword',
        station: 'crafting_table',
        ingredients: [
          { itemType: 'PLANKS', count: 2 },
          { itemType: 'STICK', count: 1 },
        ],
        output: { itemType: 'WOODEN_SWORD', count: 1 },
      },
      {
        id: 'iron-ingot',
        station: 'furnace',
        ingredients: [
          { itemType: 'RAW_IRON', count: 1 },
        ],
        output: { itemType: 'IRON_INGOT', count: 1 },
      },
    ]

    renderRecipeBook(dom as never, Option.some(container), recipes, 'sword')

    expect(container.childrenList).toHaveLength(1)
    expect((container.childrenList[0] as HTMLButtonElement).dataset['recipeId']).toBe('wooden-sword')
  })
})
