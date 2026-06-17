import { Option } from 'effect'
import type { ItemStack } from '../domain/item-stack'

export type InventorySlot = Option.Option<ItemStack>
export type InventorySlots = ReadonlyArray<InventorySlot>
