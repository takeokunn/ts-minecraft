import { Array as Arr, Cause, Effect, Option, Ref } from 'effect'
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
    scoped: Effect.all([
      InventoryService,
      HotbarService,
      DomOperationsService,
      Ref.make(false),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([inventoryService, hotbarService, dom, isVisibleRef]) => {
      const getSlotColor = (blockType: BlockType | string): string =>
        Option.getOrElse(Option.fromNullable(SLOT_COLORS[blockType]), () => DEFAULT_SLOT_COLOR)

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

      return Effect.sync((): { overlayEl: Option.Option<HTMLDivElement>; slotEls: HTMLDivElement[] } => {
        if (typeof document === 'undefined') return { overlayEl: Option.none(), slotEls: [] }

        const el = dom.createElement('div') as HTMLDivElement
        el.id = 'inventory-overlay'
        el.style.cssText = [
          'position:fixed', 'top:50%', 'left:50%',
          'transform:translate(-50%,-50%)',
          'background:rgba(0,0,0,0.85)', 'padding:16px',
          'border-radius:8px', 'z-index:999', 'display:none',
          'font-family:monospace',
        ].join(';')

        const title = dom.createElement('div')
        title.textContent = 'Inventory'
        title.style.cssText = 'color:#fff;margin-bottom:10px;font-size:14px;text-align:center'
        dom.appendChildTo(el, title)

        // Main grid (3 rows × 9 = slots 0-26)
        const mainGrid = dom.createElement('div')
        mainGrid.style.cssText = 'display:grid;grid-template-columns:repeat(9,50px);gap:4px;margin-bottom:8px'
        const mainSlots = Arr.makeBy(HOTBAR_START, (i) => createSlotEl(i))
        Arr.forEach(mainSlots, (slotEl) => dom.appendChildTo(mainGrid, slotEl))
        dom.appendChildTo(el, mainGrid)

        // Separator
        const sep = dom.createElement('hr')
        sep.style.cssText = 'border-color:#555;margin:8px 0'
        dom.appendChildTo(el, sep)

        // Hotbar row (slots 27-35)
        const hotbarGrid = dom.createElement('div')
        hotbarGrid.style.cssText = 'display:grid;grid-template-columns:repeat(9,50px);gap:4px'
        const hotbarSlots = Arr.makeBy(INVENTORY_SIZE - HOTBAR_START, (i) => createSlotEl(HOTBAR_START + i))
        Arr.forEach(hotbarSlots, (slotEl) => dom.appendChildTo(hotbarGrid, slotEl))
        dom.appendChildTo(el, hotbarGrid)

        dom.appendChild(el)

        return { overlayEl: Option.some(el), slotEls: Arr.appendAll(mainSlots, hotbarSlots) }
      }).pipe(
        Effect.flatMap(({ overlayEl, slotEls }) => {
        const handleDelegatedClick = (event: MouseEvent) => {
          Option.map(
            Option.fromNullable((event.target as HTMLElement).closest('[data-slot]') as HTMLElement | null),
            (target) => {
              const index = parseInt(Option.getOrElse(Option.fromNullable(target.dataset['slot']), () => '-1'), 10)
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
          )
        }

        const refreshSlots = (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const allSlots = yield* inventoryService.getAllSlots()
            const selectedSlot = yield* hotbarService.getSelectedSlot()

            yield* Effect.sync(() => {
              const selectedHotbarIdx = HOTBAR_START + SlotIndex.toNumber(selectedSlot)
              Arr.forEach(Arr.zip(slotEls, allSlots), ([el, itemOpt], i) => {
                Option.match(itemOpt, {
                  onSome: (stack) => {
                    el.style.background = getSlotColor(stack.blockType)
                    el.title = `${stack.blockType} ×${stack.count}`
                    el.textContent = stack.count < 64 ? String(stack.count) : ''
                  },
                  onNone: () => {
                    el.style.background = DEFAULT_SLOT_COLOR
                    el.title = ''
                    el.textContent = ''
                  },
                })
                // Highlight selected hotbar slot
                el.style.border = i >= HOTBAR_START && i === selectedHotbarIdx
                  ? '2px solid #fff'
                  : '2px solid #666'
              })
            })
          })

        return Effect.acquireRelease(
          Effect.sync(() => {
            Option.map(overlayEl, (el) => el.addEventListener('click', handleDelegatedClick))
          }),
          () => Effect.sync(() => {
            Option.map(overlayEl, (el) => { el.removeEventListener('click', handleDelegatedClick); el.remove() })
          })
        ).pipe(Effect.as({
          toggle: (): Effect.Effect<boolean, never> =>
            Effect.gen(function* () {
              const next = yield* Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current])
              yield* Effect.sync(() => Option.map(overlayEl, (el) => { el.style.display = next ? 'block' : 'none' }))
              if (next) yield* refreshSlots()
              return next
            }),

          isOpen: (): Effect.Effect<boolean, never> => Ref.get(isVisibleRef),

          update: (): Effect.Effect<void, never> =>
            Effect.gen(function* () {
              const isVisible = yield* Ref.get(isVisibleRef)
              if (isVisible) yield* refreshSlots()
            }),
        }))
      })
      )
    })
    ),
  }
) {}
export const InventoryRendererLive = InventoryRendererService.Default
