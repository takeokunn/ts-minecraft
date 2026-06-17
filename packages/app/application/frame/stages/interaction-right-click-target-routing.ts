import type { BlockType, Position } from '@ts-minecraft/core'

export type RightClickTargetRoute =
  | { readonly kind: 'chest'; readonly targetPos: Position }
  | { readonly kind: 'furnace'; readonly targetPos: Position }
  | { readonly kind: 'bed'; readonly targetPos: Position }
  | { readonly kind: 'enchantingTable'; readonly targetPos: Position }
  | { readonly kind: 'door'; readonly targetPos: Position; readonly blockType: 'DOOR' | 'DOOR_OPEN' }

export const resolveRightClickTargetRoute = (
  targetPos: Position,
  targetBlockType: BlockType | null,
): RightClickTargetRoute | null => {
  if (targetBlockType === 'CHEST') return { kind: 'chest', targetPos }
  if (targetBlockType === 'FURNACE') return { kind: 'furnace', targetPos }
  if (targetBlockType === 'BED') return { kind: 'bed', targetPos }
  if (targetBlockType === 'ENCHANTING_TABLE') return { kind: 'enchantingTable', targetPos }
  if (targetBlockType === 'DOOR' || targetBlockType === 'DOOR_OPEN') {
    return { kind: 'door', targetPos, blockType: targetBlockType }
  }
  return null
}
