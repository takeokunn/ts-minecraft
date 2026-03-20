import { Cause, Effect, Option, Ref } from 'effect'
import { InventoryService, INVENTORY_SIZE, HOTBAR_START } from '@/application/inventory/inventory-service'
import { HotbarService } from '@/application/hotbar/hotbar-service'
import { DomOperationsService } from '@/presentation/hud/crosshair'
import type { BlockType } from '@/domain/block'
import { SlotIndex } from '@/shared/kernel'

// Colors for block types in the inventory UI
const SLOT_COLORS: Record<string, string> = {
  AIR: '#444444', GRASS: '#5a8a3a', DIRT: '#8b6344', STONE: '#888888',
  SAND: '#d4c77a', WATER: '#3f76be', WOOD: '#6b4423', LEAVES: '#2d5a1b',
  GLASS: '#c0e0f0', SNOW: '#f0f5ff', GRAVEL: '#7a6a5a', COBBLESTONE: '#606060',
}
const DEFAULT_SLOT_COLOR = '#333333'

export class InventoryRendererService extends Effect.Service<InventoryRendererService>()(
  '@minecraft/presentation/InventoryRenderer',
  {
    scoped: Effect.gen(function* () {
      const inventoryService = yield* InventoryService
      const hotbarService = yield* HotbarService
      const dom = yield* DomOperationsService

      let overlayEl: HTMLDivElement | null = null
      let slotEls: HTMLDivElement[] = []
      const isVisibleRef = yield* Ref.make(false)

      const getSlotColor = (blockType: BlockType | string): string =>
        SLOT_COLORS[blockType] ?? DEFAULT_SLOT_COLOR

      const createSlotEl = (index: number): HTMLDivElement => {
        const el = dom.createElement('div') as HTMLDivElement
        el.dataset['slot'] = String(index)
        el.style.cssText = [
          'width:48px', 'height:48px', 'border:2px solid #666',
          'cursor:pointer', 'position:relative', 'display:flex',
          'align-items:center', 'justify-content:center',
          'font-size:10px', 'color:#fff', 'user-select:none',
          'background:' + DEFAULT_SLOT_COLOR,
        ].join(';')
        return el
      }

      const buildOverlay = (): void => {
        if (typeof document === 'undefined') return

        overlayEl = dom.createElement('div') as HTMLDivElement
        overlayEl.id = 'inventory-overlay'
        overlayEl.style.cssText = [
          'position:fixed', 'top:50%', 'left:50%',
          'transform:translate(-50%,-50%)',
          'background:rgba(0,0,0,0.85)', 'padding:16px',
          'border-radius:8px', 'z-index:999', 'display:none',
          'font-family:monospace',
        ].join(';')

        const title = dom.createElement('div')
        title.textContent = 'Inventory'
        title.style.cssText = 'color:#fff;margin-bottom:10px;font-size:14px;text-align:center'
        dom.appendChildTo(overlayEl, title)

        // Main grid (3 rows × 9 = slots 0-26)
        const mainGrid = dom.createElement('div')
        mainGrid.style.cssText = 'display:grid;grid-template-columns:repeat(9,50px);gap:4px;margin-bottom:8px'
        for (let i = 0; i < HOTBAR_START; i++) {
          const el = createSlotEl(i)
          slotEls[i] = el
          dom.appendChildTo(mainGrid, el)
        }
        dom.appendChildTo(overlayEl, mainGrid)

        // Separator
        const sep = dom.createElement('hr')
        sep.style.cssText = 'border-color:#555;margin:8px 0'
        dom.appendChildTo(overlayEl, sep)

        // Hotbar row (slots 27-35)
        const hotbarGrid = dom.createElement('div')
        hotbarGrid.style.cssText = 'display:grid;grid-template-columns:repeat(9,50px);gap:4px'
        for (let i = HOTBAR_START; i < INVENTORY_SIZE; i++) {
          const el = createSlotEl(i)
          slotEls[i] = el
          dom.appendChildTo(hotbarGrid, el)
        }
        dom.appendChildTo(overlayEl, hotbarGrid)

        dom.appendChild(overlayEl)
      }

      buildOverlay()

      const handleDelegatedClick = (event: MouseEvent) => {
        const target = (event.target as HTMLElement).closest('[data-slot]') as HTMLElement | null
        if (!target) return
        const index = parseInt(target.dataset['slot'] ?? '-1', 10)
        if (index < 0 || index >= INVENTORY_SIZE) return
        Effect.runFork(
          Effect.gen(function* () {
            const selectedSlot = yield* hotbarService.getSelectedSlot()
            const hotbarInventoryIndex = HOTBAR_START + SlotIndex.toNumber(selectedSlot)
            yield* inventoryService.moveStack(SlotIndex.make(index), SlotIndex.make(hotbarInventoryIndex))
          }).pipe(
            Effect.catchAllCause(cause =>
              Effect.logError(`Inventory click error: ${Cause.pretty(cause)}`)
            )
          )
        )
      }

      yield* Effect.acquireRelease(
        Effect.sync(() => {
          overlayEl?.addEventListener('click', handleDelegatedClick)
        }),
        () => Effect.sync(() => {
          overlayEl?.removeEventListener('click', handleDelegatedClick)
          overlayEl?.remove()
        })
      )

      const refreshSlots = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const allSlots = yield* inventoryService.getAllSlots()
          const selectedSlot = yield* hotbarService.getSelectedSlot()

          for (let i = 0; i < INVENTORY_SIZE; i++) {
            const el = slotEls[i]
            if (!el) continue
            const slot = allSlots[i]
            if (slot && Option.isSome(slot)) {
              const stack = slot.value
              el.style.background = getSlotColor(stack.blockType)
              el.title = `${stack.blockType} ×${stack.count}`
              el.textContent = stack.count < 64 ? String(stack.count) : ''
            } else {
              el.style.background = DEFAULT_SLOT_COLOR
              el.title = ''
              el.textContent = ''
            }
            // Highlight selected hotbar slot
            if (i >= HOTBAR_START && i === HOTBAR_START + SlotIndex.toNumber(selectedSlot)) {
              el.style.border = '2px solid #fff'
            } else {
              el.style.border = '2px solid #666'
            }
          }
        })

      return {
        toggle: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const current = yield* Ref.get(isVisibleRef)
            const next = !current
            yield* Ref.set(isVisibleRef, next)
            if (overlayEl) overlayEl.style.display = next ? 'block' : 'none'
            if (next) yield* refreshSlots()
            return next
          }),

        isOpen: (): Effect.Effect<boolean, never> => Ref.get(isVisibleRef),

        update: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const isVisible = yield* Ref.get(isVisibleRef)
            if (isVisible) yield* refreshSlots()
          }),
      }
    }),
  }
) {}
export const InventoryRendererLive = InventoryRendererService.Default
