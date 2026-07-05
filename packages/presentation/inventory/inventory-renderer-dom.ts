import { Array as Arr, Option } from 'effect'
import { INVENTORY_SIZE, HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { CHEST_SIZE } from '@ts-minecraft/inventory/domain/chest-service.config'
import {
  DEFAULT_SLOT_COLOR, SLOT_EL_STYLE,
  OVERLAY_STYLE, OVERLAY_TITLE_STYLE,
  CHEST_GRID_STYLE, CHEST_SECTION_STYLE, CHEST_TITLE_STYLE,
  MAIN_GRID_STYLE, HOTBAR_GRID_STYLE, SEPARATOR_STYLE,
  CRAFTING_TITLE_STYLE, CRAFTING_PREVIEW_STYLE, CRAFTING_LIST_STYLE, STATUS_STYLE,
  RECIPE_BOOK_SEARCH_LABEL_STYLE, RECIPE_BOOK_SEARCH_INPUT_STYLE,
} from './inventory-renderer.config'

export type OverlayDom = {
  readonly overlayEl: Option.Option<HTMLDivElement>
  readonly chestContainerEl: Option.Option<HTMLDivElement>
  readonly chestSlotEls: HTMLDivElement[]
  readonly slotEls: HTMLDivElement[]
  readonly cursorEl: Option.Option<HTMLDivElement>
  readonly recipeBookEl: Option.Option<HTMLDivElement>
  readonly recipeBookSearchEl: Option.Option<HTMLInputElement>
  readonly craftingPreviewEl: Option.Option<HTMLDivElement>
  readonly craftingListEl: Option.Option<HTMLDivElement>
  readonly craftGridCellEls: HTMLDivElement[]
  readonly craftGridOutputEl: Option.Option<HTMLDivElement>
  readonly statusEl: Option.Option<HTMLDivElement>
  readonly sortButtonEl: Option.Option<HTMLButtonElement>
}

const INVENTORY_CURSOR_STYLE = [
  SLOT_EL_STYLE,
  'position:fixed',
  'left:0',
  'top:0',
  'width:40px',
  'height:40px',
  'z-index:1001',
  'pointer-events:none',
  'cursor:inherit',
  'display:none',
  'transform:translate(-9999px,-9999px)',
  'opacity:0.95',
].join(';')

// Dark text on the light-grey (#c6c6c6) inventory panel — #d7c9a8 cream was for
// a dark theme and rendered at 1.04:1 (invisible). #404040 gives 6.19:1 (WCAG AA).
const OVERLAY_DESCRIPTION_STYLE = 'margin:-6px 0 12px;color:#404040;font-size:12px;line-height:1.4'

/* c8 ignore next 5 */
export const createSlotEl = (dom: DomOperationsService, index: number): HTMLDivElement => {
  const el = dom.createElement('div')
  el.dataset['slot'] = String(index)
  el.draggable = true
  el.style.cssText = `${SLOT_EL_STYLE};background:${DEFAULT_SLOT_COLOR}`
  return el
}

/* c8 ignore next 5 */
export const createChestSlotEl = (dom: DomOperationsService, index: number): HTMLDivElement => {
  const el = dom.createElement('div')
  el.dataset['chestSlot'] = String(index)
  el.draggable = true
  el.style.cssText = `${SLOT_EL_STYLE};background:${DEFAULT_SLOT_COLOR}`
  return el
}

/* c8 ignore next 2 */
export const buildOverlayDom = (dom: DomOperationsService): OverlayDom => {
  if (typeof document === 'undefined') {
    return {
      overlayEl: Option.none(),
      chestContainerEl: Option.none(),
      chestSlotEls: [],
      slotEls: [],
      cursorEl: Option.none(),
      recipeBookEl: Option.none(),
      recipeBookSearchEl: Option.none(),
      craftingPreviewEl: Option.none(),
      craftingListEl: Option.none(),
      craftGridCellEls: [],
      craftGridOutputEl: Option.none(),
      statusEl: Option.none(),
      sortButtonEl: Option.none(),
    }
  }
  /* c8 ignore start */

  const el = dom.createElement('div')
  el.id = 'inventory-overlay'
  el.tabIndex = -1
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.setAttribute('aria-labelledby', 'inventory-overlay-title')
  el.setAttribute('aria-describedby', 'inventory-overlay-description inventory-overlay-status')
  el.style.cssText = OVERLAY_STYLE

  const title = dom.createElement('div')
  title.id = 'inventory-overlay-title'
  title.textContent = 'Inventory'
  title.style.cssText = OVERLAY_TITLE_STYLE
  dom.appendChildTo(el, title)

  const description = dom.createElement('p')
  description.id = 'inventory-overlay-description'
  description.textContent = 'Manage items, craft recipes, and press Escape to return to the game.'
  description.style.cssText = OVERLAY_DESCRIPTION_STYLE
  dom.appendChildTo(el, description)

  const sortButton = dom.createElement('button') as HTMLButtonElement
  sortButton.type = 'button'
  sortButton.textContent = 'Sort Inventory (R)'
  sortButton.title = 'Sort inventory slots'
  sortButton.setAttribute('aria-label', 'Sort inventory slots')
  sortButton.dataset['inventoryAction'] = 'sort'
  sortButton.style.cssText = 'margin:0 0 12px 0;padding:6px 10px;background:#6b5b3e;color:#f5e6c8;border:1px solid #d7b46a;border-radius:4px;cursor:pointer'
  dom.appendChildTo(el, sortButton)

  const chestContainer = dom.createElement('div')
  chestContainer.style.cssText = CHEST_SECTION_STYLE
  const chestTitle = dom.createElement('div')
  chestTitle.textContent = 'Chest'
  chestTitle.style.cssText = CHEST_TITLE_STYLE
  dom.appendChildTo(chestContainer, chestTitle)
  const chestGrid = dom.createElement('div')
  chestGrid.style.cssText = CHEST_GRID_STYLE
  const chestSlots = Arr.makeBy(CHEST_SIZE, (i) => createChestSlotEl(dom, i))
  Arr.forEach(chestSlots, (slotEl) => dom.appendChildTo(chestGrid, slotEl))
  dom.appendChildTo(chestContainer, chestGrid)
  dom.appendChildTo(el, chestContainer)

  // Main grid (3 rows × 9 = slots 0-26)
  const mainGrid = dom.createElement('div')
  mainGrid.style.cssText = MAIN_GRID_STYLE
  const mainSlots = Arr.makeBy(HOTBAR_START, (i) => createSlotEl(dom, i))
  Arr.forEach(mainSlots, (slotEl) => dom.appendChildTo(mainGrid, slotEl))
  dom.appendChildTo(el, mainGrid)

  // Separator
  const sep = dom.createElement('hr')
  sep.style.cssText = SEPARATOR_STYLE
  dom.appendChildTo(el, sep)

  // Hotbar row (slots 27-35)
  const hotbarGrid = dom.createElement('div')
  hotbarGrid.style.cssText = HOTBAR_GRID_STYLE
  const hotbarSlots = Arr.makeBy(INVENTORY_SIZE - HOTBAR_START, (i) => createSlotEl(dom, HOTBAR_START + i))
  Arr.forEach(hotbarSlots, (slotEl) => dom.appendChildTo(hotbarGrid, slotEl))
  dom.appendChildTo(el, hotbarGrid)

  const craftingTitle = dom.createElement('div')
  craftingTitle.textContent = 'Crafting'
  craftingTitle.style.cssText = CRAFTING_TITLE_STYLE
  dom.appendChildTo(el, craftingTitle)

  // Interactive 3x3 shaped-crafting grid: place items with the cursor, click
  // the output to craft. Cells are real stacks (spilled back on close).
  const craftGridRow = dom.createElement('div')
  craftGridRow.style.cssText = 'display:flex;align-items:center;gap:14px;margin:4px 0 10px'
  const craftGrid = dom.createElement('div')
  craftGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3, 40px);gap:4px'
  const craftGridCells = Arr.makeBy(9, (i) => {
    const cell = dom.createElement('div')
    cell.dataset['craftCell'] = String(i)
    cell.style.cssText = `${SLOT_EL_STYLE};background:${DEFAULT_SLOT_COLOR}`
    return cell
  })
  Arr.forEach(craftGridCells, (cell) => dom.appendChildTo(craftGrid, cell))
  dom.appendChildTo(craftGridRow, craftGrid)
  const craftGridArrow = dom.createElement('div')
  craftGridArrow.textContent = '→'
  craftGridArrow.style.cssText = 'color:#404040;font-size:20px'
  dom.appendChildTo(craftGridRow, craftGridArrow)
  const craftGridOutput = dom.createElement('div')
  craftGridOutput.dataset['craftOutput'] = 'true'
  craftGridOutput.style.cssText = `${SLOT_EL_STYLE};background:${DEFAULT_SLOT_COLOR}`
  dom.appendChildTo(craftGridRow, craftGridOutput)
  dom.appendChildTo(el, craftGridRow)

  const recipeBookTitle = dom.createElement('div')
  recipeBookTitle.textContent = 'Recipe Book'
  recipeBookTitle.style.cssText = CRAFTING_TITLE_STYLE
  dom.appendChildTo(el, recipeBookTitle)

  const recipeBookSearchLabel = dom.createElement('div')
  recipeBookSearchLabel.id = 'inventory-recipe-search-label'
  recipeBookSearchLabel.textContent = 'Search recipes'
  recipeBookSearchLabel.style.cssText = RECIPE_BOOK_SEARCH_LABEL_STYLE
  dom.appendChildTo(el, recipeBookSearchLabel)

  const recipeBookSearch = dom.createElement('input') as HTMLInputElement
  recipeBookSearch.id = 'inventory-recipe-search'
  recipeBookSearch.type = 'search'
  recipeBookSearch.placeholder = 'Search by name, ingredient, or station'
  recipeBookSearch.value = ''
  recipeBookSearch.setAttribute('aria-labelledby', 'inventory-recipe-search-label')
  recipeBookSearch.style.cssText = RECIPE_BOOK_SEARCH_INPUT_STYLE
  dom.appendChildTo(el, recipeBookSearch)

  const recipeBook = dom.createElement('div')
  recipeBook.style.cssText = CRAFTING_LIST_STYLE
  dom.appendChildTo(el, recipeBook)

  const craftingPreview = dom.createElement('div')
  craftingPreview.style.cssText = CRAFTING_PREVIEW_STYLE
  dom.appendChildTo(el, craftingPreview)

  const craftingList = dom.createElement('div')
  craftingList.style.cssText = CRAFTING_LIST_STYLE
  dom.appendChildTo(el, craftingList)

  const status = dom.createElement('div')
  status.id = 'inventory-overlay-status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  status.style.cssText = STATUS_STYLE
  status.textContent = 'Click a recipe to craft it.'
  dom.appendChildTo(el, status)

  const cursor = dom.createElement('div')
  cursor.dataset['inventoryCursor'] = 'held'
  cursor.style.cssText = `${INVENTORY_CURSOR_STYLE};background:${DEFAULT_SLOT_COLOR}`
  dom.appendChildTo(el, cursor)

  dom.appendChild(el)

  return {
    overlayEl: Option.some(el),
    chestContainerEl: Option.some(chestContainer),
    chestSlotEls: chestSlots,
    slotEls: Arr.appendAll(mainSlots, hotbarSlots),
    cursorEl: Option.some(cursor),
    recipeBookEl: Option.some(recipeBook),
    recipeBookSearchEl: Option.some(recipeBookSearch),
    craftingPreviewEl: Option.some(craftingPreview),
    craftingListEl: Option.some(craftingList),
    craftGridCellEls: craftGridCells,
    craftGridOutputEl: Option.some(craftGridOutput),
    statusEl: Option.some(status),
    sortButtonEl: Option.some(sortButton),
  }
  /* c8 ignore stop */
}
