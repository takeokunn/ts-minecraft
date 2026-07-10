import { Option, Schema } from 'effect'
import { InventoryItem, InventoryItemSchema, StackCount, StackCountSchema } from '@ts-minecraft/core'
import { isDurable, getMaxDurability, damageDurability, isBroken, DURABLE_ITEMS } from './durability'
import { areEnchantmentTypesMutuallyExclusive } from './enchantment-applicability'
import type { Enchantment, EnchantmentType } from './enchantment.types'
import { EnchantmentSchema } from './enchantment.types'

export class ItemStack extends Schema.Class<ItemStack>('ItemStack')({
  itemType: InventoryItemSchema,
  // Branded at the source: every ItemStack in the system carries the 1-64
  // integer invariant in its type, so downstream layers (HUD badges, save
  // codecs, network) never re-validate or accept a raw number by accident.
  count: StackCountSchema,
  durability: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  enchantments: Schema.optional(Schema.Array(EnchantmentSchema)),
  // Anvil rename. Absent = default item name. Every ItemStack-copying helper
  // below MUST thread this through or renames silently drop on merge/damage.
  customName: Schema.optional(Schema.String),
}) {}

// Vanilla anvil name-length limit.
export const MAX_CUSTOM_NAME_LENGTH = 35

// Applies an anvil rename. A blank/whitespace name clears the custom name
// (vanilla: erasing the text restores the default); long names are truncated.
export const renameStack = (stack: ItemStack, name: string): ItemStack => {
  const trimmed = name.trim().slice(0, MAX_CUSTOM_NAME_LENGTH)
  return new ItemStack({
    itemType: stack.itemType,
    count: stack.count,
    durability: stack.durability,
    enchantments: stack.enchantments,
    ...(trimmed.length > 0 ? { customName: trimmed } : {}),
  })
}

// Frozen empty array shared across stack enchantment reads.
const EMPTY_ENCHANTMENTS: ReadonlyArray<Enchantment> = Object.freeze([])

export const getStackEnchantments = (stack: ItemStack): ReadonlyArray<Enchantment> =>
  stack.enchantments === undefined ? EMPTY_ENCHANTMENTS : stack.enchantments

export const findStackEnchantment = (
  stack: ItemStack,
  enchantmentType: EnchantmentType,
): Option.Option<Enchantment> => {
  for (const enchantment of getStackEnchantments(stack)) {
    if (enchantment.type === enchantmentType) return Option.some(enchantment)
  }
  return Option.none()
}

const filterCompatibleEnchantments = (
  existing: ReadonlyArray<Enchantment>,
  incoming: Enchantment,
): Array<Enchantment> =>
  existing.filter(
    (e) => e.type !== incoming.type && !areEnchantmentTypesMutuallyExclusive(e.type, incoming.type),
  )

// Apply one enchantment to a stack, replacing the same type and dropping mutually exclusive types.
export const enchantItem = (stack: ItemStack, enchantment: Enchantment): ItemStack =>
  new ItemStack({
    itemType: stack.itemType,
    count: stack.count,
    durability: stack.durability,
    enchantments: [...filterCompatibleEnchantments(getStackEnchantments(stack), enchantment), enchantment],
    customName: stack.customName,
  })

export const MAX_STACK_SIZE = 64

// Durable item types cannot be stacked beyond 1. Derived once at module load from
// the durability item tuple so the two lists can never drift. Kept as a native Set<string> (not HashSet):
// pure O(1) allocation-free lookup; HashSet structural-equality overhead is
// unacceptable for hot-path stacking lookups (intentional perf-boundary exception).
const NON_STACKABLE_DURABLE_ITEMS = new Set<string>(DURABLE_ITEMS)

// Vanilla 16-stack tier: throwables and eggs cap at 16, not 64.
export const SIXTEEN_STACK_SIZE = 16
const SIXTEEN_STACK_ITEMS = new Set<string>(['SNOWBALL', 'ENDER_PEARL', 'EGG'])

export const maxStackFor = (itemType: InventoryItem): number =>
  NON_STACKABLE_DURABLE_ITEMS.has(itemType) ? 1
    : SIXTEEN_STACK_ITEMS.has(itemType) ? SIXTEEN_STACK_SIZE
    : MAX_STACK_SIZE

export const createStack = (itemType: InventoryItem, count = 1): ItemStack => {
  const max = maxStackFor(itemType)
  // Tools spawn at full durability; non-tools use an explicit null.
  const durability = Option.getOrNull(getMaxDurability(itemType))
  return new ItemStack({ itemType, count: StackCount.make(Math.max(1, Math.min(max, count))), durability })
}

export const addToStack = (stack: ItemStack, n: number): ItemStack =>
  new ItemStack({ itemType: stack.itemType, count: StackCount.make(Math.min(maxStackFor(stack.itemType), stack.count + n)), durability: stack.durability, enchantments: stack.enchantments, customName: stack.customName })

// Returns Option.none() when the stack is depleted.
export const removeFromStack = (stack: ItemStack, n: number): Option.Option<ItemStack> => {
  const newCount = stack.count - n
  if (newCount <= 0) return Option.none()
  return Option.some(new ItemStack({ itemType: stack.itemType, count: StackCount.make(newCount), durability: stack.durability, enchantments: stack.enchantments, customName: stack.customName }))
}

// Two stacks may only merge when they share an item type AND neither is a durable
// tool — distinct tool instances each carry their own durability and must stay
// apart. Renamed stacks only merge with identically-named stacks.
export const canMerge = (a: ItemStack, b: ItemStack): boolean =>
  a.itemType === b.itemType && !isDurable(a.itemType) && a.customName === b.customName

// Returns [updatedA, remainderB]; remainderB is Option.none() when b was fully absorbed.
export const mergeStacks = (
  a: ItemStack,
  b: ItemStack,
): readonly [ItemStack, Option.Option<ItemStack>] => {
  if (!canMerge(a, b)) return [a, Option.some(b)]
  const space = maxStackFor(a.itemType) - a.count
  if (space <= 0) return [a, Option.some(b)]
  const transferred = Math.min(space, b.count)
  const newA = new ItemStack({ itemType: a.itemType, count: StackCount.make(a.count + transferred), durability: a.durability, enchantments: a.enchantments, customName: a.customName })
  const remaining = b.count - transferred
  const newB = remaining > 0 ? Option.some(new ItemStack({ itemType: b.itemType, count: StackCount.make(remaining), durability: b.durability, enchantments: b.enchantments, customName: b.customName })) : Option.none<ItemStack>()
  return [newA, newB]
}

// Extracts the enchantment list from an optional stack. Safe to call on any
// slot-read result — returns EMPTY_ENCHANTMENTS when the slot is empty or has
// no enchantments (avoids per-call [] allocation, R101).
export const enchantmentsOf = (slot: Option.Option<ItemStack>): ReadonlyArray<Enchantment> =>
  Option.match(slot, {
    onNone: () => EMPTY_ENCHANTMENTS,
    onSome: getStackEnchantments,
  })

export type MendingRepairResult = {
  readonly stack: ItemStack
  readonly xpUsed: number
  readonly durabilityRepaired: number
}

export const repairStackWithMendingXP = (stack: ItemStack, xp: number): MendingRepairResult => {
  const availableXP = Math.max(0, Math.floor(xp))
  const hasMending = Option.isSome(findStackEnchantment(stack, 'MENDING'))
  if (availableXP <= 0 || !hasMending || !isDurable(stack.itemType) || stack.durability === null) {
    return { stack, xpUsed: 0, durabilityRepaired: 0 }
  }

  const maxDurability = Option.getOrNull(getMaxDurability(stack.itemType))
  if (maxDurability === null) return { stack, xpUsed: 0, durabilityRepaired: 0 }

  const missingDurability = Math.max(0, maxDurability - stack.durability)
  if (missingDurability <= 0) return { stack, xpUsed: 0, durabilityRepaired: 0 }

  const durabilityRepaired = Math.min(missingDurability, availableXP * 2)
  const xpUsed = Math.ceil(durabilityRepaired / 2)
  return {
    stack: new ItemStack({
      itemType: stack.itemType,
      count: stack.count,
      durability: stack.durability + durabilityRepaired,
      enchantments: stack.enchantments,
      customName: stack.customName,
    }),
    xpUsed,
    durabilityRepaired,
  }
}

// Applies `amount` damage to a tool/weapon stack. Non-durable stacks (or durable
// stacks somehow missing a durability value) pass through unchanged. A durable
// stack reduced to 0 durability breaks → Option.none().
export const damageStack = (stack: ItemStack, amount = 1): Option.Option<ItemStack> => {
  if (!isDurable(stack.itemType) || stack.durability === null) return Option.some(stack)
  const next = damageDurability(stack.durability, amount)
  if (isBroken(next)) return Option.none()
  return Option.some(new ItemStack({ itemType: stack.itemType, count: stack.count, durability: next, enchantments: stack.enchantments, customName: stack.customName }))
}
