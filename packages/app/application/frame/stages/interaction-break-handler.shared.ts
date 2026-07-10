import { Effect, Option, Schema } from 'effect'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import { InventoryItemSchema } from '@ts-minecraft/core'
import type { Enchantment } from '@ts-minecraft/inventory/domain/enchantment.types'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'

const NEVER_DROPPED_BLOCK_TYPES: ReadonlySet<BlockType> = new Set<BlockType>(['AIR', 'WATER', 'LAVA', 'PISTON_HEAD'])

export const REDSTONE_CLEANUP_BLOCK_TYPES: ReadonlySet<BlockType> = new Set<BlockType>([
  'REDSTONE_WIRE',
  'LEVER',
  'STONE_BUTTON',
  'REDSTONE_TORCH',
  'PRESSURE_PLATE',
  'OBSERVER',
  'HOPPER',
  'REPEATER',
  'COMPARATOR',
  'DISPENSER',
])

export type BreakExecutionServices = Pick<
  FrameHandlerServices,
  | 'blockService'
  | 'chunkManagerService'
  | 'soundManager'
  | 'inventoryService'
  | 'equipmentService'
  | 'particleSystem'
  | 'multiplayer'
  | 'cropGrowthService'
  | 'redstoneService'
  | 'droppedItemService'
  | 'droppedXpOrbService'
  | 'statisticsService'
>

export type BreakExecutionContext = {
  readonly pos: { readonly x: number; readonly y: number; readonly z: number }
  readonly blockId: number
  readonly blockType: BlockType
  readonly lx: number
  readonly lz: number
  readonly chunkCoord: { readonly x: number; readonly z: number }
  readonly hasSilkTouch: boolean
  readonly toolEnchantments: ReadonlyArray<Enchantment>
  readonly toolStack: Option.Option<{ readonly itemType: InventoryItem; readonly count: number }>
  readonly selectedSlotIdx: number
  readonly creative: boolean
  readonly debugFlags: DebugFeatureFlags
}

export const isNeverDroppedBlock = (blockType: BlockType): boolean =>
  NEVER_DROPPED_BLOCK_TYPES.has(blockType)

type BreakExecutionEnchantments = {
  readonly fortune: Enchantment | undefined
  readonly unbreaking: Enchantment | undefined
}

export const resolveBreakExecutionEnchantments = (
  toolEnchantments: ReadonlyArray<Enchantment>,
): BreakExecutionEnchantments => {
  let fortune: Enchantment | undefined
  let unbreaking: Enchantment | undefined
  for (const enchantment of toolEnchantments) {
    switch (enchantment.type) {
      case 'FORTUNE': fortune = enchantment; break
      case 'UNBREAKING': unbreaking = enchantment; break
    }
  }
  return { fortune, unbreaking }
}

export const spawnBlockDrop = (
  services: Pick<BreakExecutionServices, 'droppedItemService'>,
  pos: BreakExecutionContext['pos'],
  itemType: InventoryItem,
  count: number,
) =>
  count > 0
    ? services.droppedItemService.spawn({
        itemType,
        count,
        position: { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 },
        velocity: { x: 0, y: 0.12, z: 0 },
      }).pipe(Effect.catchAllCause(() => Effect.void))
    : Effect.void

export const spawnBlockXpOrb = (
  services: Pick<BreakExecutionServices, 'droppedXpOrbService'>,
  pos: BreakExecutionContext['pos'],
  amount: number,
) =>
  amount > 0
    ? services.droppedXpOrbService.spawn({
        amount,
        position: { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 },
      }).pipe(Effect.asVoid, Effect.catchAllCause(() => Effect.void))
    : Effect.void

export const updateBreakProgressHud = (
  el: HTMLElement | null,
  progress: import('@ts-minecraft/app/frame/stages/interaction-break-progress').BreakProgressState | null,
): void => {
  if (el === null) return
  if (progress === null) {
    el.style.display = 'none'
    return
  }
  el.setAttribute('value', String(progress.ticks))
  el.setAttribute('max', String(progress.totalTicks))
  el.style.display = 'block'
}

export const toSelectedInventoryItem = (item: Option.Option<string>): Option.Option<InventoryItem> =>
  Option.isNone(item)
    ? Option.none()
    : Schema.is(InventoryItemSchema)(item.value)
      ? Option.some(item.value as InventoryItem)
      : Option.none()
