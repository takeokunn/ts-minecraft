import { Option, Schema } from 'effect'
import type { BlockType } from './block'
import { BlockTypeSchema } from './block'

export class ItemStack extends Schema.Class<ItemStack>('ItemStack')({
  blockType: BlockTypeSchema,
  count: Schema.Number.pipe(Schema.between(1, 64)),
}) {}

/**
 * Maximum items per stack
 */
export const MAX_STACK_SIZE = 64

/**
 * Create a new ItemStack
 */
export const createStack = (blockType: BlockType, count = 1): ItemStack =>
  new ItemStack({ blockType, count: Math.max(1, Math.min(MAX_STACK_SIZE, count)) })

/**
 * Add n items to a stack, clamping at MAX_STACK_SIZE.
 * Returns the updated stack.
 */
export const addToStack = (stack: ItemStack, n: number): ItemStack =>
  new ItemStack({ blockType: stack.blockType, count: Math.min(MAX_STACK_SIZE, stack.count + n) })

/**
 * Remove n items from a stack.
 * Returns Option.none() when the stack is depleted (count reaches 0).
 */
export const removeFromStack = (stack: ItemStack, n: number): Option.Option<ItemStack> => {
  const newCount = stack.count - n
  if (newCount <= 0) return Option.none()
  return Option.some(new ItemStack({ blockType: stack.blockType, count: newCount }))
}

/**
 * Check if two stacks can be merged (same block type)
 */
export const canMerge = (a: ItemStack, b: ItemStack): boolean => a.blockType === b.blockType

/**
 * Merge stack b into stack a, up to MAX_STACK_SIZE.
 * Returns [updatedA, remainderB] where remainderB is Option.none() if b was fully absorbed.
 */
export const mergeStacks = (
  a: ItemStack,
  b: ItemStack,
): readonly [ItemStack, Option.Option<ItemStack>] => {
  if (!canMerge(a, b)) return [a, Option.some(b)]
  const space = MAX_STACK_SIZE - a.count
  if (space <= 0) return [a, Option.some(b)]
  const transferred = Math.min(space, b.count)
  const newA = new ItemStack({ blockType: a.blockType, count: a.count + transferred })
  const remaining = b.count - transferred
  const newB = remaining > 0 ? Option.some(new ItemStack({ blockType: b.blockType, count: remaining })) : Option.none<ItemStack>()
  return [newA, newB]
}
