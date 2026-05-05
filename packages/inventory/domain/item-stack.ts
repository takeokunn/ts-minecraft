import { Option, Schema } from 'effect'
import { InventoryItem, InventoryItemSchema } from '@ts-minecraft/kernel'

export class ItemStack extends Schema.Class<ItemStack>('ItemStack')({
  itemType: InventoryItemSchema,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
}) {}

export const MAX_STACK_SIZE = 64

// Tool and weapon types that cannot be stacked beyond 1.
// Uses native Set<string> (not HashSet) — pure O(1) static lookup; HashSet structural equality overhead
// is unacceptable for hot-path lookups (intentional exception per performance boundary policy).
const TOOL_BLOCK_TYPES = new Set<string>([
  'WOODEN_SWORD', 'WOODEN_PICKAXE', 'STONE_PICKAXE', 'IRON_PICKAXE', 'DIAMOND_PICKAXE',
])

export const maxStackFor = (itemType: InventoryItem): number =>
  TOOL_BLOCK_TYPES.has(itemType) ? 1 : MAX_STACK_SIZE

export const createStack = (itemType: InventoryItem, count = 1): ItemStack => {
  const max = maxStackFor(itemType)
  return new ItemStack({ itemType, count: Math.max(1, Math.min(max, count)) })
}

export const addToStack = (stack: ItemStack, n: number): ItemStack =>
  new ItemStack({ itemType: stack.itemType, count: Math.min(maxStackFor(stack.itemType), stack.count + n) })

// Returns Option.none() when the stack is depleted.
export const removeFromStack = (stack: ItemStack, n: number): Option.Option<ItemStack> => {
  const newCount = stack.count - n
  if (newCount <= 0) return Option.none()
  return Option.some(new ItemStack({ itemType: stack.itemType, count: newCount }))
}

export const canMerge = (a: ItemStack, b: ItemStack): boolean => a.itemType === b.itemType

// Returns [updatedA, remainderB]; remainderB is Option.none() when b was fully absorbed.
export const mergeStacks = (
  a: ItemStack,
  b: ItemStack,
): readonly [ItemStack, Option.Option<ItemStack>] => {
  if (!canMerge(a, b)) return [a, Option.some(b)]
  const space = maxStackFor(a.itemType) - a.count
  if (space <= 0) return [a, Option.some(b)]
  const transferred = Math.min(space, b.count)
  const newA = new ItemStack({ itemType: a.itemType, count: a.count + transferred })
  const remaining = b.count - transferred
  const newB = remaining > 0 ? Option.some(new ItemStack({ itemType: b.itemType, count: remaining })) : Option.none<ItemStack>()
  return [newA, newB]
}
