import { Option } from 'effect'

import type { ItemStack } from '../domain/item-stack'

export type ChestSlot = Option.Option<ItemStack>
export type ChestSlots = ReadonlyArray<ChestSlot>

export type ChestRuntimeState = {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly slots: ChestSlots
}
