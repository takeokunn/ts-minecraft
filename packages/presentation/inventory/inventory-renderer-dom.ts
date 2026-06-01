import { Array as Arr, Option } from 'effect'
import { INVENTORY_SIZE, HOTBAR_START } from '@ts-minecraft/inventory'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import {
  DEFAULT_SLOT_COLOR, SLOT_EL_STYLE,
  OVERLAY_STYLE, OVERLAY_TITLE_STYLE,
  MAIN_GRID_STYLE, HOTBAR_GRID_STYLE, SEPARATOR_STYLE,
  CRAFTING_TITLE_STYLE, CRAFTING_LIST_STYLE, STATUS_STYLE,
} from './inventory-renderer.config'

export type OverlayDom = {
  readonly overlayEl: Option.Option<HTMLDivElement>
  readonly slotEls: HTMLDivElement[]
  readonly craftingListEl: Option.Option<HTMLDivElement>
  readonly statusEl: Option.Option<HTMLDivElement>
}

/* c8 ignore next 5 */
export const createSlotEl = (dom: DomOperationsService, index: number): HTMLDivElement => {
  const el = dom.createElement('div')
  el.dataset['slot'] = String(index)
  el.style.cssText = `${SLOT_EL_STYLE};background:${DEFAULT_SLOT_COLOR}`
  return el
}

/* c8 ignore next 2 */
export const buildOverlayDom = (dom: DomOperationsService): OverlayDom => {
  if (typeof document === 'undefined') {
    return {
      overlayEl: Option.none(),
      slotEls: [],
      craftingListEl: Option.none(),
      statusEl: Option.none(),
    }
  }
  /* c8 ignore start */

  const el = dom.createElement('div')
  el.id = 'inventory-overlay'
  el.style.cssText = OVERLAY_STYLE

  const title = dom.createElement('div')
  title.textContent = 'Inventory'
  title.style.cssText = OVERLAY_TITLE_STYLE
  dom.appendChildTo(el, title)

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

  const craftingList = dom.createElement('div')
  craftingList.style.cssText = CRAFTING_LIST_STYLE
  dom.appendChildTo(el, craftingList)

  const status = dom.createElement('div')
  status.style.cssText = STATUS_STYLE
  status.textContent = 'Click a recipe to craft it.'
  dom.appendChildTo(el, status)

  dom.appendChild(el)

  return {
    overlayEl: Option.some(el),
    slotEls: Arr.appendAll(mainSlots, hotbarSlots),
    craftingListEl: Option.some(craftingList),
    statusEl: Option.some(status),
  }
  /* c8 ignore stop */
}
