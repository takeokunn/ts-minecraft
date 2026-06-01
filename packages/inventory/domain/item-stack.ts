import { Option, Schema } from 'effect'
import { InventoryItem, InventoryItemSchema } from '@ts-minecraft/core'
import { isDurable, getMaxDurability, damageDurability, isBroken, TOOL_MAX_DURABILITY } from './durability'

export class ItemStack extends Schema.Class<ItemStack>('ItemStack')({
  itemType: InventoryItemSchema,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  // Remaining durability for tool/weapon instances (Phase 12). Optional so non-tools
  // (and existing `new ItemStack({itemType, count})` call sites) stay valid.
  durability: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
}) {}

export const MAX_STACK_SIZE = 64

// Tool/weapon types cannot be stacked beyond 1. Derived once at module load from
// the durability table (single source of truth) so the two lists can never drift —
// every durable tool is non-stackable. Kept as a native Set<string> (not HashSet):
// pure O(1) allocation-free lookup; HashSet structural-equality overhead is
// unacceptable for hot-path stacking lookups (intentional perf-boundary exception).
const TOOL_BLOCK_TYPES = new Set<string>(Object.keys(TOOL_MAX_DURABILITY))

export const maxStackFor = (itemType: InventoryItem): number =>
  TOOL_BLOCK_TYPES.has(itemType) ? 1 : MAX_STACK_SIZE

export const createStack = (itemType: InventoryItem, count = 1): ItemStack => {
  const max = maxStackFor(itemType)
  // Tools spawn at full durability; non-tools leave the field undefined.
  const durability = isDurable(itemType) ? Option.getOrThrow(getMaxDurability(itemType)) : undefined
  return new ItemStack({ itemType, count: Math.max(1, Math.min(max, count)), durability })
}

export const addToStack = (stack: ItemStack, n: number): ItemStack =>
  new ItemStack({ itemType: stack.itemType, count: Math.min(maxStackFor(stack.itemType), stack.count + n), durability: stack.durability })

// Returns Option.none() when the stack is depleted.
export const removeFromStack = (stack: ItemStack, n: number): Option.Option<ItemStack> => {
  const newCount = stack.count - n
  if (newCount <= 0) return Option.none()
  return Option.some(new ItemStack({ itemType: stack.itemType, count: newCount, durability: stack.durability }))
}

// Two stacks may only merge when they share an item type AND neither is a durable
// tool — distinct tool instances each carry their own durability and must stay apart.
export const canMerge = (a: ItemStack, b: ItemStack): boolean =>
  a.itemType === b.itemType && !isDurable(a.itemType)

// Returns [updatedA, remainderB]; remainderB is Option.none() when b was fully absorbed.
export const mergeStacks = (
  a: ItemStack,
  b: ItemStack,
): readonly [ItemStack, Option.Option<ItemStack>] => {
  if (!canMerge(a, b)) return [a, Option.some(b)]
  const space = maxStackFor(a.itemType) - a.count
  if (space <= 0) return [a, Option.some(b)]
  const transferred = Math.min(space, b.count)
  const newA = new ItemStack({ itemType: a.itemType, count: a.count + transferred, durability: a.durability })
  const remaining = b.count - transferred
  const newB = remaining > 0 ? Option.some(new ItemStack({ itemType: b.itemType, count: remaining, durability: b.durability })) : Option.none<ItemStack>()
  return [newA, newB]
}

// Applies `amount` damage to a tool/weapon stack. Non-durable stacks (or durable
// stacks somehow missing a durability value) pass through unchanged. A durable
// stack reduced to 0 durability breaks → Option.none().
export const damageStack = (stack: ItemStack, amount = 1): Option.Option<ItemStack> => {
  if (!isDurable(stack.itemType) || stack.durability === undefined) return Option.some(stack)
  const next = damageDurability(stack.durability, amount)
  if (isBroken(next)) return Option.none()
  return Option.some(new ItemStack({ itemType: stack.itemType, count: stack.count, durability: next }))
}
