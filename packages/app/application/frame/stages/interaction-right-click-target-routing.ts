import type { BlockType, Position } from '@ts-minecraft/core'

export type RightClickTargetRoute =
  | { readonly kind: 'chest'; readonly targetPos: Position }
  | { readonly kind: 'craftingTable'; readonly targetPos: Position }
  | { readonly kind: 'furnace'; readonly targetPos: Position }
  | { readonly kind: 'bed'; readonly targetPos: Position }
  | { readonly kind: 'enchantingTable'; readonly targetPos: Position }
  | { readonly kind: 'door'; readonly targetPos: Position; readonly blockType: 'DOOR' | 'DOOR_OPEN' }

const CHEST_STORAGE_BLOCK_TYPES = new Set<BlockType>(['CHEST', 'SHULKER_BOX'])

export const resolveRightClickTargetRoute = (
  targetPos: Position,
  targetBlockType: BlockType | null,
): RightClickTargetRoute | null => {
  if (targetBlockType !== null && CHEST_STORAGE_BLOCK_TYPES.has(targetBlockType)) return { kind: 'chest', targetPos }
  if (targetBlockType === 'CRAFTING_TABLE') return { kind: 'craftingTable', targetPos }
  if (targetBlockType === 'FURNACE') return { kind: 'furnace', targetPos }
  if (targetBlockType === 'BED') return { kind: 'bed', targetPos }
  if (targetBlockType === 'ENCHANTING_TABLE') return { kind: 'enchantingTable', targetPos }
  if (targetBlockType === 'DOOR' || targetBlockType === 'DOOR_OPEN') {
    return { kind: 'door', targetPos, blockType: targetBlockType }
  }
  return null
}
