import { Array as Arr, Option } from 'effect'
import { HOTBAR_START, type InventorySlot } from '@ts-minecraft/inventory/application/inventory-service'
import type { Enchantment } from '@ts-minecraft/inventory/domain/enchantment.types'
import type { ItemStack } from '@ts-minecraft/inventory/domain/item-stack'
import type { Recipe } from '@ts-minecraft/inventory/domain/crafting'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { getSlotColor, getSlotImageStyle } from './inventory-renderer-helpers'
import {
  DEFAULT_SLOT_COLOR,
  EMPTY_RECIPE_STYLE, RECIPE_ROW_BASE_STYLE,
  RECIPE_ROW_SELECTED_BG, RECIPE_ROW_SELECTED_BORDER,
  RECIPE_ROW_DEFAULT_BG, RECIPE_ROW_DEFAULT_BORDER,
  CRAFTING_PREVIEW_EMPTY_STYLE, CRAFTING_PREVIEW_INGREDIENTS_STYLE,
  CRAFTING_PREVIEW_INGREDIENT_STYLE, CRAFTING_PREVIEW_META_STYLE,
  CRAFTING_PREVIEW_TITLE_STYLE,
  SLOT_BORDER_SELECTED, SLOT_BORDER_DEFAULT,
} from './inventory-renderer.config'

type RenderableSlot = InventorySlot

const ROMAN_LEVELS: Readonly<Record<number, string>> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
}

const formatLabel = (value: string): string =>
  value
    .split('_')
    .map((part) => part.length === 0 ? part : `${part[0]!.toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ')

const formatEnchantment = (enchantment: Enchantment): string =>
  `${formatLabel(enchantment.type)} ${ROMAN_LEVELS[enchantment.level] ?? String(enchantment.level)}`

const buildSlotTooltip = (stack: ItemStack): string => {
  const enchantments = stack.enchantments ?? []
  const lines = [formatLabel(stack.itemType), `Count: ${stack.count}`]
  return enchantments.length === 0
    ? lines.join('\n')
    : [...lines, 'Enchantments:', ...enchantments.map(formatEnchantment)].join('\n')
}

const renderStackVisual = (el: HTMLDivElement, stack: ItemStack): void => {
  const imageStyle = getSlotImageStyle(stack.itemType)
  if (imageStyle) {
    el.style.cssText = el.style.cssText.replace(/background:[^;]+;?/, '')
    el.style.backgroundImage = imageStyle
    el.style.backgroundSize = 'cover'
  } else {
    el.style.backgroundImage = ''
    el.style.backgroundSize = ''
    el.style.background = getSlotColor(stack.itemType)
  }
  const tooltip = buildSlotTooltip(stack)
  el.title = tooltip
  el.dataset['tooltip'] = tooltip
  el.setAttribute?.('aria-label', tooltip.replace(/\n/g, ', '))
  el.textContent = stack.count < 64 ? String(stack.count) : ''
}

const clearStackVisual = (el: HTMLDivElement): void => {
  el.style.backgroundImage = ''
  el.style.backgroundSize = ''
  el.style.background = DEFAULT_SLOT_COLOR
  el.title = ''
  delete el.dataset['tooltip']
  el.removeAttribute?.('aria-label')
  el.textContent = ''
}

const formatStationLabel = (station: Recipe['station']): string =>
  station === 'crafting_table'
    ? 'Crafting Table'
    : station === 'furnace'
      ? 'Furnace'
      : 'Inventory'

const normalizeSearchText = (value: string): string =>
  value.trim().toLowerCase().replace(/_/g, ' ')

const recipeSearchText = (recipe: Recipe): string =>
  normalizeSearchText([
    recipe.id,
    recipe.station,
    recipe.output.itemType,
    ...recipe.ingredients.map((ingredient) => ingredient.itemType),
  ].join(' '))

const formatIngredientLine = (ingredients: Recipe['ingredients']): string => {
  let line = ''
  for (let index = 0; index < ingredients.length; index += 1) {
    const ingredient = ingredients[index]!
    if (index > 0) {
      line += ' + '
    }
    line += `${ingredient.count} ${ingredient.itemType}`
  }
  return line
}

const recipeMatchesSearch = (recipe: Recipe, searchQuery: string): boolean => {
  const normalizedQuery = normalizeSearchText(searchQuery)
  if (normalizedQuery.length === 0) return true
  return recipeSearchText(recipe).includes(normalizedQuery)
}

/* c8 ignore start */
export const renderSlotElements = (
  slotEls: HTMLDivElement[],
  allSlots: ReadonlyArray<RenderableSlot>,
  selectedHotbarIdx: number,
): void => {
  Arr.forEach(Arr.zip(slotEls, allSlots), ([el, itemOpt], i) => {
    const stack = Option.getOrNull(itemOpt)
    if (stack !== null) {
      renderStackVisual(el, stack)
    } else {
      clearStackVisual(el)
    }
    el.style.border = i >= HOTBAR_START && i === selectedHotbarIdx
      ? SLOT_BORDER_SELECTED
      : SLOT_BORDER_DEFAULT
  })
}

export const renderCraftingGridCells = (
  cellEls: HTMLDivElement[],
  cells: ReadonlyArray<RenderableSlot>,
): void => {
  Arr.forEach(Arr.zip(cellEls, cells), ([el, itemOpt]) => {
    const stack = Option.getOrNull(itemOpt)
    if (stack !== null) {
      renderStackVisual(el, stack)
    } else {
      clearStackVisual(el)
    }
  })
}

// Output cell shows the matched shaped recipe's result (clickable to craft);
// empty grid or no match clears it.
export const renderCraftingGridOutput = (
  outputEl: Option.Option<HTMLDivElement>,
  matched: Recipe | null,
): void => {
  Option.map(outputEl, (el) => {
    if (matched === null) {
      clearStackVisual(el)
      el.style.cursor = ''
      return
    }
    renderStackVisual(el, {
      itemType: matched.output.itemType,
      count: matched.output.count,
      durability: null,
      enchantments: [],
    } as unknown as ItemStack)
    el.title = `Craft ${matched.output.count} ${formatLabel(matched.output.itemType)}`
    el.style.cursor = 'pointer'
  })
}

export const renderInventoryCursor = (
  cursorEl: Option.Option<HTMLDivElement>,
  cursor: InventorySlot,
): void => {
  Option.map(cursorEl, (el) => {
    const stack = Option.getOrNull(cursor)
    if (stack === null) {
      clearStackVisual(el)
      el.style.display = 'none'
      return
    }
    renderStackVisual(el, stack)
    el.style.display = 'flex'
  })
}

export const renderCraftingList = (
  dom: DomOperationsService,
  craftingListEl: Option.Option<HTMLDivElement>,
  craftableRecipes: ReadonlyArray<Recipe>,
  selectedRecipeIndex: number,
): void => {
  Option.map(craftingListEl, (container) => {
    container.innerHTML = ''
    if (craftableRecipes.length === 0) {
      const empty = dom.createElement('div')
      empty.textContent = 'No craftable recipes yet.'
      empty.style.cssText = EMPTY_RECIPE_STYLE
      dom.appendChildTo(container, empty)
      return
    }

    Arr.forEach(craftableRecipes, (recipe, index) => {
      const row = dom.createElement('button')
      row.dataset['recipeId'] = recipe.id
      const isSelected = index === selectedRecipeIndex
      row.style.cssText = [
        RECIPE_ROW_BASE_STYLE,
        'border:1px solid ' + (isSelected ? RECIPE_ROW_SELECTED_BORDER : RECIPE_ROW_DEFAULT_BORDER),
        'background:' + (isSelected ? RECIPE_ROW_SELECTED_BG : RECIPE_ROW_DEFAULT_BG),
      ].join(';')
      const stationLabel = recipe.station === 'crafting_table'
        ? ' [Crafting Table]'
        : recipe.station === 'furnace'
          ? ' [Furnace]'
          : recipe.station === 'brewing_stand'
            ? ' [Brewing Stand]'
            : ''
      row.textContent = `${formatIngredientLine(recipe.ingredients)} → ${recipe.output.count} ${recipe.output.itemType}${stationLabel}`
      dom.appendChildTo(container, row)
    })
  })
}

export const renderRecipeBook = (
  dom: DomOperationsService,
  recipeBookEl: Option.Option<HTMLDivElement>,
  recipes: ReadonlyArray<Recipe>,
  searchQuery: string,
  craftableRecipeIds?: ReadonlySet<string>,
): void => {
  Option.map(recipeBookEl, (container) => {
    container.innerHTML = ''
    const visibleRecipes = recipes.filter((recipe) => recipeMatchesSearch(recipe, searchQuery))

    if (recipes.length === 0) {
      const empty = dom.createElement('div')
      empty.textContent = 'No recipes available.'
      empty.style.cssText = EMPTY_RECIPE_STYLE
      dom.appendChildTo(container, empty)
      return
    }

    if (visibleRecipes.length === 0) {
      const empty = dom.createElement('div')
      empty.textContent = 'No recipes match your search.'
      empty.style.cssText = EMPTY_RECIPE_STYLE
      dom.appendChildTo(container, empty)
      return
    }

    Arr.forEach(visibleRecipes, (recipe) => {
      const row = dom.createElement('button')
      const dataRow = row as HTMLButtonElement & { dataset?: Record<string, string> }
      dataRow.dataset ??= {}
      dataRow.dataset['recipeId'] = recipe.id
      // Dim recipes the player cannot craft right now so the book doubles as
      // a "what am I missing" view; clicking one still reports the shortfall.
      const isCraftable = craftableRecipeIds === undefined || craftableRecipeIds.has(recipe.id)
      row.style.cssText = [
        RECIPE_ROW_BASE_STYLE,
        'border:1px solid ' + RECIPE_ROW_DEFAULT_BORDER,
        'background:' + RECIPE_ROW_DEFAULT_BG,
        ...(isCraftable ? [] : ['opacity:0.45']),
      ].join(';')
      if (!isCraftable) row.title = 'Missing materials'
      const stationLabel = recipe.station === 'crafting_table'
        ? ' [Crafting Table]'
        : recipe.station === 'furnace'
          ? ' [Furnace]'
          : recipe.station === 'brewing_stand'
            ? ' [Brewing Stand]'
            : ''
      row.textContent = `${formatIngredientLine(recipe.ingredients)} → ${recipe.output.count} ${recipe.output.itemType}${stationLabel}`
      dom.appendChildTo(container, row)
    })
  })
}

export const renderCraftingPreview = (
  dom: DomOperationsService,
  craftingPreviewEl: Option.Option<HTMLDivElement>,
  craftableRecipes: ReadonlyArray<Recipe>,
  selectedRecipeIndex: number,
): void => {
  Option.map(craftingPreviewEl, (container) => {
    container.innerHTML = ''

    const title = dom.createElement('div')
    title.textContent = 'Selected Recipe'
    title.style.cssText = CRAFTING_PREVIEW_TITLE_STYLE
    dom.appendChildTo(container, title)

    const recipe = Option.getOrNull(Arr.get(craftableRecipes, selectedRecipeIndex))
    if (recipe === null) {
      const empty = dom.createElement('div')
      empty.textContent = craftableRecipes.length === 0
        ? 'No craftable recipes yet.'
        : 'Select a recipe to see its ingredients.'
      empty.style.cssText = CRAFTING_PREVIEW_EMPTY_STYLE
      dom.appendChildTo(container, empty)
      return
    }

    const meta = dom.createElement('div')
    meta.textContent = `${formatStationLabel(recipe.station)} • Produces ${recipe.output.count} ${formatLabel(recipe.output.itemType)}`
    meta.style.cssText = CRAFTING_PREVIEW_META_STYLE
    dom.appendChildTo(container, meta)

    const ingredients = dom.createElement('div')
    ingredients.style.cssText = CRAFTING_PREVIEW_INGREDIENTS_STYLE
    Arr.forEach(recipe.ingredients, (ingredient) => {
      const chip = dom.createElement('div')
      chip.textContent = `${ingredient.count} ${formatLabel(ingredient.itemType)}`
      chip.style.cssText = CRAFTING_PREVIEW_INGREDIENT_STYLE
      dom.appendChildTo(ingredients, chip)
    })
    dom.appendChildTo(container, ingredients)

    // Shaped recipes show their 3x3 layout (rows of cells; '·' = empty), so
    // the recipe book teaches the vanilla arrangement.
    if (recipe.shaped !== undefined) {
      const grid = dom.createElement('div')
      grid.style.cssText = SHAPED_GRID_STYLE
      for (const patternRow of recipe.shaped.pattern) {
        const rowEl = dom.createElement('div')
        rowEl.style.cssText = SHAPED_GRID_ROW_STYLE
        for (const char of patternRow.padEnd(3, ' ')) {
          const cell = dom.createElement('div')
          const item = char === ' ' ? undefined : recipe.shaped.key[char]
          cell.textContent = item === undefined ? '·' : formatLabel(item).slice(0, 2)
          cell.title = item === undefined ? '' : formatLabel(item)
          cell.style.cssText = item === undefined ? SHAPED_GRID_CELL_EMPTY_STYLE : SHAPED_GRID_CELL_STYLE
          dom.appendChildTo(rowEl, cell)
        }
        dom.appendChildTo(grid, rowEl)
      }
      dom.appendChildTo(container, grid)
    }
  })
}

const SHAPED_GRID_STYLE = 'display:flex;flex-direction:column;gap:2px;margin-top:6px'
const SHAPED_GRID_ROW_STYLE = 'display:flex;gap:2px'
const SHAPED_GRID_CELL_STYLE = [
  'width:26px', 'height:26px', 'display:flex', 'align-items:center', 'justify-content:center',
  'background:#3c3c3c', 'border:1px solid #666', 'color:#eee', 'font-size:10px',
].join(';')
const SHAPED_GRID_CELL_EMPTY_STYLE = [
  'width:26px', 'height:26px', 'display:flex', 'align-items:center', 'justify-content:center',
  'background:#242424', 'border:1px solid #444', 'color:#555', 'font-size:10px',
].join(';')

export const renderStatusEl = (
  statusEl: Option.Option<HTMLDivElement>,
  statusMessage: string,
): void => {
  Option.map(statusEl, (el) => {
    el.textContent = statusMessage
  })
}
/* c8 ignore stop */
