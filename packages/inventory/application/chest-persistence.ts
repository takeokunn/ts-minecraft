import { Array as Arr, Option } from 'effect'
import { CHEST_SIZE } from '../domain/chest-service.config'
import { ItemStack } from '../domain/item-stack'
import type { ChestBlockState, ChestItemStack } from '../domain/chest-state'
import type { ChestRuntimeState, ChestSlots } from './chest-service-types'

const normalizeChestSlots = (slots: ReadonlyArray<Option.Option<ChestItemStack>>): ReadonlyArray<Option.Option<ChestItemStack>> =>
  Arr.makeBy(CHEST_SIZE, (index) => Option.getOrElse(Arr.get(slots, index), () => Option.none<ChestItemStack>()))

const hydrateChestItemStack = (stack: ChestItemStack): ItemStack =>
  new ItemStack({ itemType: stack.itemType, count: stack.count, durability: stack.durability })

const hydrateChestSlots = (slots: ReadonlyArray<Option.Option<ChestItemStack>>): ChestSlots =>
  Arr.makeBy(CHEST_SIZE, (index) =>
    Option.map(Option.getOrElse(Arr.get(normalizeChestSlots(slots), index), () => Option.none<ChestItemStack>()), hydrateChestItemStack),
  )

export const hydrateChest = (chest: ChestBlockState): ChestRuntimeState => ({
  position: chest.position,
  slots: hydrateChestSlots(chest.slots),
})

export const serializeChestItemStack = (stack: ItemStack): ChestItemStack => ({
  itemType: stack.itemType,
  count: stack.count,
  durability: stack.durability,
})

const serializeChestSlots = (slots: ChestSlots): ReadonlyArray<Option.Option<ChestItemStack>> =>
  Arr.makeBy(CHEST_SIZE, (index) =>
    Option.map(Option.getOrElse(Arr.get(slots, index), () => Option.none<ItemStack>()), serializeChestItemStack),
  )

export const serializeChest = (chest: ChestRuntimeState): ChestBlockState => ({
  position: chest.position,
  slots: serializeChestSlots(chest.slots),
})

export const normalizeChest = (chest: ChestBlockState): ChestBlockState => ({
  position: chest.position,
  slots: normalizeChestSlots(chest.slots),
})
